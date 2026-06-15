# Sprint 1: Repository Registration Foundation

**Duration**: 1-2 weeks  
**Status**: Implementation Plan (Design Phase)  
**Scope**: Repository CRUD + GitHub connection testing only  

---

## Executive Summary

Sprint 1 delivers the foundational infrastructure for repository management in QA Ops. Users can register FE/BE repositories, test GitHub connectivity, and manage access credentials. This sprint does NOT include repository analysis or AI features.

**Key Deliverables**:
- Repository database model with 5 types and 3 purposes
- Complete CRUD API with auto tech stack detection
- GitHub personal access token integration (OAuth deferred)
- Repository management UI with type/purpose selectors
- Secure credential storage (encrypted PAT)
- Automatic tech stack detection during connection test
- Analysis fields for future Sprint 2 integration
- Integration tests

**Out of Scope**:
- GitHub OAuth integration (deferred to Sprint 3+)
- Repository analysis (Sprint 2)
- Test case generation (Sprint 3)
- Roam synchronization (Parallel track)
- AI features (Sprint 4)

---

## 1. Database Changes

### 1.1 New Table: `code_repositories`

```sql
CREATE TABLE code_repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identifiers
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  repository_name VARCHAR(255) NOT NULL,
  
  -- Connection Details
  repository_url VARCHAR(2048) NOT NULL,
  repository_type VARCHAR(50) NOT NULL,  -- FRONTEND, BACKEND, MONOREPO, MICROSERVICE, AUTOMATION
  repository_purpose VARCHAR(50) DEFAULT 'PRIMARY',  -- PRIMARY, SECONDARY, LEGACY
  branch VARCHAR(255) DEFAULT 'main',
  
  -- Access Credentials
  github_token VARCHAR(512),  -- Encrypted, GitHub personal access token only (no OAuth in Sprint 1)
  token_encrypted_at TIMESTAMP,
  
  -- Status & Metadata
  connection_status VARCHAR(50) DEFAULT 'not_tested',  -- not_tested, connected, error, token_expired
  last_connection_test_at TIMESTAMP,
  last_connection_test_error TEXT,
  
  -- Tech Stack Detection (auto-detected during connection test)
  detected_tech_stack JSONB,  -- {language, framework, build_tool, package_manager, version}
  detected_at TIMESTAMP,
  
  -- Analysis Placeholder (for future Sprint 2)
  analysis_status VARCHAR(50) DEFAULT 'not_analyzed',  -- not_analyzed, analyzing, analyzed, error
  analysis_version INTEGER DEFAULT 0,  -- Track which version of analysis was run
  last_analyzed_at TIMESTAMP,
  
  -- Metadata
  description TEXT,
  tags VARCHAR(255)[],
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(project_id, repository_url),
  INDEX idx_project_repositories (project_id),
  INDEX idx_connection_status (connection_status),
  INDEX idx_created_at (created_at DESC)
);

-- Create updated_at trigger
CREATE TRIGGER code_repositories_updated_at
BEFORE UPDATE ON code_repositories
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();
```

### 1.2 New Table: `code_repository_credentials`

Secure, encrypted storage of credentials (separate from code_repositories table).

```sql
CREATE TABLE code_repository_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_repository_id UUID NOT NULL REFERENCES code_repositories(id) ON DELETE CASCADE,
  
  -- Credential Type
  credential_type ENUM('github_pat', 'github_oauth', 'ssh_key', 'basic_auth') NOT NULL,
  
  -- Encrypted Credential
  encrypted_value TEXT NOT NULL,  -- Encrypted with application secret key
  encryption_algorithm VARCHAR(50),  -- AES-256-GCM
  encryption_key_id VARCHAR(50),  -- For key rotation
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,  -- For short-lived tokens
  
  UNIQUE(repository_id, credential_type),
  INDEX idx_repository_credentials (repository_id),
  INDEX idx_expires_at (expires_at)
);
```

### 1.3 New Table: `code_repository_connection_tests`

Audit trail of connection tests.

```sql
CREATE TABLE code_repository_connection_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_repository_id UUID NOT NULL REFERENCES code_repositories(id) ON DELETE CASCADE,
  
  -- Test Details
  test_type ENUM('basic_connectivity', 'github_api', 'branch_verification', 'tech_stack_detection') NOT NULL,
  test_status ENUM('success', 'failed', 'pending') NOT NULL,
  test_message TEXT,
  test_error TEXT,
  
  -- Results
  response_time_ms INTEGER,
  tested_by UUID REFERENCES users(id),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_repository_tests (repository_id, created_at DESC),
  INDEX idx_test_status (test_status)
);
```

### 1.4 Schema Changes: `projects` Table

Add columns to link repositories to projects.

```sql
ALTER TABLE projects ADD COLUMN (
  repositories_enabled BOOLEAN DEFAULT false,
  repository_count INTEGER DEFAULT 0,
  last_repository_added_at TIMESTAMP
);
```

### 1.5 Migration Plan

**Order of Execution** (within single transaction):
1. Create enum types (repository_type, repository_purpose, connection_status_enum, analysis_status_enum)
2. Create `code_repositories` table with all columns including analysis_version and analysis_status
3. Create `code_repository_credentials` table
4. Create `code_repository_connection_tests` table
5. Add columns to `projects` table
6. Create indexes
7. Verify data integrity

**Rollback Strategy**:
```sql
-- If migration fails, rollback drops all new tables
DROP TABLE code_repository_connection_tests;
DROP TABLE code_repository_credentials;
DROP TABLE code_repositories;
ALTER TABLE projects DROP COLUMN repositories_enabled, repository_count, last_repository_added_at;
DROP TYPE repository_type;
DROP TYPE repository_purpose;
DROP TYPE connection_status_enum;
DROP TYPE analysis_status_enum;
```

**Note**: GitHub OAuth removed from Sprint 1. OAuth support deferred to Sprint 3 or later.

**Testing**:
- Verify all tables created with correct schema
- Verify indexes exist
- Verify foreign key constraints work
- Verify triggers fire on updates

---

## 2. API Routes

### 2.1 Repository CRUD Routes

#### `POST /api/projects/:projectId/repositories`

Register a new repository.

**Request**:
```json
{
  "repositoryName": "web-app",
  "repositoryUrl": "https://github.com/company/web-app",
  "repositoryType": "frontend",
  "branch": "main",
  "githubToken": "ghp_...",
  "description": "Main frontend application"
}
```

**Validation**:
- `repositoryName`: Required, 1-255 chars, alphanumeric + hyphens
- `repositoryUrl`: Required, valid URL, matches GitHub pattern
- `repositoryType`: Required, one of: FRONTEND, BACKEND, MONOREPO, MICROSERVICE, AUTOMATION
- `repositoryPurpose`: Optional, default "PRIMARY", one of: PRIMARY, SECONDARY, LEGACY
- `branch`: Optional, default "main"
- `githubToken`: Required, personal access token format (no OAuth in Sprint 1)
- `description`: Optional, max 1000 chars

**Processing**:
1. Validate project exists and user has access
2. Validate URL is not already registered for this project
3. Encrypt GitHub token using application key
4. Create repository record with `connection_status = 'not_tested'`
5. Enqueue background job: `testRepositoryConnection`
6. Return repository object

**Response** (201):
```json
{
  "repositoryId": "uuid",
  "projectId": "uuid",
  "repositoryName": "web-app",
  "repositoryUrl": "https://github.com/company/web-app",
  "repositoryType": "FRONTEND",
  "repositoryPurpose": "PRIMARY",
  "branch": "main",
  "connectionStatus": "not_tested",
  "lastConnectionTestAt": null,
  "detectedTechStack": null,
  "analysisStatus": "not_analyzed",
  "analysisVersion": 0,
  "lastAnalyzedAt": null,
  "createdAt": "2026-06-15T10:00:00Z",
  "createdBy": "user-uuid"
}
```

**Error Cases**:
- 400: Invalid URL format
- 400: URL already registered for this project
- 401: Unauthorized
- 403: User doesn't have access to project
- 404: Project not found

---

#### `GET /api/projects/:projectId/repositories`

List all repositories for a project.

**Query Parameters**:
- `status`: Filter by connection_status (optional)
- `type`: Filter by repository_type (optional)
- `limit`: Default 20, max 100
- `offset`: For pagination
- `sort`: Field to sort by (created_at, name)
- `order`: asc or desc

**Response** (200):
```json
{
  "repositories": [
    {
      "repositoryId": "uuid",
      "repositoryName": "web-app",
      "repositoryUrl": "https://github.com/company/web-app",
      "repositoryType": "frontend",
      "branch": "main",
      "connectionStatus": "connected",
      "lastConnectionTestAt": "2026-06-15T10:05:00Z",
      "createdAt": "2026-06-15T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 20,
    "offset": 0
  }
}
```

---

#### `GET /api/projects/:projectId/repositories/:repoId`

Get details of a specific repository.

**Response** (200):
```json
{
  "repositoryId": "uuid",
  "projectId": "uuid",
  "repositoryName": "web-app",
  "repositoryUrl": "https://github.com/company/web-app",
  "repositoryType": "FRONTEND",
  "repositoryPurpose": "PRIMARY",
  "branch": "main",
  "description": "Main frontend application",
  "connectionStatus": "connected",
  "lastConnectionTestAt": "2026-06-15T10:05:00Z",
  "lastConnectionTestError": null,
  "detectedTechStack": {
    "language": "typescript",
    "framework": "react",
    "buildTool": "webpack",
    "packageManager": "npm",
    "version": "1.0.0"
  },
  "detectedAt": "2026-06-15T10:05:00Z",
  "analysisStatus": "not_analyzed",
  "analysisVersion": 0,
  "lastAnalyzedAt": null,
  "tags": ["production", "critical"],
  "isActive": true,
  "createdAt": "2026-06-15T10:00:00Z",
  "createdBy": "user-uuid"
}
```

---

#### `PATCH /api/projects/:projectId/repositories/:repoId`

Update repository details.

**Request** (partial update):
```json
{
  "branch": "develop",
  "description": "Main frontend application",
  "tags": ["production", "critical"],
  "isActive": true
}
```

**Allowed Fields**:
- `branch`
- `description`
- `repositoryPurpose` (PRIMARY, SECONDARY, LEGACY)
- `tags`
- `isActive`

**Not Allowed** (would require re-testing):
- `repositoryUrl` (delete and recreate instead)
- `repositoryType`
- `githubToken` (use separate endpoint)

**Response** (200):
```json
{
  "repositoryId": "uuid",
  "updated": true,
  "updatedFields": ["branch", "tags"]
}
```

---

#### `DELETE /api/projects/:projectId/repositories/:repoId`

Delete a repository (soft delete).

**Processing**:
1. Set `is_active = false`
2. Null out GitHub token
3. Log deletion
4. Don't delete historical data (connection_tests, credentials kept for audit)

**Response** (200):
```json
{
  "repositoryId": "uuid",
  "deleted": true,
  "message": "Repository deleted (soft delete)",
  "restorable": true
}
```

---

### 2.2 Connection Testing Routes

#### `POST /api/repositories/:repoId/test-connection`

Manually trigger connection test.

**Request**:
```json
{
  "testType": "basic_connectivity" | "github_api" | "branch_verification" | "all"
}
```

**Processing**:
1. Queue background job: `testRepositoryConnection(repoId, testType)`
2. Return job ID for polling

**Response** (202):
```json
{
  "testJobId": "uuid",
  "status": "queued",
  "message": "Connection test queued",
  "estimatedDurationSeconds": 10,
  "progressUrl": "/api/repositories/uuid/test-connection/uuid"
}
```

---

#### `GET /api/repositories/:repoId/test-connection/:jobId`

Poll connection test progress.

**Response** (while running):
```json
{
  "testJobId": "uuid",
  "status": "in_progress",
  "currentTest": "github_api",
  "progress": 50
}
```

**Response** (when complete - 200):
```json
{
  "testJobId": "uuid",
  "status": "complete",
  "results": [
    {
      "testType": "basic_connectivity",
      "testStatus": "success",
      "testMessage": "Repository URL is reachable",
      "responsTimeMs": 245
    },
    {
      "testType": "github_api",
      "testStatus": "success",
      "testMessage": "GitHub API authentication successful. Tech stack auto-detected.",
      "detectedTechStack": {
        "language": "typescript",
        "framework": "react",
        "buildTool": "webpack",
        "packageManager": "npm",
        "version": "1.0.0"
      }
    },
    {
      "testType": "branch_verification",
      "testStatus": "success",
      "testMessage": "Branch 'main' exists",
      "lastCommitHash": "abc123def456",
      "lastCommitMessage": "feat: add new feature",
      "lastCommitDate": "2026-06-15T09:30:00Z"
    }
  ],
  "repositoryConnectionStatus": "connected",
  "testedAt": "2026-06-15T10:05:00Z"
}
```

**Response** (if failed - 200 with failure):
```json
{
  "testJobId": "uuid",
  "status": "complete",
  "results": [
    {
      "testType": "github_api",
      "testStatus": "failed",
      "testError": "GitHub API returned 401: Bad credentials",
      "suggestedFix": "GitHub token may have expired or been revoked. Generate a new token."
    }
  ],
  "repositoryConnectionStatus": "error"
}
```

---

#### `GET /api/repositories/:repoId/connection-history`

Get historical connection test results.

**Query Parameters**:
- `limit`: Default 10, max 50
- `offset`: For pagination

**Response**:
```json
{
  "repositoryId": "uuid",
  "connectionTests": [
    {
      "testId": "uuid",
      "testType": "all",
      "testStatus": "success",
      "testedAt": "2026-06-15T10:05:00Z",
      "testMessage": "All tests passed"
    },
    {
      "testId": "uuid",
      "testType": "basic_connectivity",
      "testStatus": "success",
      "testedAt": "2026-06-15T10:00:00Z"
    }
  ],
  "pagination": { "total": 15, "limit": 10, "offset": 0 }
}
```

---

### 2.3 Credential Management Routes

#### `POST /api/repositories/:repoId/credentials`

Update repository GitHub token.

**Request**:
```json
{
  "githubToken": "ghp_...",
  "credentialType": "github_pat"
}
```

**Processing**:
1. Validate token format
2. Encrypt token
3. Store in repository_credentials table
4. Enqueue connection test
5. Return success

**Response** (200):
```json
{
  "repositoryId": "uuid",
  "credentialType": "github_pat",
  "credentialStatus": "testing",
  "testJobId": "uuid"
}
```

---

#### `DELETE /api/repositories/:repoId/credentials/:credentialId`

Revoke a credential.

**Response** (200):
```json
{
  "repositoryId": "uuid",
  "credentialId": "uuid",
  "revoked": true
}
```

---

### 2.4 Error Handling Routes

#### Standard Error Response Format

All error responses follow this structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {
      "field": "value",
      "suggestion": "How to fix it"
    }
  },
  "timestamp": "2026-06-15T10:00:00Z",
  "requestId": "uuid"
}
```

**Example Errors**:

```json
{
  "error": {
    "code": "INVALID_GITHUB_URL",
    "message": "Repository URL must be a valid GitHub URL",
    "details": {
      "providedUrl": "https://example.com/repo",
      "expectedFormat": "https://github.com/owner/repo"
    }
  }
}
```

---

## 3. UI Screens

### 3.1 Repository Management Dashboard

**Location**: Project Settings > Repositories (or new tab)

**URL**: `/projects/:projectId/settings/repositories`

**Layout**:
```
[Project Name] > Repositories

┌─────────────────────────────────────────────────┐
│ Total Repositories: 5                            │
│ Connected: 3    Pending: 1    Error: 1          │
└─────────────────────────────────────────────────┘

┌─ [+ Register New Repository] [Settings] [Help] ──┐
│                                                   │
│ Repositories:                                     │
│                                                   │
│ ┌─────────────────────────────────────────────┐ │
│ │ web-app                    [Connected] ✓    │ │
│ │ https://github.com/.../web-app             │ │
│ │ Frontend | main | Last tested: 5 min ago   │ │
│ │ [View Details] [Test Connection] [Delete]  │ │
│ └─────────────────────────────────────────────┘ │
│                                                   │
│ ┌─────────────────────────────────────────────┐ │
│ │ api-service                [Connected] ✓    │ │
│ │ https://github.com/.../api-service         │ │
│ │ Backend | main | Last tested: 2 hours ago  │ │
│ │ [View Details] [Test Connection] [Delete]  │ │
│ └─────────────────────────────────────────────┘ │
│                                                   │
│ ┌─────────────────────────────────────────────┐ │
│ │ mobile-app                 [Error] ✗        │ │
│ │ https://github.com/.../mobile-app          │ │
│ │ Frontend | develop | Last test: ERROR      │ │
│ │ [View Details] [Update Token] [Delete]     │ │
│ └─────────────────────────────────────────────┘ │
│                                                   │
└──────────────────────────────────────────────────┘
```

**Components**:
- Summary statistics (total, connected, pending, error)
- Filter buttons (All, Connected, Error, Pending)
- Sort options (Name, Type, Last Tested)
- Repository cards with:
  - Name
  - URL
  - Type + Branch
  - Connection status badge
  - Action buttons (Details, Test, Delete)

---

### 3.2 Register New Repository Dialog

**Trigger**: Click "[+ Register New Repository]"

**Layout**:
```
┌─────────────────────────────────────────────────┐
│ Register New Repository                      [X] │
├─────────────────────────────────────────────────┤
│                                                   │
│ Repository Name *                                │
│ ┌──────────────────────────────────────────────┐ │
│ │ web-app                                      │ │
│ └──────────────────────────────────────────────┘ │
│ Required, 1-255 characters                       │
│                                                   │
│ Repository Type *                                │
│ ◉ FRONTEND   ○ BACKEND   ○ MONOREPO               │
│ ○ MICROSERVICE   ○ AUTOMATION                      │
│                                                    │
│ Repository Purpose *                               │
│ ◉ PRIMARY   ○ SECONDARY   ○ LEGACY                 │
│                                                   │
│ GitHub URL *                                     │
│ ┌──────────────────────────────────────────────┐ │
│ │ https://github.com/company/web-app          │ │
│ └──────────────────────────────────────────────┘ │
│ Must be valid GitHub URL                         │
│                                                   │
│ Branch                                           │
│ ┌──────────────────────────────────────────────┐ │
│ │ main                                         │ │
│ └──────────────────────────────────────────────┘ │
│ Default: main                                    │
│                                                   │
│ GitHub Token *                                   │
│ ┌──────────────────────────────────────────────┐ │
│ │ ghp_••••••••••••••••••••••••••••••••••••     │ │
│ └──────────────────────────────────────────────┘ │
│ Personal Access Token (Settings > Developer)     │
│ [?] How to generate a token                      │
│                                                   │
│ Description (optional)                           │
│ ┌──────────────────────────────────────────────┐ │
│ │                                              │ │
│ │                                              │ │
│ └──────────────────────────────────────────────┘ │
│ Max 1000 characters                              │
│                                                   │
│ Tags (optional)                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ [production] [critical] [+]                  │ │
│ └──────────────────────────────────────────────┘ │
│                                                   │
│                      [Cancel] [Register]         │
└─────────────────────────────────────────────────┘
```

**Validation**:
- Real-time validation of URL format
- Token validation (format check)
- Disable Register button until all required fields valid
- Show helpful error messages

**Processing**:
1. Click Register
2. Show progress: "Registering repository..."
3. After create, auto-start connection test
4. Show test progress
5. Close dialog and refresh list

---

### 3.3 Repository Details Screen

**Trigger**: Click "[View Details]" on repository card

**URL**: `/projects/:projectId/repositories/:repoId`

**Layout**:
```
┌─────────────────────────────────────────────────┐
│ web-app                            [Edit] [Delete] │
├─────────────────────────────────────────────────┤
│                                                   │
│ Connection Status: ✓ Connected                   │
│ Last Test: 5 minutes ago                         │
│                                                   │
│ [Test Connection] [Update Token] [See Test History] │
│                                                   │
│ ─── Basic Information ───                        │
│ Repository URL: https://github.com/.../web-app  │
│ Type: FRONTEND                                   │
│ Purpose: PRIMARY                                 │
│ Branch: main                                     │
│ Created: 2026-06-15 by John Doe                 │
│                                                   │
│ ─── Detected Tech Stack ───                      │
│ (Auto-detected during last connection test)     │
│ Language: TypeScript                             │
│ Framework: React                                 │
│ Build Tool: Webpack                              │
│ Package Manager: npm                             │
│ Version: 1.0.0                                   │
│                                                   │
│ ─── Analysis Status ───                          │
│ Analysis: Not Analyzed (scheduled for Sprint 2) │
│ Last Analyzed: Never                             │
│                                                   │
│ ─── Last Connection Test ───                     │
│ Basic Connectivity:    ✓ Success                 │
│ GitHub API:            ✓ Success                 │
│ Branch Verification:   ✓ Success                 │
│                                                   │
│ ─── Description ───                              │
│ Main frontend application used by customers.    │
│                                                   │
│ ─── Tags ───                                     │
│ [production] [critical]                          │
│                                                   │
└─────────────────────────────────────────────────┘
```

**Tabs** (for future):
- Overview (current view)
- Connection History
- Analysis Status (grayed out for Sprint 1)

---

### 3.4 Connection Test Dialog

**Trigger**: Click "[Test Connection]"

**During Test**:
```
┌─────────────────────────────────────────────────┐
│ Testing Connection to web-app                   │
├─────────────────────────────────────────────────┤
│                                                   │
│ ◌ Basic Connectivity        [Checking...]       │
│ ◌ GitHub API Authentication [Pending...]        │
│ ◌ Branch Verification       [Pending...]        │
│                                                   │
│ Estimated time: 5-10 seconds                     │
│                                                   │
│                              [Cancel]            │
└─────────────────────────────────────────────────┘
```

**After Success**:
```
┌─────────────────────────────────────────────────┐
│ Connection Test Results                      [X] │
├─────────────────────────────────────────────────┤
│                                                   │
│ ✓ Basic Connectivity              Success       │
│   Repository URL is reachable (245ms)            │
│                                                   │
│ ✓ GitHub API Authentication       Success       │
│   Token is valid and has proper permissions      │
│                                                   │
│ ✓ Branch Verification             Success       │
│   Branch 'main' exists                           │
│   Last commit: abc123 (6 hours ago)              │
│                                                   │
│ ✓ Tech Stack Detection            Success       │
│   Detected: TypeScript, React, Webpack           │
│                                                   │
│ Overall Status: CONNECTED ✓                      │
│ Tested: 2026-06-15 10:05:00                     │
│                                                   │
│                              [Close]             │
└─────────────────────────────────────────────────┘
```

**After Failure**:
```
┌─────────────────────────────────────────────────┐
│ Connection Test Results                      [X] │
├─────────────────────────────────────────────────┤
│                                                   │
│ ✓ Basic Connectivity              Success       │
│ ✗ GitHub API Authentication       FAILED        │
│   Error: 401 Bad credentials                     │
│   Suggestion: Your GitHub token may have expired.│
│   Generate a new token in Settings > Developer   │
│   [+ Update Token]                               │
│                                                   │
│ Overall Status: ERROR ✗                          │
│                                                   │
│ Next Steps:                                      │
│ 1. Generate a new personal access token          │
│ 2. Update token above                            │
│ 3. Test connection again                         │
│                                                   │
│                      [Update Token] [Close]      │
└─────────────────────────────────────────────────┘
```

---

### 3.5 Update Token Dialog

**Trigger**: Click "[Update Token]" on repository card or test results

**Layout**:
```
┌─────────────────────────────────────────────────┐
│ Update GitHub Token for web-app              [X] │
├─────────────────────────────────────────────────┤
│                                                   │
│ Current token:  ghp_••••••••••••••••••••••••••   │
│ Last tested: 5 minutes ago ✓                     │
│                                                   │
│ New Token *                                      │
│ ┌──────────────────────────────────────────────┐ │
│ │ ghp_                                         │ │
│ └──────────────────────────────────────────────┘ │
│                                                   │
│ [?] How to generate a token                      │
│                                                   │
│ ☐ Test new token after updating                │
│                                                   │
│                      [Cancel] [Update]           │
└─────────────────────────────────────────────────┘
```

**Processing**:
1. Encrypt new token
2. Store in repository_credentials
3. If "Test after update" checked, auto-run connection test
4. Show result (success or error)

---

### 3.6 Connection History Screen

**Trigger**: Click "[See Test History]" on repository details

**URL**: `/projects/:projectId/repositories/:repoId/connection-history`

**Layout**:
```
┌──────────────────────────────────────────────┐
│ Connection Test History for web-app           │
├──────────────────────────────────────────────┤
│                                               │
│ ┌──────────────────────────────────────────┐ │
│ │ 2026-06-15 10:05:00  ✓ All Passed        │ │
│ │ Tester: System (auto)                    │ │
│ │ [View Details]                           │ │
│ └──────────────────────────────────────────┘ │
│                                               │
│ ┌──────────────────────────────────────────┐ │
│ │ 2026-06-15 10:00:00  ✓ All Passed        │ │
│ │ Tester: John Doe                         │ │
│ │ [View Details]                           │ │
│ └──────────────────────────────────────────┘ │
│                                               │
│ ┌──────────────────────────────────────────┐ │
│ │ 2026-06-14 14:30:00  ✗ API Auth Failed  │ │
│ │ Tester: System (auto)                    │ │
│ │ [View Details]                           │ │
│ └──────────────────────────────────────────┘ │
│                                               │
│ [Load More]                                  │
└──────────────────────────────────────────────┘
```

---

## 4. Service Layer

### 4.1 CodeRepositoryService

High-level code repository management.

**Responsibilities**:
- CRUD operations
- Validation
- Credential management
- Integration with other services

**Methods**:

```
// Code Repositories
createCodeRepository(projectId, repositoryData, userId)
  → Returns: CodeRepositoryDTO
  → Validates: URL, name, type
  → Encrypts: GitHub token
  → Enqueues: Connection test job
  → Throws: ValidationException, DuplicateException

getCodeRepository(projectId, repositoryId)
  → Returns: CodeRepositoryDTO with full details
  → Throws: NotFoundException

listCodeRepositories(projectId, filters)
  → Returns: List<CodeRepositoryDTO>, pagination
  → Filters: status, type, branch
  → Supports: pagination, sorting

updateCodeRepository(projectId, repositoryId, updates)
  → Returns: CodeRepositoryDTO
  → Allowed fields: branch, description, tags, isActive
  → Throws: ValidationException, NotFoundException

deleteCodeRepository(projectId, repositoryId)
  → Returns: success/failure
  → Performs: soft delete (sets isActive=false)
  → Preserves: audit trail
```

### 4.2 CodeRepositoryConnectionService

Manages code repository connection testing and verification.

**Responsibilities**:
- Connection test orchestration
- Tech stack detection
- Error diagnosis
- Credential validation

**Methods**:

```
// Connection Testing
testConnection(repositoryId, testTypes)
  → Returns: ConnectionTestJobId
  → Async: Queues background job
  → Enqueues: testRepositoryConnectionJob

getTestResult(jobId)
  → Returns: ConnectionTestResult
  → Polls: Job status and results
  → Throws: NotFoundException, TimeoutException

getConnectionHistory(repositoryId, limit, offset)
  → Returns: List<ConnectionTestResult>, pagination
  → Ordered: DESC by timestamp
  → Includes: Error messages, tech stack detections

// Tech Stack Detection (automatic during connection test)
detectTechStack(repositoryId)
  → Returns: TechStackInfo
  → Scans: package.json, pom.xml, requirements.txt, build files, etc.
  → Detects: language, framework, build_tool, package_manager, version
  → Auto-called: During connection test, no separate API needed
  → Stored: In repositories.detected_tech_stack
  → Updated: On each successful connection test
```

### 4.3 CodeRepositoryCredentialService

Secure code repository credential management.

**Responsibilities**:
- Encryption/decryption
- Token validation
- Credential rotation
- Access control

**Methods**:

```
// Credentials
createCredential(repositoryId, credentialType, encryptedValue)
  → Returns: CredentialDTO (without plaintext)
  → Encrypts: Using application master key
  → Validates: Token format for given type
  → Throws: ValidationException

getCredential(repositoryId, credentialType)
  → Returns: Decrypted credential
  → Requires: Permission check (only in service context)
  → Logs: Access for audit trail

updateCredential(repositoryId, credentialType, newValue)
  → Returns: CredentialDTO
  → Encrypts: New value
  → Invalidates: Old cached values
  → Throws: ValidationException

deleteCredential(repositoryId, credentialId)
  → Returns: success
  → Sets: isActive = false (soft delete)
  → Triggers: New test needed

// Validation
validateGitHubToken(token)
  → Returns: boolean
  → Checks: Format, not expired, has permissions
  → Throws: ValidationException
```

### 4.4 GitHubIntegrationService

GitHub API interactions.

**Responsibilities**:
- GitHub API calls
- Authentication
- Error handling
- Rate limiting

**Methods**:

```
// Authentication
validateGitHubToken(token)
  → Makes: GET /user (API call)
  → Returns: GitHub user info (validates token)
  → Throws: GitHub authentication error

getRepositoryInfo(owner, repo, token)
  → Makes: GET /repos/:owner/:repo
  → Returns: RepoInfo (name, default branch, topics, etc)
  → Throws: RepositoryNotFoundError, GitHubError

verifyBranch(owner, repo, branch, token)
  → Makes: GET /repos/:owner/:repo/branches/:branch
  → Returns: BranchInfo
  → Throws: BranchNotFoundError

// Tech Stack Detection
detectTechStack(owner, repo, token)
  → Makes: Multiple API calls
  → Retrieves: package.json, pom.xml, .gitmodules, etc
  → Returns: TechStackInfo
  → Throws: GitHubError, ParseError

getLastCommit(owner, repo, branch, token)
  → Makes: GET /repos/:owner/:repo/commits/:branch
  → Returns: CommitInfo (hash, message, date)
  → Throws: GitHubError
```

### 4.5 Background Jobs (Job Queue)

Async operations using job queue (Bull, Resque, or Celery).

**Job 1: testRepositoryConnectionJob**

```
Input: repositoryId, testTypes[]
Steps:
  1. Load repository and credentials
  2. For each test type:
     a. Run test
     b. Store result in repository_connection_tests
  3. Update repositories.connection_status
  4. Send webhook event: repository.connection_tested
Output: ConnectionTestResult
Retry: Up to 3 times for transient errors
Timeout: 30 seconds per test
```

**Job 2: detectTechStackJob**

```
Input: repositoryId
Steps:
  1. Load repository credentials
  2. Call GitHubIntegrationService.detectTechStack()
  3. Store in repositories.detected_tech_stack
  4. Store in repositories.detected_at
Output: TechStackInfo
Retry: Up to 2 times
Timeout: 60 seconds
```

**Job 3: validateCredentialJob**

```
Input: credentialId
Steps:
  1. Load credential
  2. Decrypt credential
  3. Call GitHubIntegrationService.validateGitHubToken()
  4. If valid: Update credential.last_used_at
  5. If invalid: Mark credential as inactive
Output: Valid / Invalid
Retry: No retry
Timeout: 10 seconds
```

---

## 5. Migration Plan

### 5.1 Pre-Migration Checklist

- [ ] Backup production database
- [ ] Backup database encryption keys
- [ ] Test migration on staging environment
- [ ] Review schema with DBA
- [ ] Plan downtime (if required)
- [ ] Prepare rollback plan

### 5.2 Migration Steps

**Phase 1: Deploy Code**
1. Deploy service layer (CodeRepositoryService, etc.)
2. Deploy API routes (with feature flag disabled)
3. Deploy UI screens (with feature flag disabled)
4. No database changes yet

**Phase 2: Database Migration** (in transaction)
1. Create repositories table
2. Create repository_credentials table
3. Create repository_connection_tests table
4. Create github_oauth_tokens table
5. Alter projects table
6. Create indexes
7. Commit transaction (or rollback if error)

**Phase 3: Feature Activation**
1. Enable feature flag: `repositories_enabled = true`
2. Make API routes live
3. Deploy UI with feature visible
4. Monitor logs for errors

**Phase 4: Monitoring**
1. Watch error rates (target: <0.1%)
2. Monitor API latency
3. Check background job queue
4. Verify GitHub API integration

### 5.3 Rollback Plan (if needed)

**Automatic Rollback Triggers**:
- Error rate > 5% for 5 minutes
- API latency > 2 seconds p99
- Database connection errors
- GitHub API errors > 50%

**Manual Rollback Steps**:
1. Disable feature flag
2. Revert code deployment
3. Run rollback SQL (drops new tables)
4. Restore from backup if needed

**Rollback SQL**:
```sql
BEGIN TRANSACTION;
  DROP TABLE code_repository_connection_tests;
  DROP TABLE code_repository_credentials;
  DROP TABLE code_repositories;
  ALTER TABLE projects DROP COLUMN repositories_enabled, repository_count;
COMMIT;
```

### 5.4 Data Seeding (for testing)

Seed test data in staging:

```
Projects: 2
  └─ Repositories: 5 total
     ├─ Types: 1 FRONTEND, 1 BACKEND, 1 MONOREPO, 1 MICROSERVICE, 1 AUTOMATION
     ├─ Purposes: 3 PRIMARY, 1 SECONDARY, 1 LEGACY
     ├─ Connection Status: 3 "connected", 1 "error", 1 "not_tested"
     └─ Tech Stack: Detected for 3, null for 2

Credentials: 5 (one per repository)
  └─ Statuses: 3 active, 1 expired, 1 revoked

Connection Tests: 15 (history)
  └─ Mix of success and failure
  └─ Tech stack detection results included in 10 tests

Analysis Fields: All set to defaults
  └─ analysis_status: "not_analyzed" for all
  └─ analysis_version: 0 for all
  └─ last_analyzed_at: null for all (ready for Sprint 2)
```

---

## 6. Test Plan

### 6.1 Unit Tests

**Test Coverage Target**: > 85%

#### CodeRepositoryService Tests

```
Test Suite: CodeRepositoryService

createCodeRepository()
  ✓ Create with valid data
  ✓ Reject invalid URL
  ✓ Reject duplicate URL in same project
  ✓ Encrypt GitHub token
  ✓ Set initial connection_status to 'not_tested'
  ✓ Enqueue connection test job
  ✓ Store created_by user
  ✗ (should fail) Missing required field

getCodeRepository()
  ✓ Return code repository if exists
  ✓ Throw if not found
  ✓ Verify access control

listCodeRepositories()
  ✓ Return code repositories for project
  ✓ Filter by status
  ✓ Filter by type
  ✓ Support pagination
  ✓ Support sorting (name, date)

updateCodeRepository()
  ✓ Update allowed fields (branch, description, tags)
  ✓ Reject update of read-only fields (URL, type)
  ✓ Update updated_at timestamp
  ✓ Throw if not found

deleteCodeRepository()
  ✓ Soft delete (set isActive = false)
  ✓ Preserve audit trail
  ✓ Null out GitHub token
  ✓ Return success
```

#### CodeRepositoryConnectionService Tests

```
Test Suite: CodeRepositoryConnectionService

testConnection()
  ✓ Queue job for each test type
  ✓ Return job ID
  ✓ Handle unsupported test type

getTestResult()
  ✓ Return result if complete
  ✓ Return in-progress status if running
  ✓ Throw if job not found

getConnectionHistory()
  ✓ Return history ordered DESC
  ✓ Support pagination
  ✓ Filter by test type
  ✓ Limit to 50 results

detectTechStack()
  ✓ Detect TypeScript + React
  ✓ Detect Python + Django
  ✓ Detect Node.js + Express
  ✓ Return empty if no package files found
  ✓ Throw if repository not accessible
```

#### CodeRepositoryCredentialService Tests

```
Test Suite: CodeRepositoryCredentialService

createCredential()
  ✓ Encrypt credential using master key
  ✓ Validate GitHub token format
  ✓ Store with expiration if provided
  ✓ Prevent duplicate credential types per repo
  ✓ Throw if token invalid

getCredential()
  ✓ Decrypt credential
  ✓ Update last_used_at
  ✓ Throw if not found
  ✓ Throw if access denied

updateCredential()
  ✓ Replace with new encrypted value
  ✓ Invalidate old caches
  ✓ Preserve expiration or update

deleteCredential()
  ✓ Soft delete (set isActive = false)
  ✓ Log deletion
  ✓ Don't permanently delete
```

#### GitHubIntegrationService Tests

```
Test Suite: GitHubIntegrationService

validateGitHubToken()
  ✓ Return true for valid token
  ✓ Return false for expired token
  ✓ Return false for invalid token
  ✓ Handle GitHub API errors gracefully

getRepositoryInfo()
  ✓ Return repo info for public repo
  ✓ Return repo info for private repo (with token)
  ✓ Throw if repo not found
  ✓ Throw if token lacks permissions

verifyBranch()
  ✓ Return branch info if exists
  ✓ Throw if branch not found
  ✓ Throw if token lacks permissions

detectTechStack()
  ✓ Detect language from package.json (Node.js)
  ✓ Detect language from pom.xml (Java)
  ✓ Detect framework (React, Django, etc.)
  ✓ Return empty dict if no config found
  ✓ Handle API rate limiting

getLastCommit()
  ✓ Return commit hash and message
  ✓ Return commit date
  ✓ Throw if branch not found
```

### 6.2 Integration Tests

**Test Coverage Target**: Main workflows

#### Repository Workflow Integration Test

```
Scenario: Register → Test → Update Token → Delete

Steps:
  1. POST /api/projects/123/repositories
     Input: { name: "test-repo", url: "...", token: "ghp_..." }
     Assert: 201, repositoryId returned, status="not_tested"
     Assert: Connection test job enqueued

  2. Wait for background job
     Poll: GET /api/repositories/uuid/test-connection/jobId
     Assert: Eventually completes with success

  3. GET /api/projects/123/repositories/uuid
     Assert: connectionStatus="connected"
     Assert: detectedTechStack populated

  4. PATCH /api/projects/123/repositories/uuid
     Input: { branch: "develop" }
     Assert: 200, updated

  5. POST /api/repositories/uuid/credentials
     Input: { githubToken: "ghp_new_..." }
     Assert: 200, auto-test runs
     Assert: New token validated

  6. DELETE /api/projects/123/repositories/uuid
     Assert: 200, soft deleted
     Assert: Connection tests still retrievable

Result: Full lifecycle works end-to-end
```

#### GitHub Integration Test

```
Scenario: Connect to real GitHub API and test

Steps:
  1. Create test repository registration
     Input: { url: "https://github.com/facebook/react", token: "ghp_..." }

  2. Run connection test
     Assert: Basic connectivity passes
     Assert: GitHub API auth passes
     Assert: Branch verification passes
     Assert: Tech stack detected (should find React, JavaScript, etc)

  3. Update with invalid token
     Input: { githubToken: "ghp_invalid" }
     Assert: Test fails gracefully
     Assert: Error message is helpful

  4. Clean up
     Delete repository

Result: GitHub integration works correctly
```

### 6.3 API Tests

**Tool**: Jest + Supertest (or equivalent)

```
Test Suite: POST /api/projects/:projectId/repositories

✓ Register with valid data → 201
✓ Register with invalid URL → 400
✓ Register with duplicate URL → 400
✓ Register without auth → 401
✓ Register without access to project → 403
✓ Register with missing required field → 400

Test Suite: GET /api/projects/:projectId/repositories

✓ List repositories → 200, with pagination
✓ Filter by status → 200
✓ Filter by type → 200
✓ Sort by name → 200
✓ Without auth → 401
✓ Without project access → 403

Test Suite: POST /api/repositories/:repoId/test-connection

✓ Trigger test → 202, jobId returned
✓ Invalid testType → 400
✓ Repository not found → 404
✓ Without auth → 401

Test Suite: GET /api/repositories/:repoId/test-connection/:jobId

✓ In-progress → 200, { status: "in_progress" }
✓ Complete (success) → 200, { status: "complete", results }
✓ Complete (failure) → 200, { status: "complete", results with errors }
✓ Job not found → 404
```

### 6.4 UI Tests

**Tool**: Cypress or Playwright

```
Test Suite: Repository Management Dashboard

✓ Load dashboard → Shows repositories
✓ Filter repositories → Works correctly
✓ Sort repositories → Works correctly
✓ Register new → Opens dialog, validates, creates
✓ Delete repository → Soft deletes, shows confirmation
✓ View details → Shows repository info

Test Suite: Register Repository Dialog

✓ Show dialog → All fields empty
✓ Real-time validation → Highlights errors
✓ Submit valid form → Calls API, shows progress
✓ Submit invalid form → Shows errors, disable button
✓ Close dialog → Discards changes

Test Suite: Connection Test

✓ Start test → Shows progress
✓ Complete (success) → Shows all checks passed
✓ Complete (failure) → Shows error, suggests fix
✓ Update token → Calls API, re-tests

Test Suite: Responsive Design

✓ Desktop layout → Full UI visible
✓ Tablet layout → Adjusted spacing
✓ Mobile layout → Stacked, scrollable
```

### 6.5 Security Tests

```
Test Suite: Credential Encryption

✓ Token encrypted in database
  Verify: SELECT github_token FROM repository_credentials
  Assert: Value is encrypted (not plaintext "ghp_...")

✓ Token never logged
  Verify: Application logs don't contain "ghp_"
  Verify: No "ghp_" in error messages

✓ Token decrypted only in service layer
  Verify: API responses never include plaintext token
  Verify: API responses include masked token (ghp_••••)

Test Suite: Access Control

✓ User can only manage repositories in their projects
  Test: User A cannot see/edit User B's repositories
  Test: Non-admin cannot register repo in foreign project

✓ Credential operations require authentication
  Test: GET /credentials without auth → 401
  Test: POST /credentials without auth → 401

Test Suite: SQL Injection Prevention

✓ Repository name sanitized
  Input: "test'; DROP TABLE repositories; --"
  Assert: Safely stored as literal string

✓ GitHub URL sanitized
  Input: "javascript:alert('xss')"
  Assert: Validation fails (not valid GitHub URL)
```

### 6.6 Error Scenario Tests

```
Test Suite: GitHub API Errors

✓ GitHub API down → 502 error, retry job, alert admin
✓ Token expired → 401 error, mark credential inactive, notify user
✓ Rate limit hit → 429 error, back off, retry later
✓ Repository not found → 404 error, suggest checking URL
✓ No permissions → 403 error, suggest scope in token

Test Suite: Database Errors

✓ Duplicate repository → 400 error, duplicate URL
✓ Foreign key violation → 500 error, log and alert

Test Suite: Job Queue Errors

✓ Job timeout → Fail after 30 seconds, log error
✓ Job max retries → Stop after 3 attempts, mark as failed
✓ Job crash → Catch exception, log, mark as failed
```

### 6.7 Load Tests

**Tool**: k6 or Apache JMeter

```
Test: Register Repositories (Spike Test)

Scenario:
  - Ramp up: 0 → 100 concurrent requests over 1 minute
  - Sustain: 100 concurrent for 5 minutes
  - Ramp down: 100 → 0 over 1 minute

Targets:
  - p95 latency: < 1 second
  - Error rate: < 0.1%
  - Throughput: > 10 req/sec

Test: Connection Test (Long Running)

Scenario:
  - 50 parallel repositories
  - Each with background connection test
  - Test takes ~10 seconds each

Targets:
  - No queue backlog
  - Successful completion of all tests
  - No database connection pool exhaustion
```

### 6.8 Test Execution Plan

**Local Development**:
- `npm run test:unit` → Run all unit tests
- `npm run test:integration` → Run integration tests
- `npm run test:api` → Run API tests
- `npm run test` → Run all tests

**CI/CD Pipeline**:
- Run on every commit
- Run on PR
- Run before merge to main
- Minimum 85% coverage required

**Manual QA**:
- UI tests (manually run Cypress tests)
- End-to-end workflow testing
- GitHub API integration (with test token)
- Browser compatibility (Chrome, Firefox, Safari, Edge)

---

## 7. Implementation Checklist

### Week 1: Core Implementation

- [ ] Create migration files
- [ ] Implement CodeRepositoryService
- [ ] Implement CodeRepositoryConnectionService
- [ ] Implement CodeRepositoryCredentialService
- [ ] Implement GitHubIntegrationService
- [ ] Implement background jobs
- [ ] Write unit tests (>85% coverage)

### Week 2: API & UI

- [ ] Implement API routes (CRUD)
- [ ] Implement connection test routes
- [ ] Implement UI dashboard
- [ ] Implement registration dialog
- [ ] Implement details screen
- [ ] Implement test dialog
- [ ] Write integration tests
- [ ] Write API tests
- [ ] Write UI tests (Cypress)

### Final Days: Polish & Deploy

- [ ] Security audit
- [ ] Load testing
- [ ] Documentation
- [ ] Staging deployment
- [ ] Production deployment
- [ ] Monitoring setup

---

## 8. Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| GitHub API rate limiting | High | Medium | Implement cache, exponential backoff |
| Token expiration | High | Medium | Add token validity check, auto-refresh |
| Database migration failure | Low | Critical | Test on staging, have rollback plan |
| Credential encryption key loss | Very Low | Critical | Backup keys, use key versioning |
| Background job failure | Medium | Medium | Retry logic, DLQ, alerting |
| Tech stack detection errors | Medium | Low | Graceful degradation, manual override |

---

## 9. Success Criteria

✅ **Definition of Done**:
1. All unit tests passing (>85% coverage)
2. All integration tests passing
3. All API tests passing
4. All UI tests passing (Cypress)
5. Security tests passing
6. Load tests passing (p95 < 1s, <0.1% error)
7. Code review approved
8. Documentation complete
9. Deployed to staging
10. Tested in staging by QA team

✅ **Acceptance Criteria**:
- Users can register FE/BE repositories
- GitHub connection can be tested
- Tech stack is auto-detected
- Users can update credentials
- Connection history is visible
- UI is responsive and user-friendly
- No plaintext tokens in logs or responses
- All APIs secured with authentication

---

## 10. Deliverables Summary

| Deliverable | Status | Owner |
|------------|--------|-------|
| Database schema + migrations | Design | Backend Lead |
| Repository Service | Code | Backend |
| Connection Service | Code | Backend |
| Credential Service | Code | Backend |
| GitHub Integration | Code | Backend |
| API routes (11 endpoints) | Code | Backend |
| API tests | Test | Backend |
| Repository Dashboard | Code | Frontend |
| Register Dialog | Code | Frontend |
| Details Screen | Code | Frontend |
| Test Dialog | Code | Frontend |
| UI tests (Cypress) | Test | Frontend |
| Unit tests | Test | QA / Backend |
| Integration tests | Test | QA |
| Security audit | Review | Security |
| Load tests | Performance | QA |
| Documentation | Docs | Tech Lead |
| Deployment guide | Docs | DevOps |

---

**Sprint 1 Status**: Ready for Implementation  
**Next Sprint**: Repository Analysis (Sprint 2)  
**Date**: 2026-06-15

