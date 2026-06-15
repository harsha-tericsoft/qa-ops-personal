# Sprint 1: File-by-File Implementation Plan

**Status**: Design Review - Awaiting Approval  
**Date**: 2026-06-15  

---

## Overview

This document maps every file that needs to be created or modified for Sprint 1: Repository Registration. It shows the exact structure, dependencies, and implementation order.

**Total Files to Create/Modify**: ~25 files across backend and frontend  
**Database Tables**: 3 new tables + 1 schema alteration  
**API Endpoints**: 11 new endpoints  
**Services**: 5 new services  
**UI Components**: 6 new screens  

---

## 1. Database & Prisma Changes

### 1.1 Prisma Schema File

**Path**: `prisma/schema.prisma`

**Changes** (additions only):

```prisma
// ============================================================================
// ENUMS - New types for repositories
// ============================================================================

enum RepositoryType {
  FRONTEND
  BACKEND
  MONOREPO
  MICROSERVICE
  AUTOMATION
}

enum RepositoryPurpose {
  PRIMARY
  SECONDARY
  LEGACY
}

enum ConnectionStatus {
  not_tested
  connected
  error
  token_expired
}

enum AnalysisStatus {
  not_analyzed
  analyzing
  analyzed
  error
}

// ============================================================================
// MODELS - New repository management
// ============================================================================

model CodeRepository {
  id              String   @id @default(uuid())
  
  // Relationships
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId       String
  credentials     CodeRepositoryCredential[]
  connectionTests CodeRepositoryConnectionTest[]
  
  // Core Fields
  name            String
  url             String
  type            RepositoryType
  purpose         RepositoryPurpose @default(PRIMARY)
  branch          String @default("main")
  
  // Tech Stack (auto-detected during connection test)
  detectedTechStack Json?
  detectedAt      DateTime?
  
  // Connection Status
  connectionStatus     ConnectionStatus @default(not_tested)
  lastConnectionTestAt DateTime?
  lastConnectionTestError String?
  
  // Analysis Status (for future Sprint 2)
  analysisStatus      AnalysisStatus @default(not_analyzed)
  analysisVersion     Int @default(0)
  lastAnalyzedAt      DateTime?
  
  // Metadata
  description     String?
  tags            String[]
  isActive        Boolean @default(true)
  
  // Audit
  createdBy       String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Unique constraints
  @@unique([projectId, url])
  @@index([projectId])
  @@index([connectionStatus])
  @@index([type])
  @@index([purpose])
  @@index([createdAt])
}

model CodeRepositoryCredential {
  id              String   @id @default(uuid())
  
  // Relationships
  codeRepository  CodeRepository @relation(fields: [codeRepositoryId], references: [id], onDelete: Cascade)
  codeRepositoryId String
  
  // Credential Storage (encrypted at application level)
  credentialType  String  // github_pat (OAuth deferred)
  encryptedValue  String  // Encrypted GitHub token
  encryptionAlgorithm String? // AES-256-GCM
  encryptionKeyId String?  // For key rotation
  
  // Status
  isActive        Boolean @default(true)
  lastUsedAt      DateTime?
  expiresAt       DateTime?
  
  // Audit
  createdAt       DateTime @default(now())
  
  // Unique constraint
  @@unique([repositoryId, credentialType])
  @@index([repositoryId])
  @@index([expiresAt])
}

model CodeRepositoryConnectionTest {
  id              String   @id @default(uuid())
  
  // Relationships
  codeRepository  CodeRepository @relation(fields: [codeRepositoryId], references: [id], onDelete: Cascade)
  codeRepositoryId String
  
  // Test Details
  testType        String  // basic_connectivity, github_api, branch_verification, tech_stack_detection
  testStatus      String  // success, failed, pending
  testMessage     String?
  testError       String?
  
  // Results
  responseTimeMs  Int?
  testedBy        String?  // user ID or "system"
  
  // Audit
  createdAt       DateTime @default(now())
  
  @@index([repositoryId, createdAt])
  @@index([testStatus])
}

// ============================================================================
// ALTER Project Model (add repository metadata)
// ============================================================================

// Add to existing Project model:
//   repositoriesEnabled: Boolean @default(false)
//   repositoryCount:     Int @default(0)
//   lastRepositoryAddedAt: DateTime?
```

**Notes**:
- JSON storage for `detectedTechStack`: `{language, framework, buildTool, packageManager, version}`
- All string fields for enums (not strict Prisma enums) for flexibility
- Credential encryption handled at application layer, not database
- No OAuth tokens stored in Sprint 1

### 1.2 Migration File

**Path**: `prisma/migrations/{timestamp}_add_repositories/migration.sql`

```sql
-- Create enums (PostgreSQL specific)
CREATE TYPE "RepositoryType" AS ENUM ('FRONTEND', 'BACKEND', 'MONOREPO', 'MICROSERVICE', 'AUTOMATION');
CREATE TYPE "RepositoryPurpose" AS ENUM ('PRIMARY', 'SECONDARY', 'LEGACY');
CREATE TYPE "ConnectionStatus" AS ENUM ('not_tested', 'connected', 'error', 'token_expired');
CREATE TYPE "AnalysisStatus" AS ENUM ('not_analyzed', 'analyzing', 'analyzed', 'error');

-- Create repositories table
CREATE TABLE "Repository" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "type" "RepositoryType" NOT NULL,
  "purpose" "RepositoryPurpose" NOT NULL DEFAULT 'PRIMARY',
  "branch" TEXT NOT NULL DEFAULT 'main',
  "detectedTechStack" JSONB,
  "detectedAt" TIMESTAMP(3),
  "connectionStatus" "ConnectionStatus" NOT NULL DEFAULT 'not_tested',
  "lastConnectionTestAt" TIMESTAMP(3),
  "lastConnectionTestError" TEXT,
  "analysisStatus" "AnalysisStatus" NOT NULL DEFAULT 'not_analyzed',
  "analysisVersion" INTEGER NOT NULL DEFAULT 0,
  "lastAnalyzedAt" TIMESTAMP(3),
  "description" TEXT,
  "tags" TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Repository_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "Repository_projectId_url_key" ON "Repository"("projectId", "url");
CREATE INDEX "Repository_projectId_idx" ON "Repository"("projectId");
CREATE INDEX "Repository_connectionStatus_idx" ON "Repository"("connectionStatus");
CREATE INDEX "Repository_type_idx" ON "Repository"("type");
CREATE INDEX "Repository_purpose_idx" ON "Repository"("purpose");
CREATE INDEX "Repository_createdAt_idx" ON "Repository"("createdAt" DESC);

-- Create repository_credentials table
CREATE TABLE "RepositoryCredential" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "repositoryId" TEXT NOT NULL,
  "credentialType" TEXT NOT NULL,
  "encryptedValue" TEXT NOT NULL,
  "encryptionAlgorithm" TEXT,
  "encryptionKeyId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastUsedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RepositoryCredential_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "RepositoryCredential_repositoryId_credentialType_key" ON "RepositoryCredential"("repositoryId", "credentialType");
CREATE INDEX "RepositoryCredential_repositoryId_idx" ON "RepositoryCredential"("repositoryId");
CREATE INDEX "RepositoryCredential_expiresAt_idx" ON "RepositoryCredential"("expiresAt");

-- Create repository_connection_tests table
CREATE TABLE "RepositoryConnectionTest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "repositoryId" TEXT NOT NULL,
  "testType" TEXT NOT NULL,
  "testStatus" TEXT NOT NULL,
  "testMessage" TEXT,
  "testError" TEXT,
  "responseTimeMs" INTEGER,
  "testedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RepositoryConnectionTest_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository" ("id") ON DELETE CASCADE
);

CREATE INDEX "RepositoryConnectionTest_repositoryId_createdAt_idx" ON "RepositoryConnectionTest"("repositoryId", "createdAt" DESC);
CREATE INDEX "RepositoryConnectionTest_testStatus_idx" ON "RepositoryConnectionTest"("testStatus");

-- Alter Project table
ALTER TABLE "Project" ADD COLUMN "repositoriesEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "repositoryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Project" ADD COLUMN "lastRepositoryAddedAt" TIMESTAMP(3);
```

---

## 2. Backend: API Routes

### 2.1 File Structure

```
src/
├── routes/
│   ├── index.ts                          (existing, register new router)
│   └── codeRepositories/
│       ├── index.ts                      (new, main router)
│       ├── crud.routes.ts                (new, CRUD endpoints)
│       ├── connection.routes.ts          (new, connection test endpoints)
│       └── credentials.routes.ts         (new, credential endpoints)
├── controllers/
│   └── codeRepositories/
│       ├── codeRepository.controller.ts  (new, CRUD logic)
│       ├── connection.controller.ts      (new, connection test logic)
│       └── credential.controller.ts      (new, credential logic)
├── middleware/
│   ├── auth.middleware.ts                (existing, add code repository permission check)
│   └── validation.middleware.ts          (new or extend, code repository validation)
└── types/
    └── codeRepositories/
        ├── codeRepository.types.ts       (new, TypeScript types/DTOs)
        └── request.types.ts              (new, request body types)
```

### 2.2 Routes: Main Router

**File**: `src/routes/codeRepositories/index.ts`

```
Purpose: Entry point for all code repository routes
Exports: Express router with sub-routers mounted

Structure:
  - GET   /api/projects/:projectId/repositories              → list repositories
  - POST  /api/projects/:projectId/repositories              → create repository
  - GET   /api/projects/:projectId/repositories/:repoId      → get single
  - PATCH /api/projects/:projectId/repositories/:repoId      → update
  - DELETE /api/projects/:projectId/repositories/:repoId     → delete
  
  - POST  /api/repositories/:repoId/test-connection          → start test
  - GET   /api/repositories/:repoId/test-connection/:jobId   → poll test
  - GET   /api/repositories/:repoId/connection-history       → get history
  
  - POST  /api/repositories/:repoId/credentials              → update token
  - DELETE /api/repositories/:repoId/credentials/:credId     → delete credential

Dependencies:
  - Express (router, middleware)
  - Controllers (CRUD, Connection, Credential)
  - Auth middleware
  - Validation middleware
```

### 2.3 Routes: CRUD Endpoints

**File**: `src/routes/codeRepositories/crud.routes.ts`

```
Exports: Sub-router for code repository CRUD

POST /projects/:projectId/repositories
  - Request body: {repositoryName, repositoryUrl, repositoryType, repositoryPurpose, branch, githubToken, description}
  - Response: 201, RepositoryDTO
  - Middleware: authRequired, projectMemberRequired, validateRepositoryCreate

GET /projects/:projectId/repositories
  - Query: status, type, limit, offset, sort, order
  - Response: 200, {repositories[], pagination}
  - Middleware: authRequired, projectMemberRequired

GET /projects/:projectId/repositories/:repoId
  - Response: 200, RepositoryDTO (full details)
  - Middleware: authRequired, repositoryAccessRequired

PATCH /projects/:projectId/repositories/:repoId
  - Request body: {branch?, description?, repositoryPurpose?, tags?, isActive?}
  - Response: 200, {repositoryId, updated, updatedFields}
  - Middleware: authRequired, repositoryEditRequired, validateRepositoryUpdate

DELETE /projects/:projectId/repositories/:repoId
  - Response: 200, {repositoryId, deleted, message}
  - Middleware: authRequired, repositoryDeleteRequired
```

### 2.4 Routes: Connection Test Endpoints

**File**: `src/routes/codeRepositories/connection.routes.ts`

```
Exports: Sub-router for connection testing for code repositories

POST /repositories/:repoId/test-connection
  - Request body: {testType: "basic_connectivity" | "github_api" | "branch_verification" | "all"}
  - Response: 202, {testJobId, status, estimatedDurationSeconds}
  - Middleware: authRequired, repositoryAccessRequired
  - Action: Enqueue background job, return job ID

GET /repositories/:repoId/test-connection/:jobId
  - Response: 200, {testJobId, status, results[], progress}
  - Response (in progress): {testJobId, status: "in_progress", progress: N}
  - Response (complete): {testJobId, status: "complete", results: [{testType, testStatus, testMessage, detectedTechStack}]}
  - Middleware: authRequired, repositoryAccessRequired
  - Action: Poll job queue, return current results

GET /repositories/:repoId/connection-history
  - Query: limit (default 10, max 50), offset
  - Response: 200, {connectionTests: [{testId, testType, testStatus, testedAt, testMessage}], pagination}
  - Middleware: authRequired, repositoryAccessRequired
```

### 2.5 Routes: Credential Endpoints

**File**: `src/routes/codeRepositories/credentials.routes.ts`

```
Exports: Sub-router for credential management for code repositories

POST /repositories/:repoId/credentials
  - Request body: {githubToken}
  - Response: 200, {repositoryId, credentialType, credentialStatus: "testing", testJobId}
  - Middleware: authRequired, repositoryEditRequired, validateGitHubToken
  - Action: Encrypt token, store, enqueue connection test

DELETE /repositories/:repoId/credentials/:credentialId
  - Response: 200, {repositoryId, credentialId, revoked}
  - Middleware: authRequired, repositoryEditRequired
  - Action: Soft delete credential
```

---

## 3. Backend: Services

### 3.1 Service Layer Structure

```
src/
└── services/
    ├── codeRepositories/
    │   ├── codeRepository.service.ts     (new, main CRUD service)
    │   ├── connection.service.ts         (new, connection testing)
    │   ├── credential.service.ts         (new, credential management)
    │   ├── github.service.ts             (new, GitHub API integration)
    │   ├── tech-stack.service.ts         (new, tech stack detection)
    │   └── index.ts                      (new, export all services)
    ├── jobs/
    │   ├── test-connection.job.ts        (new, background job)
    │   └── detect-tech-stack.job.ts      (new, background job)
    └── encryption/
        └── credential-encryption.service.ts (new or extend, crypto operations)
```

### 3.2 CodeRepositoryService

**File**: `src/services/codeRepositories/codeRepository.service.ts`

```
Purpose: Main CRUD operations for code repositories

Methods (implementation details only):

createRepository(projectId, repositoryData, userId)
  - Validate: projectExists, userHasAccess, urlNotDuplicate
  - Encrypt: GitHub token with app key
  - Create: Repository record with connection_status = "not_tested"
  - Enqueue: testRepositoryConnectionJob(repositoryId)
  - Return: RepositoryDTO

getRepository(projectId, repositoryId)
  - Fetch: From database
  - Check: User has access
  - Return: RepositoryDTO (full details)

listRepositories(projectId, filters)
  - Query: Repositories for project
  - Apply: Filters (status, type, purpose)
  - Sort: By requested field
  - Paginate: limit, offset
  - Return: List<RepositoryDTO>, pagination

updateRepository(projectId, repositoryId, updates)
  - Validate: Only allowed fields can be updated
  - Check: User has edit access
  - Update: Repository record
  - Return: {repositoryId, updated, updatedFields}

deleteRepository(projectId, repositoryId)
  - Check: User has delete access
  - Soft delete: Set isActive = false
  - Null: GitHub token
  - Return: success

Dependencies:
  - Prisma client
  - CredentialService (for token encryption)
  - Job queue
  - Logger
```

### 3.3 CodeRepositoryConnectionService

**File**: `src/services/codeRepositories/connection.service.ts`

```
Purpose: Connection testing and verification for code repositories

Methods:

testConnection(repositoryId, testTypes)
  - Load: Repository and credentials
  - Decrypt: GitHub token
  - Enqueue: Background job with testTypes
  - Return: {testJobId, status: "queued"}

getTestResult(jobId)
  - Poll: Job queue for job status
  - Return: Result with status and details

getConnectionHistory(repositoryId, limit, offset)
  - Query: RepositoryConnectionTest table
  - Order: DESC by timestamp
  - Paginate: limit, offset
  - Return: List<ConnectionTestResult>, pagination

Dependencies:
  - Job queue (for polling)
  - Prisma client
  - Logger
```

### 3.4 CodeRepositoryCredentialService

**File**: `src/services/codeRepositories/credential.service.ts`

```
Purpose: Secure credential management for code repositories

Methods:

createCredential(repositoryId, credentialType, plaintext)
  - Validate: Token format for type
  - Encrypt: Using CredentialEncryptionService
  - Store: In RepositoryCredential table
  - Return: CredentialDTO (masked)

getCredential(repositoryId, credentialType)
  - Load: From RepositoryCredential table
  - Decrypt: Using CredentialEncryptionService
  - Update: lastUsedAt timestamp
  - Return: Decrypted credential (string)

updateCredential(repositoryId, credentialType, newValue)
  - Validate: Token format
  - Encrypt: New value
  - Update: Record
  - Invalidate: Old cached values
  - Return: CredentialDTO (masked)

deleteCredential(repositoryId, credentialId)
  - Soft delete: Set isActive = false
  - Return: success

Dependencies:
  - CredentialEncryptionService
  - Prisma client
  - Logger
```

### 3.5 GitHubIntegrationService

**File**: `src/services/codeRepositories/github.service.ts`

```
Purpose: GitHub API interactions

Methods:

validateGitHubToken(token)
  - Call: GitHub API GET /user
  - Return: {valid: boolean, userName?: string}
  - Throw: GitHubAPIError if fails

getRepositoryInfo(owner, repo, token)
  - Call: GitHub API GET /repos/:owner/:repo
  - Return: {name, defaultBranch, topics, language}
  - Throw: GitHubAPIError

verifyBranch(owner, repo, branch, token)
  - Call: GitHub API GET /repos/:owner/:repo/branches/:branch
  - Return: {exists: boolean, lastCommit?: CommitInfo}
  - Throw: GitHubAPIError

getFileContents(owner, repo, path, branch, token)
  - Call: GitHub API GET /repos/:owner/:repo/contents/:path
  - Return: {content: string}
  - Throw: GitHubAPIError

getLastCommit(owner, repo, branch, token)
  - Call: GitHub API GET /repos/:owner/:repo/commits/:branch
  - Return: {hash, message, date}
  - Throw: GitHubAPIError

Dependencies:
  - @octokit/rest (or similar GitHub SDK)
  - Logger
  - Error handlers
```

### 3.6 TechStackService

**File**: `src/services/codeRepositories/tech-stack.service.ts`

```
Purpose: Automatic tech stack detection

Methods:

detectTechStack(owner, repo, branch, token)
  - Call: GitHubIntegrationService.getFileContents() for multiple files
  - Scan: package.json, pom.xml, requirements.txt, setup.py, build.gradle, etc.
  - Parse: Each file based on format
  - Extract: language, framework, buildTool, packageManager, version
  - Return: {language, framework, buildTool, packageManager, version}

parsePackageJson(content)
  - Parse: JSON
  - Extract: dependencies, devDependencies, package.json name/version
  - Return: {framework, buildTool, packageManager}

parsePomXml(content)
  - Parse: XML
  - Extract: groupId, artifactId, version, dependencies
  - Return: {language: "java", framework, buildTool}

parsePythonFiles(requirementsContent, setupPyContent)
  - Parse: requirements.txt and/or setup.py
  - Extract: framework, dependencies
  - Return: {language: "python", framework, packageManager}

Dependencies:
  - GitHubIntegrationService
  - XML parser
  - JSON parser
  - Logger
```

### 3.7 Background Jobs

**File**: `src/services/jobs/test-connection.job.ts`

```
Purpose: Background job for connection testing (Bull queue)

Triggers from:
  - RepositoryConnectionService.testConnection()
  - CredentialService.updateCredential()

Execution steps:
  1. Load repository and decrypt credentials
  2. For each testType in requested list:
     a. Call GitHubIntegrationService.validateGitHubToken()
     b. Store test result in RepositoryConnectionTest
     c. If github_api test, call TechStackService.detectTechStack()
  3. Update repository.connectionStatus based on results
  4. Update repository.detectedTechStack if tech stack found
  5. Update repository.detectedAt timestamp
  6. Emit webhook event: repository.connection_tested
  7. Return: Complete ConnectionTestResult

Error handling:
  - Retry: Up to 3 times for transient errors (network timeout)
  - DLQ: Send to dead letter queue if max retries exceeded
  - Logging: Log all results and errors

Dependencies:
  - Bull job queue
  - GitHubIntegrationService
  - TechStackService
  - Prisma client
  - Logger
  - Event emitter
```

**File**: `src/services/jobs/detect-tech-stack.job.ts`

```
Purpose: Standalone tech stack detection job

Triggers from:
  - Background job if tech stack detection needed

Execution:
  1. Load repository
  2. Decrypt credentials
  3. Call TechStackService.detectTechStack()
  4. Update repository.detectedTechStack
  5. Update repository.detectedAt
  6. Return: TechStackInfo

Error handling:
  - Retry: Up to 2 times
  - Log errors, continue (non-blocking)
```

---

## 4. Frontend: UI Changes

### 4.1 UI Component Structure

```
src/
└── components/
    ├── codeRepositories/
    │   ├── CodeRepositoryDashboard.tsx          (new, main list)
    │   ├── CodeRepositoryCard.tsx               (new, list item)
    │   ├── RegisterCodeRepositoryDialog.tsx     (new, form dialog)
    │   ├── CodeRepositoryDetailsScreen.tsx      (new, detail view)
    │   ├── CodeRepositoryConnectionTestDialog.tsx (new, test flow)
    │   ├── UpdateCodeRepositoryTokenDialog.tsx  (new, token update)
    │   ├── CodeRepositoryConnectionHistoryScreen.tsx (new, history view)
    │   ├── CodeRepositoryTypeSelect.tsx         (new, form component)
    │   └── CodeRepositoryPurposeSelect.tsx      (new, form component)
    │
    ├── shared/
    │   └── StatusBadge.tsx                      (new or extend, status indicator)
    │
    └── pages/
        └── project/
            └── [projectId]/
                ├── settings/
                │   └── codeRepositories.tsx    (new, page)
                └── codeRepositories/
                    ├── index.tsx                (new, list page)
                    └── [repoId].tsx             (new, detail page)
```

### 4.2 Pages

**File**: `src/pages/project/[projectId]/settings/codeRepositories.tsx`

```
Purpose: Code repository management from project settings

Content:
  - Summary stats: Total, Connected, Pending, Error
  - Filter buttons: All, Connected, Error, Pending
  - Sort options
  - Code repository cards (scrollable list)
  - "Register New Code Repository" button → Opens RegisterCodeRepositoryDialog
  - Each card shows: Name, URL, Type, Branch, Status, Last Tested
  - Card actions: View Details, Test Connection, Delete

State management:
  - useQuery: List code repositories for project
  - useInfiniteQuery: Pagination
  - Modal state: registerDialog open/close
  - Selected filters and sort

Dependencies:
  - React Query
  - Zustand (state)
  - CodeRepositoryCard component
  - RegisterCodeRepositoryDialog component
  - StatusBadge component
```

**File**: `src/pages/project/[projectId]/codeRepositories/index.tsx`

```
Purpose: Code repository list view (alternative location)

Same as settings/codeRepositories.tsx but as separate page
```

**File**: `src/pages/project/[projectId]/codeRepositories/[repoId].tsx`

```
Purpose: Code repository detail view

Content:
  - Connection status badge + Last test time
  - [Test Connection] [Update Token] [See Test History]
  - Basic Information section
  - Detected Tech Stack section
  - Last Connection Test section
  - Description section
  - Tags section

State management:
  - useQuery: Get code repository details
  - useQuery: Get last connection test
  - Modal states: test dialog, update token dialog

Dependencies:
  - React Query
  - CodeRepositoryDetailsScreen component
  - CodeRepositoryConnectionTestDialog component
  - UpdateCodeRepositoryTokenDialog component
```

### 4.3 Components

**File**: `src/components/codeRepositories/CodeRepositoryDashboard.tsx`

```
Purpose: Main code repository list with filters and actions

Props:
  - projectId: string
  - codeRepositories: CodeRepository[]
  - isLoading: boolean
  - onRegisterClick: () => void
  - onTestClick: (repoId) => void
  - onDeleteClick: (repoId) => void

State:
  - filters: {status?, type?, purpose?}
  - sort: {field, order}
  - pagination: {limit, offset}

Renders:
  - Summary statistics
  - Filter buttons
  - Sort dropdown
  - CodeRepositoryCard list
  - "Register New" button
  - Loading/empty states

Dependencies:
  - CodeRepositoryCard
  - StatusBadge
  - React Query
```

**File**: `src/components/codeRepositories/RegisterCodeRepositoryDialog.tsx`

```
Purpose: Form to register new code repository

Props:
  - projectId: string
  - onClose: () => void
  - onSuccess: (repo: Repository) => void

Form fields:
  - Repository Name (required, text)
  - Repository Type (required, radio: FRONTEND/BACKEND/MONOREPO/MICROSERVICE/AUTOMATION)
  - Repository Purpose (optional, radio: PRIMARY/SECONDARY/LEGACY)
  - GitHub URL (required, text, validate format)
  - Branch (optional, text, default: main)
  - GitHub Token (required, password, validate format)
  - Description (optional, textarea)
  - Tags (optional, chip input)

Validation:
  - Real-time validation of each field
  - Disable submit if errors
  - Show helpful error messages

Submit:
  - POST /api/projects/:projectId/repositories
  - Show loading state
  - On success: Close dialog, refresh list
  - On error: Show error message

Dependencies:
  - React Hook Form
  - Zod validation
  - React Query mutations
  - CodeRepositoryTypeSelect
  - CodeRepositoryPurposeSelect
```

**File**: `src/components/codeRepositories/CodeRepositoryDetailsScreen.tsx`

```
Purpose: Full detail view of a code repository

Props:
  - projectId: string
  - repositoryId: string
  - onBack: () => void

Content sections:
  1. Header with status badge, last tested, action buttons
  2. Basic Information (URL, Type, Purpose, Branch, Created)
  3. Detected Tech Stack (Language, Framework, Build Tool, Package Manager)
  4. Last Connection Test Results
  5. Description
  6. Tags
  7. Analysis Status (read-only for Sprint 1)

Modals:
  - CodeRepositoryConnectionTestDialog (on test click)
  - UpdateCodeRepositoryTokenDialog (on update token click)
  - CodeRepositoryConnectionHistoryScreen (on history click)

Dependencies:
  - React Query
  - CodeRepositoryConnectionTestDialog
  - UpdateCodeRepositoryTokenDialog
  - CodeRepositoryConnectionHistoryScreen
  - StatusBadge
```

**File**: `src/components/codeRepositories/CodeRepositoryConnectionTestDialog.tsx`

```
Purpose: Execute and display code repository connection test results

Props:
  - repositoryId: string
  - onClose: () => void

States:
  1. Initial: Show test type selector, start button
  2. In Progress: Show progress indicator with current test
  3. Complete Success: Show all passed tests, tech stack if detected
  4. Complete Failure: Show failed tests with error messages and suggestions

Test types available:
  - Basic Connectivity
  - GitHub API
  - Branch Verification
  - All (recommended)

Polling:
  - Start test: POST /api/repositories/:repoId/test-connection
  - Poll: GET /api/repositories/:repoId/test-connection/:jobId (every 2 seconds)
  - Stop: When status === "complete"

Dependencies:
  - React Query
  - Polling logic
  - StatusBadge
```

**File**: `src/components/codeRepositories/CodeRepositoryTypeSelect.tsx`

```
Purpose: Reusable code repository type selector

Props:
  - value: RepositoryType
  - onChange: (value: RepositoryType) => void
  - disabled?: boolean

Options:
  - FRONTEND
  - BACKEND
  - MONOREPO
  - MICROSERVICE
  - AUTOMATION

Renders: Radio buttons or dropdown (configurable)
```

**File**: `src/components/codeRepositories/CodeRepositoryPurposeSelect.tsx`

```
Purpose: Reusable code repository purpose selector

Props:
  - value: RepositoryPurpose
  - onChange: (value: RepositoryPurpose) => void
  - disabled?: boolean

Options:
  - PRIMARY
  - SECONDARY
  - LEGACY

Renders: Radio buttons or dropdown (configurable)
```

---

## 5. Types & DTOs

### 5.1 CodeRepository Types

**File**: `src/types/codeRepositories/codeRepository.types.ts`

```typescript
// Enums (mirrors database enums)
export enum RepositoryType {
  FRONTEND = 'FRONTEND',
  BACKEND = 'BACKEND',
  MONOREPO = 'MONOREPO',
  MICROSERVICE = 'MICROSERVICE',
  AUTOMATION = 'AUTOMATION',
}

export enum RepositoryPurpose {
  PRIMARY = 'PRIMARY',
  SECONDARY = 'SECONDARY',
  LEGACY = 'LEGACY',
}

export enum ConnectionStatus {
  not_tested = 'not_tested',
  connected = 'connected',
  error = 'error',
  token_expired = 'token_expired',
}

export enum AnalysisStatus {
  not_analyzed = 'not_analyzed',
  analyzing = 'analyzing',
  analyzed = 'analyzed',
  error = 'error',
}

// Main types
export interface CodeRepository {
  id: string
  projectId: string
  name: string
  url: string
  type: RepositoryType
  purpose: RepositoryPurpose
  branch: string
  connectionStatus: ConnectionStatus
  lastConnectionTestAt?: Date
  lastConnectionTestError?: string
  detectedTechStack?: TechStack
  detectedAt?: Date
  analysisStatus: AnalysisStatus
  analysisVersion: number
  lastAnalyzedAt?: Date
  description?: string
  tags: string[]
  isActive: boolean
  createdBy?: string
  createdAt: Date
  updatedAt: Date
}

export interface TechStack {
  language?: string
  framework?: string
  buildTool?: string
  packageManager?: string
  version?: string
}

export interface CodeRepositoryCredential {
  id: string
  codeRepositoryId: string
  credentialType: string
  isActive: boolean
  lastUsedAt?: Date
  expiresAt?: Date
  createdAt: Date
}

export interface CodeRepositoryConnectionTest {
  id: string
  codeRepositoryId: string
  testType: string
  testStatus: string
  testMessage?: string
  testError?: string
  responseTimeMs?: number
  testedBy?: string
  createdAt: Date
}

// DTOs (for API responses)
export interface CodeRepositoryDTO extends CodeRepository {}

export interface ConnectionTestResultDTO {
  testType: string
  testStatus: string
  testMessage?: string
  testError?: string
  detectedTechStack?: TechStack
}
```

### 5.2 Request/Response Types

**File**: `src/types/codeRepositories/request.types.ts`

```typescript
// Create code repository request
export interface CreateCodeRepositoryRequest {
  repositoryName: string
  repositoryUrl: string
  repositoryType: RepositoryType
  repositoryPurpose?: RepositoryPurpose
  branch?: string
  githubToken: string
  description?: string
  tags?: string[]
}

// Update code repository request
export interface UpdateCodeRepositoryRequest {
  branch?: string
  description?: string
  repositoryPurpose?: RepositoryPurpose
  tags?: string[]
  isActive?: boolean
}

// Test connection request
export interface TestConnectionRequest {
  testType: 'basic_connectivity' | 'github_api' | 'branch_verification' | 'all'
}

// Update credential request
export interface UpdateCredentialRequest {
  githubToken: string
}

// List query params
export interface ListCodeRepositoriesQuery {
  status?: ConnectionStatus
  type?: RepositoryType
  limit?: number
  offset?: number
  sort?: string
  order?: 'asc' | 'desc'
}

// API responses
export interface ListCodeRepositoriesResponse {
  codeRepositories: CodeRepositoryDTO[]
  pagination: {
    total: number
    limit: number
    offset: number
  }
}

export interface TestConnectionResponse {
  testJobId: string
  status: 'queued' | 'in_progress' | 'complete'
  results?: ConnectionTestResultDTO[]
  progress?: number
  estimatedSecondsRemaining?: number
}
```

---

## 6. Implementation Order & Dependencies

### Phase 1: Database & Models (Day 1)

**Order**:
1. Create Prisma schema additions (CodeRepository, CodeRepositoryCredential, CodeRepositoryConnectionTest models)
2. Create migration file
3. Run migration: `npx prisma migrate dev`
4. Verify database structure

**Blockers**: None

### Phase 2: Backend Services (Days 2-3)

**Order**:
1. CredentialEncryptionService (encrypt/decrypt functions)
2. GitHubIntegrationService (GitHub API calls)
3. TechStackService (tech stack detection logic)
4. CodeRepositoryCredentialService (credential CRUD)
5. CodeRepositoryConnectionService (connection testing orchestration)
6. CodeRepositoryService (main CRUD operations)
7. Background jobs (test-connection.job.ts, detect-tech-stack.job.ts)

**Blockers**:
- Encryption service must exist before credential service
- GitHub service must exist before connection service
- Tech stack service must exist before connection service

### Phase 3: Backend API Routes (Days 3-4)

**Order**:
1. Controllers (repository.controller.ts, connection.controller.ts, credential.controller.ts)
2. Middleware (auth, validation)
3. CRUD routes (crud.routes.ts)
4. Connection routes (connection.routes.ts)
5. Credential routes (credentials.routes.ts)
6. Main router (repositories/index.ts)
7. Register in main app router

**Blockers**:
- Services must be completed
- Controllers need services injected

### Phase 4: Frontend Components (Days 5-6)

**Order**:
1. Types & DTOs (types/codeRepositories/)
2. Shared components (CodeRepositoryTypeSelect, CodeRepositoryPurposeSelect)
3. Dialog components (RegisterCodeRepositoryDialog, UpdateCodeRepositoryTokenDialog, CodeRepositoryConnectionTestDialog)
4. List components (CodeRepositoryDashboard, CodeRepositoryCard)
5. Detail components (CodeRepositoryDetailsScreen, CodeRepositoryConnectionHistoryScreen)
6. Pages (codeRepositories listing page, code repository detail page)
7. Navigation integration

**Blockers**:
- API must be working (integration testing)
- Types must be defined

### Phase 5: Testing (Days 6-7)

**Order**:
1. Unit tests (services)
2. Integration tests (API endpoints)
3. API tests (with Supertest)
4. UI tests (Cypress/Playwright)
5. Security tests (credential encryption)
6. End-to-end testing

**Blockers**: All code must be written first

### Phase 6: Staging & Deployment (Day 7)

**Order**:
1. Deploy to staging
2. Run full QA testing
3. Fix any issues
4. Deploy to production
5. Monitor logs

**Blockers**: All testing passed

---

## 7. Key Decisions & Design Notes

### 7.1 No GitHub OAuth in Sprint 1

**Decision**: Only GitHub Personal Access Token (PAT) supported.

**Why**:
- Simpler to implement
- No need for callback URLs
- Works for self-hosted and cloud
- OAuth can be added in Sprint 3

**Impact**:
- Users must generate PAT manually
- Token stored encrypted in database
- API endpoints work with single token per repo

### 7.2 Tech Stack Auto-Detection During Connection Test

**Decision**: Triggered during GitHub API test, not separate endpoint.

**Why**:
- Already calling GitHub API for authentication
- No additional latency (parallel to test)
- Happens automatically on token update
- Results stored immediately

**Implementation**:
- In background job, after validating token, call TechStackService
- Parse multiple file types (package.json, pom.xml, etc.)
- Store results in `detected_tech_stack` JSONB field
- Update `detected_at` timestamp

### 7.3 Analysis Fields Ready for Sprint 2

**Decision**: Fields added but not used in Sprint 1.

**Why**:
- Avoid schema migration in Sprint 2
- Repository model already complete
- No API endpoints expose these fields
- Tests can be written without implementation

**Fields**:
- `analysisStatus` (default: "not_analyzed")
- `analysisVersion` (default: 0)
- `lastAnalyzedAt` (default: null)

### 7.4 Soft Delete Strategy

**Decision**: Set `isActive = false`, don't remove records.

**Why**:
- Preserves audit trail
- Allows recovery
- Foreign key integrity maintained
- Test history preserved

**Impact**:
- Queries must filter by `isActive = true`
- DELETE endpoint sets flag, doesn't remove row

### 7.5 Credential Encryption

**Decision**: Encrypt at application layer, not database.

**Why**:
- More flexible key rotation
- Can support multiple algorithms
- Clear separation of concerns
- Future OAuth support easier

**Implementation**:
- AES-256-GCM encryption
- Master key stored in environment
- Salt stored with ciphertext
- Key ID for rotation tracking

---

## 8. Critical Implementation Notes

### 8.1 GitHub API Errors

**Handle**:
- 401: Token invalid/expired → Status "token_expired"
- 403: Insufficient permissions → Status "error"
- 404: Repo not found → Status "error"
- 429: Rate limited → Retry logic
- 5xx: GitHub down → Retry logic

**User messages**: Friendly, actionable suggestions

### 8.2 Background Job Reliability

**Ensure**:
- Jobs don't block API responses (async queuing)
- Failures don't crash server (error handling)
- Retries with exponential backoff
- Dead letter queue for max retries exceeded
- Logging of all results

### 8.3 Validation

**At API level**:
- Repository URL format (must match GitHub pattern)
- Repository name (alphanumeric + hyphens)
- GitHub token format (must start with "ghp_")
- RepositoryType enum values
- RepositoryPurpose enum values

**At service level**:
- User has project access
- Repository URL not duplicate in project
- Repository exists before operations
- Credentials can be decrypted

---

## 9. Files Checklist

- [ ] Prisma schema (repository.types.ts definition)
- [ ] Database migration SQL
- [ ] RepositoryService
- [ ] RepositoryConnectionService
- [ ] RepositoryCredentialService
- [ ] GitHubIntegrationService
- [ ] TechStackService
- [ ] Background jobs (2 files)
- [ ] API controllers (3 files)
- [ ] API routes (3 files)
- [ ] Main router
- [ ] Middleware (auth, validation)
- [ ] Types (2 files)
- [ ] UI components (7 files)
- [ ] Pages (3 files)
- [ ] Tests (unit, integration, API, UI)

**Total**: 25-30 files to create or significantly modify

---

## 10. Ready for Approval

**Current Status**: ✅ Design Complete, Awaiting Code Review

**Next Steps**:
1. Review this file-by-file plan
2. Approve structure and approach
3. Assign developers to each phase
4. Begin Phase 1 (Database)

**Estimated Timeline**: 7 days (1 sprint)

---

**Document Date**: 2026-06-15  
**Version**: 1.0 (Awaiting Approval)

