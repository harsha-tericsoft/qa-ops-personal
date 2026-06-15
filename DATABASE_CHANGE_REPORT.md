# Database Change Report: Sprint 1 - Code Repository Integration

**Document**: Comprehensive database schema analysis for Sprint 1 implementation  
**Date**: 2026-06-15  
**Status**: Ready for Approval  
**Scope**: New models and enums only (CodeRepository feature)

---

## Executive Summary

Sprint 1 introduces **3 new models**, **4 new enums**, and **1 modified model** to support GitHub code repository registration and connection testing. All changes are **isolated** from existing Roam integration infrastructure with no breaking changes.

**Key Statistics**:
- New models: 3
- New enums: 4
- Models modified: 1 (Project - metadata columns only)
- New relationships: 4
- New unique constraints: 2
- New indexes: 4
- New foreign keys: 3
- Data migration requirements: NONE (new feature)
- Breaking changes: NONE

---

## Part 1: Existing Models Modified

### 1.1 Project Model

**Purpose**: Top-level container for QA Ops projects. Adding metadata columns to track code repository enablement.

**Current Fields** (unchanged):
- `id` (String, PK, CUID) - Primary key
- `name` (String, non-null) - Project name
- `description` (String, nullable) - Optional description
- `createdAt` (DateTime, default: now()) - Creation timestamp
- `updatedAt` (DateTime, auto-update) - Last update timestamp

**Current Relationships** (unchanged):
- `repositories` (Repository[] for Roam imports) - One-to-many with Repository
- `testCases` (TestCase[]) - One-to-many with TestCase
- `roamConfig` (RoamConfig?) - One-to-one with RoamConfig
- `syncLogs` (SyncLog[]) - One-to-many with SyncLog
- `executionCycles` (ExecutionCycle[]) - One-to-many with ExecutionCycle
- `testSuites` (TestSuite[]) - One-to-many with TestSuite
- `tags` (Tag[]) - One-to-many with Tag

**New Fields to Add**:
- `codeRepositoriesEnabled` (Boolean, default: false, non-null) - Feature flag for code repository management
- `codeRepositoryCount` (Int, default: 0, non-null) - Running count of connected code repositories
- `lastCodeRepositoryAddedAt` (DateTime, nullable) - Timestamp of most recent repository registration

**New Relationships to Add**:
- `codeRepositories` (CodeRepository[]) - One-to-many relationship with new CodeRepository model

**Rationale for New Fields**:
- `codeRepositoriesEnabled`: Allows per-project feature gating without requiring code deployment
- `codeRepositoryCount`: Denormalized counter for efficient dashboard statistics (updated on CRUD operations)
- `lastCodeRepositoryAddedAt`: Tracks user activity for project monitoring and analytics

**Data Migration Impact**: NONE
- All new fields have defaults
- No existing data transformation required
- Backward compatible schema change

---

## Part 2: New Models

### 2.1 CodeRepository Model

**Purpose**: Represents a GitHub code repository connection. Stores metadata, connection state, and detected technology stack. Acts as the source of truth for all code repository data.

**Fields**:

| Field | Type | Null | Default | Index | Notes |
|-------|------|------|---------|-------|-------|
| `id` | String | NO | cuid() | PK | Primary key, CUID format |
| `projectId` | String | NO | - | YES | Foreign key to Project(id), CASCADE on delete |
| `repositoryName` | String | NO | - | NO | User-friendly name (e.g., "web-app") |
| `repositoryUrl` | String | NO | - | NO | Full GitHub URL (e.g., "https://github.com/owner/repo") |
| `repositoryType` | RepositoryType enum | NO | - | NO | Technology category (FRONTEND, BACKEND, MONOREPO, MICROSERVICE, AUTOMATION) |
| `repositoryPurpose` | RepositoryPurpose enum | NO | PRIMARY | NO | Project role (PRIMARY, SECONDARY, LEGACY) |
| `branch` | String | NO | "main" | NO | Default branch to analyze |
| `connectionStatus` | ConnectionStatus enum | NO | "not_tested" | YES | Current connection state |
| `lastConnectionTestAt` | DateTime | YES | null | NO | Timestamp of last test execution |
| `lastConnectionTestError` | String | YES | null | NO | Error message from most recent failed test |
| `detectedTechStack` | Json | YES | null | NO | Auto-detected tech stack: `{language?, framework?, buildTool?, packageManager?, version?}` |
| `detectedAt` | DateTime | YES | null | NO | Timestamp when tech stack was last detected |
| `analysisStatus` | AnalysisStatus enum | NO | "not_analyzed" | NO | Placeholder for future Sprint 2 (code analysis) |
| `analysisVersion` | Int | NO | 0 | NO | Version counter for analysis runs (ensures cache invalidation) |
| `lastAnalyzedAt` | DateTime | YES | null | NO | Timestamp of last analysis (future use) |
| `description` | String | YES | null | NO | User-provided notes about the repository |
| `tags` | String[] | NO | [] | NO | Array of user-defined tags for filtering/grouping |
| `isActive` | Boolean | NO | true | NO | Soft-delete flag (false = deleted but preserved for audit) |
| `createdBy` | String | YES | null | NO | User ID of creator (foreign key to User, optional reference) |
| `createdAt` | DateTime | NO | now() | NO | Record creation timestamp |
| `updatedAt` | DateTime | NO | - | NO | Auto-updated on every change |

**Relationships**:

1. **Project** (Many-to-One):
   - Field: `project`
   - Relation field: `projectId`
   - Foreign key reference: `Project(id)`
   - ON DELETE: CASCADE (delete all code repositories when project is deleted)
   - Cardinality: Multiple CodeRepositories per Project, One Project per CodeRepository

2. **CodeRepositoryCredential** (One-to-Many):
   - Field: `credentials`
   - Related model: CodeRepositoryCredential
   - Foreign key in CodeRepositoryCredential: `codeRepositoryId`
   - Cardinality: One CodeRepository has multiple Credentials (historical tracking)

3. **CodeRepositoryConnectionTest** (One-to-Many):
   - Field: `connectionTests`
   - Related model: CodeRepositoryConnectionTest
   - Foreign key in CodeRepositoryConnectionTest: `codeRepositoryId`
   - Cardinality: One CodeRepository has multiple Test records (audit trail)

**Unique Constraints**:

```
UNIQUE(projectId, repositoryUrl)
```

Rationale: Prevents duplicate GitHub URLs within a single project (same URL can exist in different projects).

**Indexes**:

1. `idx_projectId` - Query repositories by project
2. `idx_connectionStatus` - Query by connection state (dashboard filtering)
3. `idx_createdAt_desc` - Query recent repositories (sorting)
4. Composite index on (projectId, repositoryUrl) for uniqueness

**Nullable vs Non-Nullable Summary**:
- **Non-nullable identifiers**: `id`, `projectId`, `repositoryName`, `repositoryUrl`, `repositoryType`, `connectionStatus`, `analysisStatus`, `analysisVersion`, `isActive`, `createdAt`, `updatedAt`
- **Non-nullable defaults**: `repositoryPurpose` (PRIMARY), `branch` (main), `tags` ([])
- **Nullable fields**: All detection/analysis fields are nullable until populated by background jobs
  - `lastConnectionTestAt`, `lastConnectionTestError`, `detectedTechStack`, `detectedAt`, `lastAnalyzedAt`, `description`, `createdBy`

**Data Migration Requirements**: NONE
- New model, no existing data to transform

---

### 2.2 CodeRepositoryCredential Model

**Purpose**: Securely stores encrypted GitHub credentials (personal access tokens). Separate from CodeRepository model to enable credential rotation and multi-credential support.

**Fields**:

| Field | Type | Null | Default | Index | Notes |
|-------|------|------|---------|-------|-------|
| `id` | String | NO | cuid() | PK | Primary key |
| `codeRepositoryId` | String | NO | - | YES | Foreign key to CodeRepository(id), CASCADE on delete |
| `credentialType` | String | NO | "github_pat" | NO | Enum-like: "github_pat" (Sprint 1), "github_oauth" (future) |
| `encryptedValue` | String | NO | - | NO | AES-256-GCM encrypted token (application-level encryption) |
| `encryptionAlgorithm` | String | NO | "AES-256-GCM" | NO | Algorithm used for encryption (enables future key rotation) |
| `encryptionKeyId` | String | YES | null | NO | Key version identifier (enables key rotation without re-encryption) |
| `isActive` | Boolean | NO | true | NO | Soft-delete flag (false = revoked but preserved for audit) |
| `lastUsedAt` | DateTime | YES | null | NO | Timestamp of last usage (for analytics) |
| `createdAt` | DateTime | NO | now() | NO | Record creation timestamp |
| `expiresAt` | DateTime | YES | null | NO | Credential expiration date (if applicable, e.g., OAuth tokens) |

**Relationships**:

1. **CodeRepository** (Many-to-One):
   - Field: `codeRepository`
   - Relation field: `codeRepositoryId`
   - Foreign key reference: `CodeRepository(id)`
   - ON DELETE: CASCADE (delete credentials when repository is deleted)
   - Cardinality: Multiple Credentials per CodeRepository (historical support for token rotation)

**Unique Constraints**:

```
UNIQUE(codeRepositoryId, credentialType)
```

Rationale: Only one active credential of each type per repository. Enables future support for multiple credential types (OAuth, SSH, etc.).

**Indexes**:

1. `idx_codeRepositoryId` - Query credentials by repository
2. `idx_expiresAt` - Find expiring tokens (for proactive renewal alerts)

**Security Considerations**:

- **Encryption**: All credential values are encrypted at application level using AES-256-GCM before storage
- **Never logged**: Token values are never logged, even in encrypted form
- **Rotation support**: `encryptionKeyId` tracks which key was used (enables rotation without re-encryption)
- **Soft delete**: `isActive = false` preserves audit trail when credentials are revoked
- **Expiration tracking**: `expiresAt` enables proactive notifications before token expires

**Nullable vs Non-Nullable Summary**:
- **Non-nullable**: `id`, `codeRepositoryId`, `credentialType`, `encryptedValue`, `encryptionAlgorithm`, `isActive`, `createdAt`
- **Nullable**: `encryptionKeyId`, `lastUsedAt`, `expiresAt` (optional for PAT, required for OAuth in future)

**Data Migration Requirements**: NONE
- New model

---

### 2.3 CodeRepositoryConnectionTest Model

**Purpose**: Audit trail of connection testing. Records every test execution, results, and detected tech stack. Enables tracking of connection history and debugging failed connections.

**Fields**:

| Field | Type | Null | Default | Index | Notes |
|-------|------|------|---------|-------|-------|
| `id` | String | NO | cuid() | PK | Primary key |
| `codeRepositoryId` | String | NO | - | YES | Foreign key to CodeRepository(id), CASCADE on delete |
| `testType` | String | NO | - | YES | Type of test: "basic_connectivity", "github_api", "branch_verification", "tech_stack_detection" |
| `testStatus` | String | NO | - | YES | Result: "success", "failed", "pending" |
| `testMessage` | String | YES | null | NO | Success message (e.g., "Repository URL is reachable", "Token has required permissions") |
| `testError` | String | YES | null | NO | Failure message (e.g., "404 Not Found", "Token expired", "Invalid branch") |
| `responseTimeMs` | Int | YES | null | NO | Latency in milliseconds (for performance monitoring) |
| `testedBy` | String | YES | null | NO | User ID who triggered the test (optional, can be system background job) |
| `createdAt` | DateTime | NO | now() | NO | Test execution timestamp |

**Relationships**:

1. **CodeRepository** (Many-to-One):
   - Field: `codeRepository`
   - Relation field: `codeRepositoryId`
   - Foreign key reference: `CodeRepository(id)`
   - ON DELETE: CASCADE (delete test history when repository is deleted)
   - Cardinality: Multiple Tests per CodeRepository (1-N, audit trail)

**Indexes**:

1. `idx_codeRepositoryId_createdAt_desc` - Query test history for a repository, ordered by recency
2. `idx_testStatus` - Query by status (success/failed, for dashboard filtering)

**Nullable vs Non-Nullable Summary**:
- **Non-nullable**: `id`, `codeRepositoryId`, `testType`, `testStatus`, `createdAt`
- **Nullable**: `testMessage`, `testError`, `responseTimeMs`, `testedBy`
  - `testMessage` populated only on success
  - `testError` populated only on failure
  - `responseTimeMs` optional (some test types may not measure latency)
  - `testedBy` optional (background jobs may not have user context)

**Data Migration Requirements**: NONE
- New model

---

## Part 3: New Enums

### 3.1 RepositoryType

**Purpose**: Categorizes code repositories by their technical role.

**Values**:
- `FRONTEND` - Frontend applications (React, Vue, Angular, etc.)
- `BACKEND` - Backend services (Node.js, Python, Java, etc.)
- `MONOREPO` - Monorepo containing multiple services (Nx, Yarn workspaces, etc.)
- `MICROSERVICE` - Individual microservice in a larger ecosystem
- `AUTOMATION` - Automation/DevOps repositories (CI/CD, infrastructure, scripts)

**Database Type**: PostgreSQL enum  
**Used In**: CodeRepository.repositoryType (non-nullable, required on creation)

**Note**: Defines structure for tech-stack aware test generation (Sprint 3+)

---

### 3.2 RepositoryPurpose

**Purpose**: Defines the project role of a repository.

**Values**:
- `PRIMARY` - Main repository for the project (single per project typical)
- `SECONDARY` - Supporting repository (utilities, shared libs, etc.)
- `LEGACY` - Deprecated but maintained for backward compatibility

**Database Type**: PostgreSQL enum  
**Used In**: CodeRepository.repositoryPurpose (non-nullable, defaults to PRIMARY)

**Note**: Used for filtering and prioritization in analysis workflows

---

### 3.3 ConnectionStatus

**Purpose**: Tracks the current connection state of a code repository.

**Values**:
- `not_tested` - No connection test has been run (initial state)
- `connected` - Most recent test succeeded, repository is accessible
- `error` - Most recent test failed, repository may be inaccessible or credentials invalid
- `token_expired` - Specific error state indicating credential expiration

**Database Type**: PostgreSQL enum  
**Used In**: CodeRepository.connectionStatus (non-nullable, defaults to "not_tested")

**Transition Rules**:
```
not_tested → connected (successful test)
not_tested → error (failed test)
connected → connected (re-test succeeds)
connected → error (re-test fails)
error → connected (token refreshed/corrected)
token_expired → connected (after credential update)
```

**Note**: Used for dashboard status indicators and filtering

---

### 3.4 AnalysisStatus

**Purpose**: Tracks code analysis execution state (placeholder for Sprint 2).

**Values**:
- `not_analyzed` - No analysis has been run (initial state)
- `analyzing` - Analysis job is currently executing
- `analyzed` - Analysis completed successfully
- `error` - Analysis failed

**Database Type**: PostgreSQL enum  
**Used In**: CodeRepository.analysisStatus (non-nullable, defaults to "not_analyzed")

**Implementation Note**: Sprint 1 does not perform analysis. Fields are included for infrastructure readiness (Sprint 2+).

---

## Part 4: New Relationships

### 4.1 Project → CodeRepository (One-to-Many)

**Relationship Type**: One-to-many  
**Parent Model**: Project  
**Child Model**: CodeRepository

**Fields**:
- Project.codeRepositories: CodeRepository[]
- CodeRepository.project: Project (via projectId)
- CodeRepository.projectId: String (foreign key)

**Foreign Key Constraints**:
- Reference: Project(id)
- ON DELETE: CASCADE (deleting a project deletes all its code repositories)
- ON UPDATE: CASCADE

**Cardinality**: 0 to N (a project can have 0 or more code repositories)

**Index**: CodeRepository.projectId (for efficient filtering)

**Usage**: Get all code repositories for a project, enforce project-based access control

---

### 4.2 CodeRepository → CodeRepositoryCredential (One-to-Many)

**Relationship Type**: One-to-many  
**Parent Model**: CodeRepository  
**Child Model**: CodeRepositoryCredential

**Fields**:
- CodeRepository.credentials: CodeRepositoryCredential[]
- CodeRepositoryCredential.codeRepository: CodeRepository (via codeRepositoryId)
- CodeRepositoryCredential.codeRepositoryId: String (foreign key)

**Foreign Key Constraints**:
- Reference: CodeRepository(id)
- ON DELETE: CASCADE (deleting a repository deletes its credentials)
- ON UPDATE: CASCADE

**Cardinality**: 1 to N (each repository must have at least 1 credential, can have multiple for rotation)

**Unique Constraint**: UNIQUE(codeRepositoryId, credentialType) — One credential per type per repository

**Index**: CodeRepositoryCredential.codeRepositoryId

**Usage**: Store and rotate GitHub PAT tokens, support future OAuth credential types

---

### 4.3 CodeRepository → CodeRepositoryConnectionTest (One-to-Many)

**Relationship Type**: One-to-many  
**Parent Model**: CodeRepository  
**Child Model**: CodeRepositoryConnectionTest

**Fields**:
- CodeRepository.connectionTests: CodeRepositoryConnectionTest[]
- CodeRepositoryConnectionTest.codeRepository: CodeRepository (via codeRepositoryId)
- CodeRepositoryConnectionTest.codeRepositoryId: String (foreign key)

**Foreign Key Constraints**:
- Reference: CodeRepository(id)
- ON DELETE: CASCADE (deleting a repository deletes its test history)
- ON UPDATE: CASCADE

**Cardinality**: 1 to N (each repository has test history, grows over time)

**Index**: Composite (codeRepositoryId, createdAt DESC) for chronological retrieval

**Usage**: Audit trail of connection testing, debugging failed connections, performance monitoring

---

### 4.4 CodeRepository → User (Optional Many-to-One)

**Relationship Type**: Many-to-one (optional)  
**Parent Model**: User  
**Child Model**: CodeRepository

**Fields**:
- CodeRepository.createdBy: String (nullable, user ID)
- (No reverse relation defined in Sprint 1)

**Foreign Key Constraints**: Optional (reference to User(id), no cascade)

**Cardinality**: 0 or 1 (a repository can be created by a user or by system)

**Usage**: Track who created/registered the repository (audit trail)

**Note**: No explicit User → CodeRepository relationship in Prisma (not required for current queries)

---

## Part 5: Indexes

### 5.1 CodeRepository Indexes

| Index Name | Columns | Type | Purpose |
|------------|---------|------|---------|
| (Primary Key) | id | UNIQUE | Primary key lookup |
| idx_projectId | projectId | Standard | Filter repositories by project (dashboard) |
| idx_connectionStatus | connectionStatus | Standard | Filter by status (connected, error, pending) |
| idx_createdAt | createdAt DESC | Standard | Sort recent repositories, pagination |
| (Unique) | (projectId, repositoryUrl) | UNIQUE | Prevent duplicates |

### 5.2 CodeRepositoryCredential Indexes

| Index Name | Columns | Type | Purpose |
|------------|---------|------|---------|
| (Primary Key) | id | UNIQUE | Primary key lookup |
| idx_codeRepositoryId | codeRepositoryId | Standard | Query credentials for a repository |
| idx_expiresAt | expiresAt | Standard | Find expiring tokens (alerts) |
| (Unique) | (codeRepositoryId, credentialType) | UNIQUE | One credential per type |

### 5.3 CodeRepositoryConnectionTest Indexes

| Index Name | Columns | Type | Purpose |
|------------|---------|------|---------|
| (Primary Key) | id | UNIQUE | Primary key lookup |
| idx_codeRepositoryId_createdAt | (codeRepositoryId, createdAt DESC) | Composite | Query test history in order |
| idx_testStatus | testStatus | Standard | Filter tests by result |

---

## Part 6: Unique Constraints

### 6.1 CodeRepository

```
UNIQUE(projectId, repositoryUrl)
```

**Rationale**: 
- Prevents duplicate repository registrations within a single project
- Same repository URL can exist in different projects (distinct registrations)
- Enforces at database level for data integrity

**Impact**: 
- Application must catch `UniqueViolationError` on duplicate attempts
- Error message should guide user to update existing registration rather than create new

### 6.2 CodeRepositoryCredential

```
UNIQUE(codeRepositoryId, credentialType)
```

**Rationale**: 
- Only one credential of each type per repository
- Supports future multiple credential types (github_pat, github_oauth, ssh_key, etc.)
- Enables atomic credential updates

**Impact**: 
- When updating a token, application must delete old credential and create new one (or use UPDATE)
- `isActive` flag provides soft-delete without breaking unique constraint

---

## Part 7: Foreign Keys

### 7.1 CodeRepository Foreign Keys

| Field | References | ON DELETE | ON UPDATE | Nullable |
|-------|-----------|-----------|-----------|----------|
| projectId | Project(id) | CASCADE | CASCADE | NO |

**Implication**: Deleting a project cascades to delete all its code repositories (and their related credentials and test history via CASCADE chain).

### 7.2 CodeRepositoryCredential Foreign Keys

| Field | References | ON DELETE | ON UPDATE | Nullable |
|-------|-----------|-----------|-----------|----------|
| codeRepositoryId | CodeRepository(id) | CASCADE | CASCADE | NO |

**Implication**: Deleting a code repository cascades to delete all its credentials.

### 7.3 CodeRepositoryConnectionTest Foreign Keys

| Field | References | ON DELETE | ON UPDATE | Nullable |
|-------|-----------|-----------|-----------|----------|
| codeRepositoryId | CodeRepository(id) | CASCADE | CASCADE | NO |

**Implication**: Deleting a code repository cascades to delete all its test history.

### 7.4 CodeRepository Optional Foreign Key

| Field | References | ON DELETE | ON UPDATE | Nullable |
|-------|-----------|-----------|-----------|----------|
| createdBy | User(id) | SET NULL | CASCADE | YES |

**Implication** (Future Enhancement, not Sprint 1): If user is deleted, `createdBy` becomes null but repository is preserved.

---

## Part 8: Nullable vs Non-Nullable Field Summary

### 8.1 CodeRepository

**REQUIRED (Non-Nullable, No Default)**:
- `id` - Generated by database
- `projectId` - Must reference valid project
- `repositoryName` - User-provided name
- `repositoryUrl` - Unique GitHub URL
- `repositoryType` - Must be one of 5 types

**REQUIRED (Non-Nullable, Has Default)**:
- `repositoryPurpose` (default: PRIMARY)
- `branch` (default: "main")
- `connectionStatus` (default: "not_tested")
- `analysisStatus` (default: "not_analyzed")
- `analysisVersion` (default: 0)
- `tags` (default: [])
- `isActive` (default: true)
- `createdAt` (default: now())
- `updatedAt` (auto-updated)

**OPTIONAL (Nullable)**:
- `lastConnectionTestAt` - Populated after first test
- `lastConnectionTestError` - Populated only when test fails
- `detectedTechStack` - Populated by tech stack detection job
- `detectedAt` - Populated when tech stack is detected
- `lastAnalyzedAt` - Populated after analysis (Sprint 2+)
- `description` - User-provided notes
- `createdBy` - User who created the record

**Creation Requirements** (fields required in POST request):
- `projectId` (path parameter)
- `repositoryName`
- `repositoryUrl`
- `repositoryType`
- All others optional or have defaults

---

### 8.2 CodeRepositoryCredential

**REQUIRED (Non-Nullable, No Default)**:
- `id` - Generated by database
- `codeRepositoryId` - Must reference valid code repository
- `credentialType` - Type of credential (e.g., "github_pat")
- `encryptedValue` - Encrypted token

**REQUIRED (Non-Nullable, Has Default)**:
- `encryptionAlgorithm` (default: "AES-256-GCM")
- `isActive` (default: true)
- `createdAt` (default: now())

**OPTIONAL (Nullable)**:
- `encryptionKeyId` - For key rotation tracking
- `lastUsedAt` - Populated on credential usage
- `expiresAt` - For tokens with expiration

---

### 8.3 CodeRepositoryConnectionTest

**REQUIRED (Non-Nullable, No Default)**:
- `id` - Generated by database
- `codeRepositoryId` - Must reference valid code repository
- `testType` - Type of test performed
- `testStatus` - Result (success/failed/pending)
- `createdAt` - Test timestamp

**OPTIONAL (Nullable, Conditional)**:
- `testMessage` - Present only on success
- `testError` - Present only on failure
- `responseTimeMs` - May not be measured for all tests
- `testedBy` - Optional user ID, can be null for background jobs

---

## Part 9: Data Migration Requirements

### 9.1 Migration Strategy

**Migration Type**: ADDITIVE (no destructive changes)

**Scope**:
1. Create 4 new enums
2. Create 3 new models (with foreign keys and indexes)
3. Add 3 columns to Project model
4. No data transformation required

**Steps** (Prisma):
```
1. Create new enums (RepositoryType, RepositoryPurpose, ConnectionStatus, AnalysisStatus)
2. Create CodeRepository table
3. Create CodeRepositoryCredential table
4. Create CodeRepositoryConnectionTest table
5. Add 3 columns to projects table
6. Create all indexes
7. Create unique constraints
```

### 9.2 Data Integrity Checks (Post-Migration)

**Verify**:
1. All 3 new tables exist with correct columns and types
2. All foreign key constraints are in place
3. All unique constraints are active
4. All indexes exist and are usable
5. Project table has 3 new columns
6. Default values are applied correctly

### 9.3 Rollback Strategy

**If Migration Fails**:
```
-- Drop new tables (cascade will clean up dependencies)
DROP TABLE code_repository_connection_tests;
DROP TABLE code_repository_credentials;
DROP TABLE code_repositories;

-- Remove new columns from projects
ALTER TABLE projects DROP COLUMN code_repositories_enabled;
ALTER TABLE projects DROP COLUMN code_repository_count;
ALTER TABLE projects DROP COLUMN last_code_repository_added_at;

-- Drop new enums
DROP TYPE IF EXISTS "RepositoryType";
DROP TYPE IF EXISTS "RepositoryPurpose";
DROP TYPE IF EXISTS "ConnectionStatus";
DROP TYPE IF EXISTS "AnalysisStatus";
```

**Rollback Impact**: None. Rollback is non-destructive for existing data.

---

## Part 10: Breaking Changes Analysis

### 10.1 No Breaking Changes

**Existing Models**: Not modified (only Project gets new optional columns)

**Existing Enums**: No changes

**Existing Relationships**: No changes

**Existing Indexes**: No changes

**Existing Foreign Keys**: No changes

### 10.2 Backward Compatibility

**API Backwards Compatibility**: 
- No existing API endpoints change
- New endpoints are additive (/api/repositories/* added, existing /api/repository/* unchanged)
- No changes to authentication or authorization model

**Database Backwards Compatibility**:
- All new tables are isolated from existing tables
- Existing queries continue to work unchanged
- New columns on Project have defaults, existing rows not affected

**ORM Backwards Compatibility**:
- Existing Prisma models can be used as-is
- New models are additive imports
- No changes to existing model definitions required

### 10.3 Potential Conflicts (None Identified)

**Model Name Conflicts**: 
- Existing: `Repository` (Roam imports)
- New: `CodeRepository` (GitHub code repositories)
- Status: ✓ NO CONFLICT — distinct names

**Enum Name Conflicts**: 
- New enums don't conflict with existing enums
- Status: ✓ NO CONFLICT

**Column Name Conflicts on Project**:
- New columns: `codeRepositoriesEnabled`, `codeRepositoryCount`, `lastCodeRepositoryAddedAt`
- Existing columns: No naming collision
- Status: ✓ NO CONFLICT

**Route Conflicts**:
- Existing: `/api/repository/*` (singular)
- New: `/api/repositories/*` (plural)
- Status: ✓ NO CONFLICT

---

## Part 11: Sensitive Data & Security Considerations

### 11.1 Encryption Requirements

**CodeRepositoryCredential.encryptedValue**:
- Algorithm: AES-256-GCM (application-level)
- Key Management: Separate encryption service (CredentialEncryptionService)
- Key Rotation: Enabled via `encryptionKeyId` field
- Never logged or exposed in API responses
- Decrypted only when needed (connection testing, credential export)

### 11.2 Soft Delete Strategy

**Models Using Soft Delete**:
- CodeRepository (`isActive` = false)
- CodeRepositoryCredential (`isActive` = false)

**Rationale**:
- Audit trail preservation
- Ability to restore if needed
- Compliance with retention policies
- Prevents accidental deletion recovery issues

**Implementation Notes**:
- Queries must filter WHERE isActive = true (default in repository layer)
- Soft-deleted records visible only to admin/audit views
- Hard delete only available through explicit admin operations

### 11.3 Audit Trail

**Models Creating Audit Trail**:
- CodeRepository: `createdBy`, `createdAt`, `updatedAt`
- CodeRepositoryConnectionTest: Complete test history with timestamps and user
- CodeRepositoryCredential: `createdAt`, `lastUsedAt`, `expiresAt`

---

## Part 12: Prisma-Specific Details

### 12.1 Field Types

**Prisma Type Mappings** (to PostgreSQL):

| Prisma Type | PostgreSQL Type | Notes |
|-------------|-----------------|-------|
| String | VARCHAR | Unicode supported |
| String (enum) | VARCHAR with CHECK | Validated at application level |
| Int | INTEGER | 32-bit signed |
| Boolean | BOOLEAN | true/false |
| DateTime | TIMESTAMP WITH TIME ZONE | Timezone-aware |
| Json | JSONB | Binary JSON, indexed |
| String[] | TEXT[] | Array of strings |

### 12.2 Enum Implementation

Prisma enums are defined at schema level and generate:
1. TypeScript types (auto-generated)
2. PostgreSQL CHECK constraints (data integrity)
3. Application-level validation

Example:
```prisma
enum RepositoryType {
  FRONTEND
  BACKEND
  MONOREPO
  MICROSERVICE
  AUTOMATION
}
```

Generates:
- TypeScript: `type RepositoryType = 'FRONTEND' | 'BACKEND' | ...`
- PostgreSQL: CHECK constraint on column

### 12.3 Relations

Prisma uses implicit junction tables for many-to-many (not used in Sprint 1).

For one-to-many:
- Foreign key defined in child model
- Back-relation defined in parent model
- Both sides declared in Prisma schema

Example:
```prisma
// In CodeRepository
project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
projectId String

// In Project
codeRepositories CodeRepository[]
```

---

## Appendix A: DDL-Equivalent Prisma Schema (Reference Only)

This section shows what the Prisma schema would look like (not to be applied yet, review only):

```prisma
// New Enums
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

// Modified Model
model Project {
  // ... existing fields ...
  codeRepositories CodeRepository[]
  codeRepositoriesEnabled Boolean @default(false)
  codeRepositoryCount Int @default(0)
  lastCodeRepositoryAddedAt DateTime?
}

// New Models
model CodeRepository {
  id String @id @default(cuid())
  projectId String
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  repositoryName String
  repositoryUrl String
  repositoryType RepositoryType
  repositoryPurpose RepositoryPurpose @default(PRIMARY)
  branch String @default("main")
  connectionStatus ConnectionStatus @default(not_tested)
  lastConnectionTestAt DateTime?
  lastConnectionTestError String?
  detectedTechStack Json?
  detectedAt DateTime?
  analysisStatus AnalysisStatus @default(not_analyzed)
  analysisVersion Int @default(0)
  lastAnalyzedAt DateTime?
  description String?
  tags String[] @default([])
  isActive Boolean @default(true)
  createdBy String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  credentials CodeRepositoryCredential[]
  connectionTests CodeRepositoryConnectionTest[]

  @@unique([projectId, repositoryUrl])
  @@index([projectId])
  @@index([connectionStatus])
  @@index([createdAt(sort: Desc)])
}

model CodeRepositoryCredential {
  id String @id @default(cuid())
  codeRepositoryId String
  codeRepository CodeRepository @relation(fields: [codeRepositoryId], references: [id], onDelete: Cascade)
  credentialType String @default("github_pat")
  encryptedValue String
  encryptionAlgorithm String @default("AES-256-GCM")
  encryptionKeyId String?
  isActive Boolean @default(true)
  lastUsedAt DateTime?
  createdAt DateTime @default(now())
  expiresAt DateTime?

  @@unique([codeRepositoryId, credentialType])
  @@index([codeRepositoryId])
  @@index([expiresAt])
}

model CodeRepositoryConnectionTest {
  id String @id @default(cuid())
  codeRepositoryId String
  codeRepository CodeRepository @relation(fields: [codeRepositoryId], references: [id], onDelete: Cascade)
  testType String
  testStatus String
  testMessage String?
  testError String?
  responseTimeMs Int?
  testedBy String?
  createdAt DateTime @default(now())

  @@index([codeRepositoryId, createdAt(sort: Desc)])
  @@index([testStatus])
}
```

---

## Appendix B: Model Summary Table

| Model | Purpose | Records/Project | Lifetime | Soft Delete |
|-------|---------|-----------------|----------|-------------|
| CodeRepository | GitHub repo registration | 1-10 typical | Long-lived | Yes |
| CodeRepositoryCredential | GitHub token storage | 1-3 per repo | Long-lived (token lifetime) | Yes |
| CodeRepositoryConnectionTest | Test history audit | 10+ per repo | Long-lived (retained for audit) | No |
| Project (modified) | Metadata columns | 1 per project | Long-lived | N/A |

---

## Sign-Off Checklist

- [ ] All field types reviewed and approved
- [ ] All relationships verified for correctness
- [ ] All constraints confirmed necessary
- [ ] All indexes confirmed performant
- [ ] All nullable fields justified
- [ ] Encryption strategy approved (AES-256-GCM)
- [ ] Soft-delete strategy approved
- [ ] No breaking changes identified
- [ ] Rollback strategy tested (Theoretical)
- [ ] Data migration requirements: NONE confirmed

---

## Approval Required

**Status**: PENDING APPROVAL

**Next Steps (Upon Approval)**:
1. Generate Prisma migration file: `npx prisma migrate dev --name "add-code-repository-models"`
2. Review generated migration SQL
3. Execute migration on development database
4. Verify schema with `npx prisma db push`
5. Proceed to implementation

**Reviewed By**: [Awaiting Review]  
**Approved By**: [Awaiting Approval]  
**Date Approved**: [Pending]

