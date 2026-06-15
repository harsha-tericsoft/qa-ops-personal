# QA Ops Platform - Detailed Implementation Plan

**Status**: Ready for Implementation  
**Date**: June 12, 2026  
**Approval**: ✅ Architecture & Roadmap Approved

---

## Executive Overview

This implementation plan covers the transition from a Cloud-API-only system to a **Local-API-First** QA operations platform with complete feature implementation across 8 priorities.

**Key Strategic Changes:**
- Remove Roam Cloud API assumptions
- Implement Local API Token authentication only
- Add test case review workflow (Draft → Approved)
- Make Repository read-only and sync-driven
- Enable QA users to manage test suites and execution cycles
- Implement Roam protection rules (append-only)

---

## Phase 1: Authentication & Security Fixes

### 1.1 Database Schema Changes

#### New User-Project Relationship Table

```
Table: UserProject (NEW)
├── id (CUID primary key)
├── userId (FK → User, onDelete Cascade)
├── projectId (FK → Project, onDelete Cascade)
├── role (enum: LEAD, QA_ENGINEER, VIEWER)
├── createdAt
└── updatedAt
Unique constraint: (userId, projectId)
```

**Rationale**: Current User model has no relationship to projects. Each user must have explicit project assignments with role context.

#### Modify User Model

**Changes to Prisma schema**:
```
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  
  // REMOVE: password field (CRITICAL SECURITY)
  // ADD: passwordHash field
  passwordHash String  // bcrypt hash
  
  name      String
  role      UserRole @default(QA_ENGINEER)
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // NEW RELATIONSHIPS
  projects  UserProject[]  // Many-to-many with roles
}
```

**Files to modify**:
- `prisma/schema.prisma` - Add UserProject, update User
- `prisma/migrations/2_add_user_project_relationship.sql` - New migration

**Database Migration SQL**:
```sql
-- 1. Add passwordHash column to User
ALTER TABLE "User" ADD COLUMN "passwordHash" VARCHAR NOT NULL DEFAULT '';

-- 2. Create UserProject junction table
CREATE TABLE "UserProject" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  role VARCHAR NOT NULL DEFAULT 'QA_ENGINEER',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE("userId", "projectId")
);
CREATE INDEX idx_userproject_userid ON "UserProject"("userId");
CREATE INDEX idx_userproject_projectid ON "UserProject"("projectId");

-- 3. Migrate existing user password data (placeholder for now)
-- UPDATE "User" SET "passwordHash" = '' WHERE "passwordHash" IS NULL;

-- 4. Drop old password column (after app migration complete)
-- ALTER TABLE "User" DROP COLUMN "password";
```

**Risk**: ⚠️ MEDIUM - Data migration required for existing password data (hash old passwords or reset)

### 1.2 API Layer Changes

#### New Authentication Routes

**Files to create**:
```
app/api/auth/
├── login/route.ts       [MODIFY]
├── register/route.ts    [NEW]
├── refresh/route.ts     [NEW]
├── logout/route.ts      [NEW]
└── me/route.ts          [NEW]
```

#### Authentication Middleware

**Files to create**:
```
lib/auth/
├── jwt.ts               [NEW] - Token generation/validation
├── passwords.ts         [NEW] - bcrypt hashing/verification
├── middleware.ts        [NEW] - Request validation
└── types.ts             [NEW] - Auth types
```

**Key functions needed**:
```typescript
// jwt.ts
export function generateAccessToken(userId: string, projectIds: string[]): string
export function generateRefreshToken(userId: string): string
export function verifyToken(token: string): TokenPayload | null

// passwords.ts
export function hashPassword(password: string): Promise<string>
export function verifyPassword(password: string, hash: string): Promise<boolean>

// middleware.ts
export function validateAuthToken(req: NextRequest): AuthContext | null
export interface AuthContext {
  userId: string
  email: string
  projectIds: string[]
  role: 'LEAD' | 'QA_ENGINEER'
}
```

**Risk**: 🔴 CRITICAL - Token validation must be in all protected routes. Missing validation = security hole.

### 1.3 API Protection

#### Protected Route Wrapper

**File to create**: `lib/api/protected.ts`

**Usage pattern**:
```typescript
// Instead of:
export async function GET(req: NextRequest) { ... }

// Use:
export const GET = withAuth(async (req: NextRequest, auth: AuthContext) => {
  // auth is guaranteed to be valid
  // All project access must check auth.projectIds
})
```

**Implementation**:
```typescript
export function withAuth(
  handler: (req: NextRequest, auth: AuthContext) => Promise<Response>,
  options?: { requiredRole?: 'LEAD' | 'QA_ENGINEER' }
): (req: NextRequest) => Promise<Response> {
  return async (req: NextRequest) => {
    const auth = validateAuthToken(req)
    if (!auth) return new NextResponse('Unauthorized', { status: 401 })
    if (options?.requiredRole && auth.role !== options.requiredRole) {
      return new NextResponse('Forbidden', { status: 403 })
    }
    return handler(req, auth)
  }
}
```

#### All API Routes Requiring Update

**Files to update** (add withAuth wrapper):
```
app/api/projects/route.ts
app/api/projects/[id]/route.ts
app/api/test-cases/route.ts
app/api/test-cases/[id]/route.ts
app/api/test-suites/route.ts
app/api/test-suites/[id]/route.ts
app/api/execution-cycles/route.ts
app/api/execution-cycles/[id]/route.ts
app/api/test-runs/[id]/route.ts
app/api/test-runs/[id]/comments/route.ts
app/api/test-runs/[id]/jira-links/route.ts
app/api/test-runs/[id]/attachments/route.ts
app/api/tags/route.ts
app/api/repository/tree/route.ts
app/api/repository/metrics/route.ts
app/api/roam/config/route.ts
app/api/roam/test-connection/route.ts
app/api/roam/import/route.ts
app/api/roam/sync/route.ts
app/api/roam/logs/route.ts
app/api/dashboard/route.ts
```

**Count**: 22 routes requiring auth validation

**Risk**: 🔴 CRITICAL - Any missing auth validation = security hole. Must be 100% complete.

---

## Phase 2: Roam Local API Integration

### 2.1 RoamConfig Schema Changes

**Current Problem**: Hard-coded to Cloud API only
- `baseUrl = 'https://api.roamresearch.com/api/graph'`
- Only works with Roam Cloud accounts
- Cannot support Roam Desktop/Local

**Solution**: Support Local API exclusively as per requirements

#### Updated RoamConfig Model

```
model RoamConfig {
  id                String        @id @default(cuid())
  projectId         String        @unique
  project           Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  // Per-project Roam configuration
  graphName         String        // Required: Name of local Roam graph
  apiToken          String        // Required: Local API token (encrypted)
  
  // NEW: Local API endpoint configuration
  apiEndpoint       String        @default("http://localhost:8000")  // Configurable
  
  // REMOVE: Cloud API fields
  // - graphUrl (not needed for local)
  // - apiKey (replaced by apiToken)
  
  // Sync management
  syncEnabled       Boolean       @default(false)
  syncIntervalMin   Int           @default(15)
  syncDirection     SyncDirection @default(IMPORT_ONLY)
  lastSyncAt        DateTime?
  lastSyncStatus    SyncStatus    @default(NEVER)
  lastSyncError     String?
  
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
}
```

**Migration SQL**:
```sql
-- Add new columns
ALTER TABLE "RoamConfig" ADD COLUMN "apiEndpoint" VARCHAR DEFAULT 'http://localhost:8000';
ALTER TABLE "RoamConfig" ADD COLUMN "lastSyncError" TEXT;

-- Rename columns
ALTER TABLE "RoamConfig" RENAME COLUMN "apiKey" TO "apiToken";
ALTER TABLE "RoamConfig" DROP COLUMN "graphUrl";

-- Add index
CREATE INDEX idx_roamconfig_projectid ON "RoamConfig"("projectId");
```

**Files to modify**:
- `prisma/schema.prisma` - Update RoamConfig
- `prisma/migrations/3_update_roam_config_for_local_api.sql` - New migration

**Backward Compatibility**: ⚠️ Medium - Existing Cloud API configurations will break. Need migration path.

### 2.2 RoamClient Refactor

**File to modify**: `lib/roam/client.ts`

**Current limitations**:
- Hard-coded Cloud API endpoint
- No local API support
- Bearer token auth only

**Changes required**:

#### New Constructor
```typescript
export class RoamClient {
  private graphName: string
  private apiToken: string
  private apiEndpoint: string  // NEW: http://localhost:PORT
  
  constructor(
    graphName: string,
    apiToken: string,
    apiEndpoint: string = 'http://localhost:8000'  // NEW: default to local
  ) {
    this.graphName = graphName
    this.apiToken = apiToken
    this.apiEndpoint = apiEndpoint
  }
  
  // All URL construction uses this.apiEndpoint instead of hardcoded URL
}
```

#### Updated Query Method
```typescript
private async queryDatalog(query: string): Promise<unknown> {
  // NEW: Local API endpoint
  // Roam Local API expects: http://localhost:PORT/api/graph/{graphName}/q
  const url = `${this.apiEndpoint}/api/graph/${this.graphName}/q`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  
  if (!response.ok) {
    // Better error handling for local API failures
    const error = await response.text()
    if (response.status === 404) {
      throw new Error('Graph not found in local Roam instance')
    }
    if (response.status === 401) {
      throw new Error('Invalid API token')
    }
    if (response.status === 502 || response.status === 503) {
      throw new Error('Roam local API server is not running')
    }
    throw new Error(`Roam API error: ${response.status} ${error}`)
  }
  
  return response.json()
}
```

**Risk**: 🟠 HIGH - Connection failures more likely with local API (server might not be running)

### 2.3 Roam Sync Service Updates

**File to modify**: `lib/roam/sync.ts`

**Current issues**:
- Assumes Cloud API
- No error handling for local API failures
- No recovery mechanism

**Changes needed**:

#### Enhanced Connection Testing
```typescript
export async function testRoamConnection(
  graphName: string,
  apiToken: string,
  apiEndpoint: string = 'http://localhost:8000'
): Promise<{
  success: boolean
  error?: string
  details?: {
    graphFound: boolean
    serverRunning: boolean
  }
}> {
  // Test if local API server is running
  // Test if graph exists
  // Return detailed error info
}
```

#### New Initial Sync Function
```typescript
export async function initialSync(
  projectId: string
): Promise<{
  success: boolean
  error?: string
  nodesAdded: number
  syncLogId: string
}> {
  // Fetch entire Roam graph
  // Import all pages as RepositoryNodes
  // Create initial TestCase entries
  // Log sync operation
  // Return results
}
```

#### Refresh Sync Function
```typescript
export async function refreshSync(
  projectId: string,
  lastSyncAt?: DateTime
): Promise<SyncResult> {
  // Fetch only changes since lastSyncAt
  // Update existing RepositoryNodes
  // Create new RepositoryNodes for added pages
  // Never delete existing nodes (append-only)
  // Log sync operation
}
```

**Risk**: 🟡 MEDIUM - Delta sync logic could miss changes if timestamps are wrong

### 2.4 API Routes for Roam Configuration

**Files to modify/create**:
```
app/api/roam/
├── config/route.ts           [MODIFY] - Save config + test connection
├── test-connection/route.ts  [MODIFY] - Enhanced with local API support
├── sync/route.ts             [MODIFY] - Support initial + refresh
└── status/route.ts           [NEW] - Get current sync status
```

#### Modified config/route.ts
```typescript
export const POST = withAuth(
  async (req: NextRequest, auth: AuthContext) => {
    const { projectId, graphName, apiToken, apiEndpoint } = await req.json()
    
    // 1. Validate user has access to project
    // 2. Test connection to local API
    // 3. Save/update RoamConfig
    // 4. Return success with initial sync recommendation
  },
  { requiredRole: 'LEAD' }  // Only LEAD can configure
)
```

---

## Phase 3: Test Case Review Workflow

### 3.1 TestCase Schema Changes

**Current**: TestCase has no review/approval workflow

**Required**: Support Draft → Approved status

```
model TestCase {
  id            String            @id @default(cuid())
  projectId     String
  project       Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  title         String
  description   String?
  
  // NEW: Review workflow
  status        TestCaseStatus    @default(DRAFT)    // DRAFT | APPROVED
  reviewedBy    String?           // User ID
  reviewedAt    DateTime?
  
  // Existing fields
  nodes         TestCaseNode[]
  testRuns      TestRun[]
  suites        SuiteTestCase[]
  tags          TagTestCase[]
  
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt
}

enum TestCaseStatus {
  DRAFT
  APPROVED
}
```

**Migration SQL**:
```sql
ALTER TABLE "TestCase" ADD COLUMN "status" VARCHAR DEFAULT 'DRAFT';
ALTER TABLE "TestCase" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "reviewedAt" TIMESTAMP;
CREATE INDEX idx_testcase_status ON "TestCase"("status");
```

**Files to modify**:
- `prisma/schema.prisma` - Add TestCaseStatus enum, update TestCase
- `prisma/migrations/4_add_test_case_review_workflow.sql` - Migration

### 3.2 Review Workflow API

**Files to create**:
```
app/api/test-cases/[id]/approve/route.ts     [NEW]
app/api/test-cases/[id]/reject/route.ts      [NEW]
```

**Implementation**:
```typescript
// app/api/test-cases/[id]/approve/route.ts
export const POST = withAuth(
  async (req: NextRequest, auth: AuthContext) => {
    const { id } = await params
    
    // 1. Find test case
    // 2. Check user has project access
    // 3. Update status to APPROVED
    // 4. Set reviewedBy, reviewedAt
    // 5. Schedule Roam push (see Roam Push section)
  },
  { requiredRole: 'LEAD' }  // Only LEAD can approve
)

// Similar for reject/route.ts
```

### 3.3 Test Case Management UI

**Components to create/modify**:
```
components/test-cases/
├── TestCaseForm.tsx           [MODIFY] - Add status display
├── TestCaseTable.tsx          [MODIFY] - Show status, review button
├── ReviewDialog.tsx           [NEW] - Approve/reject modal
└── TestCaseList.tsx           [MODIFY] - Filter by status

app/test-cases/page.tsx        [MODIFY] - Full CRUD implementation
```

---

## Phase 4: Repository Synchronization

### 4.1 Repository Model Updates

**Current**: Repository is a container, not sync-aware

**Required**: Track sync status and manual/automated counts

```
model Repository {
  id              String           @id @default(cuid())
  projectId       String
  project         Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name            String
  description     String?
  
  // NEW: Sync tracking
  lastSyncAt      DateTime?
  lastSyncStatus  String?          // "success" | "failed"
  lastSyncError   String?
  
  // NEW: Test counts (denormalized for performance)
  totalTestCount    Int           @default(0)
  manualTestCount   Int           @default(0)
  automatedTestCount Int         @default(0)
  
  // Existing fields
  roamSyncId      String?
  nodes           RepositoryNode[]
  
  @@index([projectId])
}

model RepositoryNode {
  id              String           @id @default(cuid())
  repositoryId    String
  repository      Repository       @relation(fields: [repositoryId], references: [id], onDelete: Cascade)
  projectId       String
  name            String
  slug            String
  path            String
  depth           Int              @default(0)
  order           Int              @default(0)
  type            NodeType         @default(FOLDER)
  
  // NEW: Manual vs Automated tracking
  isAutomated     Boolean          @default(false)
  automationFramework String?      // "Selenium", "Playwright", etc.
  
  description     String?
  metadata        Json?
  parentId        String?
  parent          RepositoryNode?  @relation("NodeTree", fields: [parentId], references: [id], onDelete: SetNull)
  children        RepositoryNode[] @relation("NodeTree")
  roamNodeId      String?          @unique
  roamPageId      String?
  syncedAt        DateTime?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  deletedAt       DateTime?
  testCases       TestCaseNode[]
  
  @@index([repositoryId])
  @@index([projectId])
  @@index([parentId])
  @@index([path])
}
```

**Migration SQL**:
```sql
-- Repository table
ALTER TABLE "Repository" ADD COLUMN "lastSyncAt" TIMESTAMP;
ALTER TABLE "Repository" ADD COLUMN "lastSyncStatus" VARCHAR;
ALTER TABLE "Repository" ADD COLUMN "lastSyncError" TEXT;
ALTER TABLE "Repository" ADD COLUMN "totalTestCount" INTEGER DEFAULT 0;
ALTER TABLE "Repository" ADD COLUMN "manualTestCount" INTEGER DEFAULT 0;
ALTER TABLE "Repository" ADD COLUMN "automatedTestCount" INTEGER DEFAULT 0;

-- RepositoryNode table
ALTER TABLE "RepositoryNode" ADD COLUMN "isAutomated" BOOLEAN DEFAULT FALSE;
ALTER TABLE "RepositoryNode" ADD COLUMN "automationFramework" VARCHAR;
CREATE INDEX idx_repositorynode_isautomated ON "RepositoryNode"("isAutomated");
```

**Files to modify**:
- `prisma/schema.prisma` - Update Repository and RepositoryNode
- `prisma/migrations/5_add_repository_sync_tracking.sql` - Migration

### 4.2 Repository Sync API

**Files to create/modify**:
```
app/api/repository/
├── sync/initial/route.ts      [NEW] - Initial Roam sync
├── sync/refresh/route.ts      [NEW] - Refresh sync
├── status/route.ts            [NEW] - Get sync status
└── metrics/route.ts           [MODIFY] - Include manual/automated counts
```

**Flow**:
```
1. User initiates sync from Repository page
2. POST /api/repository/sync/initial or /refresh
3. Backend:
   a. Fetch all pages from Roam
   b. Create/update RepositoryNode entries
   c. Detect manual vs automated tests
   d. Update Repository.lastSyncAt
   e. Update count fields
   f. Log sync operation
4. Return success + updated counts
5. Frontend refreshes tree view
```

### 4.3 Repository Frontend Updates

**Files to modify**:
```
app/repository/page.tsx        [MODIFY] - Add sync button, status display
components/repository/
├── RepositoryTree.tsx         [MODIFY] - Show manual/automated badges
├── RepositoryMetrics.tsx      [MODIFY] - Show sync status + counts
├── RepositorySyncButton.tsx   [NEW] - Initiate sync
└── RepositoryFilters.tsx      [MODIFY] - Filter by manual/automated
```

**Manual vs Automated Detection**:
- Look for keywords in page title/content: "automated", "manual", framework names
- Store isAutomated flag on RepositoryNode
- Display badge in UI

---

## Phase 5: Test Suite Management

### 5.1 TestSuite Full CRUD

**Current**: TestSuite exists but CRUD endpoints not complete

**Files to modify/create**:
```
app/api/test-suites/route.ts          [MODIFY] - GET/POST working
app/api/test-suites/[id]/route.ts     [MODIFY] - GET/PUT/DELETE complete
app/api/test-suites/[id]/tests/route.ts [NEW] - Add/remove tests
```

#### TestSuite CRUD Endpoints

```typescript
// GET /api/test-suites?projectId=X
// List all suites for project

// POST /api/test-suites
// Create new suite
// Body: { projectId, name, description, category, testCaseIds: [] }

// GET /api/test-suites/[id]
// Get suite details with test cases

// PUT /api/test-suites/[id]
// Update suite
// Body: { name?, description?, category?, testCaseIds?: [] }

// DELETE /api/test-suites/[id]
// Delete suite (cascade to SuiteTestCase)

// POST /api/test-suites/[id]/tests
// Add tests to suite
// Body: { testCaseIds: [] }

// DELETE /api/test-suites/[id]/tests/[testCaseId]
// Remove test from suite
```

**Access Control**: QA_ENGINEER + above can create suites

### 5.2 TestSuite UI

**Files to create/modify**:
```
app/test-suites/page.tsx              [MODIFY] - Full CRUD page
components/suites/
├── SuiteForm.tsx                     [MODIFY] - Create/edit form
├── SuiteCard.tsx                     [MODIFY] - Display with edit/delete
├── SuiteTestCaseSelector.tsx         [NEW] - Multi-select test cases
├── SuiteTestCaseTable.tsx            [MODIFY] - Show selected tests
└── BulkTestSelection.tsx             [NEW] - By repository path, tags
```

**Features**:
- Create suite with name, description, category
- Add tests manually or by:
  - Repository hierarchy (select folder = add all tests)
  - Tags (AND/OR logic)
  - Search

---

## Phase 6: Execution Cycles

### 6.1 ExecutionCycle Full CRUD

**Current**: ExecutionCycle exists, partial implementation

**Files to modify/create**:
```
app/api/execution-cycles/route.ts           [MODIFY] - GET/POST
app/api/execution-cycles/[id]/route.ts      [MODIFY] - GET/PUT/DELETE
app/api/execution-cycles/[id]/run/route.ts  [NEW] - Create test runs
```

#### ExecutionCycle Endpoints

```typescript
// GET /api/execution-cycles?projectId=X
// List cycles for project

// POST /api/execution-cycles
// Create new cycle
// Body: { projectId, name, description, sourceTestCaseIds: [], status: 'PLANNED' }

// GET /api/execution-cycles/[id]
// Get cycle with test runs

// PUT /api/execution-cycles/[id]
// Update cycle status
// Body: { status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'ABORTED' }

// POST /api/execution-cycles/[id]/run
// Execute test case in cycle
// Body: { testCaseId, executedBy, status, result, durationMs }

// PUT /api/execution-cycles/[id]/run/[testRunId]
// Update test run result
// Body: { status, result, durationMs }
```

### 6.2 ExecutionCycle UI

**Files to create/modify**:
```
app/cycles/page.tsx                        [MODIFY] - Full CRUD page
components/cycles/
├── ExecutionCycleForm.tsx                 [NEW] - Create cycle
├── ExecutionCycleList.tsx                 [NEW] - List cycles
├── ExecutionCycleDetail.tsx               [NEW] - View cycle + tests
├── TestRunExecutor.tsx                    [NEW] - Manual test execution
├── TestRunResult.tsx                      [NEW] - Record result
└── ExecutionStats.tsx                     [NEW] - Show pass/fail/blocked stats
```

**Execution Flow**:
1. Create cycle (select tests or from suite)
2. Cycle shows list of test cases
3. QA clicks on test case
4. Modal opens: Test details + manual execution steps
5. QA records: Pass/Fail/Blocked
6. Optional: Add comments, attach screenshots
7. Submit result
8. Cycle updates statistics

---

## Phase 7: Dashboard Updates

### 7.1 Dashboard Metrics Changes

**Current metrics** need updates for new schema:

```typescript
interface UpdatedDashboardMetrics {
  // Projects & Setup
  projectCount: number
  roamConfigured: boolean
  lastSyncStatus: 'success' | 'failed' | 'never'
  lastSyncAt: DateTime | null
  
  // Repository
  totalRepositoryNodes: number
  totalTests: number        // Count of all APPROVED test cases
  manualTests: number       // isAutomated = false
  automatedTests: number    // isAutomated = true
  
  // Test Suites
  totalSuites: number
  activeSuites: number      // Used in IN_PROGRESS cycles
  
  // Execution
  activeCycles: number
  completedCycles: number
  passRate: number | null   // Of completed runs
  failRate: number | null
  blockedRate: number | null
  
  // Test Case Status
  draftTests: number        // status = DRAFT
  approvedTests: number     // status = APPROVED
  pendingApproval: number   // DRAFT count
  
  // Release Readiness
  readiness: 'READY' | 'AT_RISK' | 'NOT_READY'
}
```

**Files to modify**:
- `lib/db.ts` - Update getDashboardMetrics query
- `lib/services/dashboard.service.ts` - Update calculations
- `app/api/dashboard/route.ts` - Return new structure
- `app/dashboard/page.tsx` - Update metric cards

### 7.2 New Dashboard Sections

**Pending Approvals Widget**:
```
Shows: Count of DRAFT test cases
Action: Link to Test Cases page
```

**Repository Sync Status Widget**:
```
Shows: 
  - Last sync time
  - Manual vs Automated test breakdown
  - Manual/Automated pie chart
Actions: Refresh sync button
```

---

## Phase 8: Reporting (Minimal MVP)

### 8.1 Report Types

**Execution Report**:
```
For a given cycle:
- Cycle name, status, date range
- Total tests: X
- Passed: X (%)
- Failed: X (%)
- Blocked: X (%)
- Test results table with name, status, duration
- Export to CSV
```

**Test Coverage Report**:
```
- Total test cases: X
- By status: Draft/Approved breakdown
- By type: Manual/Automated breakdown
- By tag: Tests per tag
- Pie charts
```

**Files to create**:
```
app/api/reports/
├── execution/route.ts    [NEW] - Execution cycle report
└── coverage/route.ts     [NEW] - Coverage report

app/reports/page.tsx      [NEW] - Reports page
components/reports/
├── ExecutionReport.tsx   [NEW]
└── CoverageReport.tsx    [NEW]
```

---

## Cross-Cutting Concerns

### 8.1 Error Handling & Validation

#### Input Validation Layer

**File to create**: `lib/validations/schemas.ts`

```typescript
import { z } from 'zod'

export const ProjectSchema = z.object({
  name: z.string().min(1).max(255),
  graphName: z.string().min(1).max(255),
  apiToken: z.string().min(1),
})

export const TestCaseSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  projectId: z.string().cuid(),
})

export const ExecutionCycleSchema = z.object({
  projectId: z.string().cuid(),
  name: z.string().min(1).max(255),
  testCaseIds: z.array(z.string().cuid()),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ABORTED']),
})

// ... more schemas
```

**Used in**: All API routes with `req.json()` validation

#### API Error Response Standardization

**File to create**: `lib/api/error-handler.ts`

```typescript
export interface ApiErrorResponse {
  error: string
  code: string
  details?: Record<string, unknown>
  timestamp: string
}

export function handleApiError(error: unknown): ApiErrorResponse {
  if (error instanceof ValidationError) {
    return {
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.issues,
    }
  }
  if (error instanceof NotFoundError) {
    return {
      error: 'Resource not found',
      code: 'NOT_FOUND',
    }
  }
  // ... handle other error types
}
```

### 8.2 Logging

**File to create**: `lib/logging/logger.ts`

```typescript
interface LogContext {
  userId?: string
  projectId?: string
  action: string
  details?: Record<string, unknown>
}

export function log(context: LogContext, level: 'info' | 'warn' | 'error') {
  // Log to console in dev
  // Log to external service in prod (e.g., Sentry)
  console.log(`[${context.action}]`, context.details)
}
```

**Used in**: 
- Sync operations (log every sync)
- Test execution (log every test run)
- API errors (log all errors)
- User actions (log approvals, deletions)

---

## Database Migration Strategy

### Order of Migrations

```
1. Add UserProject relationship
   - File: prisma/migrations/2_add_user_project_relationship.sql
   
2. Update RoamConfig for local API
   - File: prisma/migrations/3_update_roam_config_for_local_api.sql
   
3. Add test case review workflow
   - File: prisma/migrations/4_add_test_case_review_workflow.sql
   
4. Add repository sync tracking
   - File: prisma/migrations/5_add_repository_sync_tracking.sql
```

### Migration Rollout Plan

**Dev Environment**:
- Test migrations locally
- Verify data integrity
- Test rollback

**Staging Environment**:
- Run migrations on clone of production database
- Verify application works
- Test user workflows

**Production**:
- Backup database before migration
- Run migrations during low-traffic window
- Verify all features work
- Monitor for errors

---

## Risk Assessment & Mitigation

### Risk Matrix

| Risk | Severity | Likelihood | Mitigation |
|------|----------|-----------|-----------|
| Authentication validation missing in API route | CRITICAL | MEDIUM | Code review checklist for all API routes |
| Local API token stored insecurely | CRITICAL | MEDIUM | Use encrypted field, env var for key |
| Roam graph sync loses data | HIGH | LOW | Append-only design, no deletes |
| Password migration fails | HIGH | MEDIUM | Test migration script on staging |
| Database migration fails in production | CRITICAL | LOW | Backup before migration, rollback plan |
| UserProject queries become N+1 | MEDIUM | MEDIUM | Load all projects in single query |
| Sync blocks other requests | MEDIUM | MEDIUM | Run sync in background job (future) |
| Review workflow conflicts with import | MEDIUM | LOW | Only imported tests = APPROVED |

### Critical Checkpoints

1. **After Auth Implementation**: 
   - ✅ All 22 API routes have auth validation
   - ✅ Token validation works in all scenarios
   - ✅ Password hashing tested with bcrypt

2. **After Roam Local API**:
   - ✅ Local API connection tested
   - ✅ Initial sync works end-to-end
   - ✅ Error handling for offline Roam

3. **After Test Case Review**:
   - ✅ Draft/Approved workflow tested
   - ✅ Approval limits Roam sync to APPROVED only
   - ✅ LEAD can approve, others cannot

4. **After Repository Sync**:
   - ✅ Initial sync imports all Roam content
   - ✅ Refresh sync only updates changes
   - ✅ Manual/Automated detection works
   - ✅ Counts are accurate

5. **Before Release**:
   - ✅ All CRUD operations work
   - ✅ No SQL injection vulnerabilities
   - ✅ No XSS vulnerabilities
   - ✅ Performance acceptable (queries < 1s)
   - ✅ Error messages don't leak data

---

## Files Summary

### New Files to Create (26 total)

**Authentication Layer**:
```
lib/auth/
├── jwt.ts
├── passwords.ts
├── middleware.ts
├── types.ts
└── session.ts

lib/validations/
└── schemas.ts

lib/api/
├── protected.ts
├── error-handler.ts
└── logging.ts
```

**API Routes**:
```
app/api/auth/
├── register/route.ts
├── refresh/route.ts
├── logout/route.ts
└── me/route.ts

app/api/repository/
├── sync/initial/route.ts
├── sync/refresh/route.ts
└── status/route.ts

app/api/test-suites/[id]/
└── tests/route.ts

app/api/execution-cycles/[id]/
├── run/route.ts
└── tests/route.ts

app/api/test-cases/[id]/
├── approve/route.ts
└── reject/route.ts

app/api/roam/
└── status/route.ts

app/api/reports/
├── execution/route.ts
└── coverage/route.ts
```

**Frontend Components**:
```
components/test-cases/
├── ReviewDialog.tsx
└── TestCaseList.tsx

components/suites/
├── SuiteTestCaseSelector.tsx
└── BulkTestSelection.tsx

components/cycles/
├── ExecutionCycleForm.tsx
├── ExecutionCycleList.tsx
├── ExecutionCycleDetail.tsx
├── TestRunExecutor.tsx
├── TestRunResult.tsx
└── ExecutionStats.tsx

components/repository/
├── RepositorySyncButton.tsx
└── SyncStatus.tsx

components/reports/
├── ExecutionReport.tsx
└── CoverageReport.tsx

app/reports/
└── page.tsx
```

**Database Migrations** (4 total):
```
prisma/migrations/
├── 2_add_user_project_relationship.sql
├── 3_update_roam_config_for_local_api.sql
├── 4_add_test_case_review_workflow.sql
└── 5_add_repository_sync_tracking.sql
```

### Files to Modify (25 total)

**Core Infrastructure**:
- `lib/prisma.ts` - Already good, no changes
- `lib/db.ts` - Consolidate with Prisma (Phase 2)
- `lib/roam/client.ts` - Major refactor for local API
- `lib/roam/sync.ts` - Add initial/refresh sync

**API Routes** (22 routes need auth):
- All `app/api/*/route.ts` files need `withAuth()` wrapper

**Services**:
- `lib/services/suite.service.ts` - Add delete, better queries
- `lib/services/execution.service.ts` - Complete implementation
- `lib/services/dashboard.service.ts` - Update metrics
- `lib/utils/formatters.ts` - Add new formatters

**Frontend Pages & Components**:
- `app/layout.tsx` - Update user context
- `components/ProtectedRoute.tsx` - Validate project access
- `components/layout/AppHeader.tsx` - Show user + project
- `components/layout/AppSidebar.tsx` - Update based on access
- `components/test-cases/TestCaseForm.tsx` - Add status display
- `components/test-cases/TestCaseTable.tsx` - Add status column
- `components/suites/SuiteCard.tsx` - Add edit/delete
- `components/repository/RepositoryTree.tsx` - Add manual/automated badges
- `components/repository/RepositoryMetrics.tsx` - Add sync status
- `components/dashboard/MetricCard.tsx` - Update card types
- `app/test-cases/page.tsx` - Full CRUD page
- `app/test-suites/page.tsx` - Full CRUD page
- `app/cycles/page.tsx` - Full CRUD page
- `app/dashboard/page.tsx` - Update metrics

---

## Implementation Timeline

### Week 1: Authentication (Priority 1)
- Days 1-2: Database migrations + schema changes
- Days 3-4: Auth layer (JWT, passwords, middleware)
- Days 5: API protection (add withAuth to all routes)
- Effort: 25-30 hours

### Week 2: Projects & Roam Local API (Priority 2-4)
- Days 1-2: User-Project endpoints
- Days 3-5: Roam Local API client + config
- Effort: 20-25 hours

### Week 3: Repository & Test Cases (Priority 3-5)
- Days 1-2: Repository sync (initial + refresh)
- Days 3-4: Test case review workflow
- Days 5: Test suite CRUD endpoints
- Effort: 20-25 hours

### Week 4: Execution & Dashboard (Priority 6-7)
- Days 1-3: Execution cycle CRUD + test execution
- Days 4-5: Dashboard updates + metrics
- Effort: 20-25 hours

### Week 5: Reports & Polish (Priority 8)
- Days 1-2: Basic reporting
- Days 3-5: Testing + bug fixes
- Effort: 15-20 hours

**Total Estimated Effort**: 100-120 hours (~3 weeks at 40 hrs/week)

---

## Dependencies

### External Dependencies

- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT generation
- `zod` - Input validation (already in project)
- No new major dependencies needed

### Internal Dependencies

```
Authentication
├─→ Database (UserProject table)
├─→ JWT library
└─→ Bcrypt library

Roam Integration
├─→ RoamClient refactor
├─→ RoamConfig updates
└─→ Repository sync logic

Test Case Review
├─→ Database schema
├─→ API endpoints
└─→ Approval workflow

Repository Sync
├─→ Roam integration
├─→ Repository model
├─→ Manual/Automated detection
└─→ Sync service

Test Suites
├─→ CRUD endpoints
├─→ Test selection logic
└─→ Frontend components

Execution Cycles
├─→ Test case selection
├─→ Test run tracking
├─→ Result recording
└─→ Metrics calculation

Dashboard
├─→ All above modules
├─→ Aggregated metrics
└─→ Sync status

Reports
├─→ Execution data
├─→ Dashboard metrics
└─→ CSV export
```

---

## Success Criteria

### Authentication Implementation ✅
- [ ] Passwords hashed with bcrypt
- [ ] Tokens are valid JWT with signature
- [ ] All 22 API routes validate auth
- [ ] User cannot access other user's data
- [ ] Token refresh works
- [ ] Logout invalidates token

### Roam Local API ✅
- [ ] Connection test works with local API
- [ ] Initial sync imports all pages
- [ ] Refresh sync updates changes only
- [ ] Error handling for offline Roam
- [ ] No data loss from previous Cloud API setup

### Test Case Review ✅
- [ ] Can create test case (DRAFT status)
- [ ] Can approve test case (LEAD only)
- [ ] Can reject test case
- [ ] Only APPROVED cases sync to Roam
- [ ] Roam push is append-only

### Repository ✅
- [ ] Initial sync completes
- [ ] Refresh sync updates hierarchy
- [ ] Manual/Automated detection works
- [ ] Counts are accurate
- [ ] UI shows sync status

### Test Suites ✅
- [ ] Can create suite (QA_ENGINEER+)
- [ ] Can add tests manually
- [ ] Can add tests by path
- [ ] Can add tests by tags
- [ ] Can edit/delete suite

### Execution Cycles ✅
- [ ] Can create cycle
- [ ] Can execute manual tests
- [ ] Can record results (Pass/Fail/Blocked)
- [ ] Can add comments
- [ ] Stats update correctly

### Dashboard ✅
- [ ] Shows all metrics
- [ ] Sync status widget
- [ ] Pending approvals count
- [ ] Manual/Automated breakdown
- [ ] Release readiness score

### Reports ✅
- [ ] Execution report works
- [ ] Coverage report works
- [ ] CSV export works
- [ ] Charts display correctly

---

## Questions & Clarifications Needed

Before starting implementation, confirm:

1. **Local API Endpoint**: Should it be configurable per project, or fixed at startup?
   - Current design: Configurable per project (stored in RoamConfig.apiEndpoint)
   - Alternative: Fixed endpoint from env var
   
2. **Token Expiration**: What duration for JWT tokens?
   - Proposed: 15-minute access token, 7-day refresh token
   
3. **Roam Push Timing**: When should approved test cases sync to Roam?
   - Option A: Immediately on approval
   - Option B: On-demand (user clicks "Sync")
   - Option C: Scheduled nightly sync
   - Proposed: Option B (on-demand)

4. **Automated Test Detection**: Should users manually mark tests as automated?
   - Current design: Auto-detect from keywords + manual field
   - Alternative: Always manual mark
   
5. **Multi-Graph Support**: Can one project use multiple Roam graphs?
   - Current design: One graph per project
   - Proposed: Keep it 1:1 for MVP

6. **Approval Bypass**: Should LEAD users be able to run DRAFT tests?
   - Proposed: No - all tests must be APPROVED before execution
   - Alternative: LEAD can run DRAFT tests

---

**Status**: AWAITING APPROVAL TO PROCEED WITH IMPLEMENTATION

**Next Steps**: 
1. Review this plan
2. Clarify any questions above
3. Approve to begin Phase 1 (Authentication)

