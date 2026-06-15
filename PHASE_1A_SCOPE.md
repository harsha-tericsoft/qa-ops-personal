# Phase 1A: Roam Local API Connection & Sync - Detailed Scope

**Status**: Ready for Code Implementation  
**Scope**: Connect to Roam Desktop Local API and synchronize repository  
**Out of Scope**: Push, Review, Dashboard, Reports, AI features

---

## Database Changes

### Schema Modifications

**File**: `prisma/schema.prisma`

**Changes to RoamConfig model**:

```prisma
model RoamConfig {
  id                String        @id @default(cuid())
  projectId         String        @unique
  project           Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  // Project Roam Configuration
  graphName         String        // Required: Roam graph name (e.g., "Project_Kinergy")
  apiToken          String        // Required: Local API token
  apiEndpoint       String        @default("http://localhost:8000")  // Configurable endpoint
  
  // Sync tracking
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

**Changes to Repository model**:

```prisma
model Repository {
  id              String           @id @default(cuid())
  projectId       String
  project         Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name            String
  description     String?
  
  // NEW: Sync tracking
  lastSyncAt      DateTime?
  lastSyncStatus  String?         // "success" | "failed"
  lastSyncError   String?
  
  // NEW: Test counts (for display)
  totalTests      Int             @default(0)
  
  roamSyncId      String?
  nodes           RepositoryNode[]
  
  @@index([projectId])
}
```

**Changes to RepositoryNode model**:

```prisma
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
  
  // NEW: Tags for display
  tags            String[]         @default([])  // JSON array: ["#Manual", "#Automated"]
  
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

### Migration File

**File**: `prisma/migrations/1_phase_1a_roam_local_api.sql`

```sql
-- Modify RoamConfig table for Local API
ALTER TABLE "RoamConfig" 
  ADD COLUMN "apiEndpoint" VARCHAR DEFAULT 'http://localhost:8000',
  ADD COLUMN "lastSyncError" TEXT;

-- Update existing columns
-- Note: graphUrl and old apiKey remain for now, can be cleaned up in Phase 2

-- Modify Repository table
ALTER TABLE "Repository"
  ADD COLUMN "lastSyncAt" TIMESTAMP,
  ADD COLUMN "lastSyncStatus" VARCHAR,
  ADD COLUMN "lastSyncError" TEXT,
  ADD COLUMN "totalTests" INTEGER DEFAULT 0;

-- Modify RepositoryNode table
ALTER TABLE "RepositoryNode"
  ADD COLUMN "tags" TEXT[] DEFAULT '{}';

-- Create indexes
CREATE INDEX idx_roamconfig_projectid ON "RoamConfig"("projectId");
CREATE INDEX idx_repository_projectid ON "Repository"("projectId");
CREATE INDEX idx_repositorynode_tags ON "RepositoryNode" USING gin("tags");
```

---

## Files to Modify

### 1. `lib/roam/client.ts`

**Current State**: Hard-coded to Cloud API  
**Changes Required**:

- ✅ Add `apiEndpoint` parameter to constructor
- ✅ Make `baseUrl` dynamic (use `apiEndpoint` instead of hard-coded Cloud URL)
- ✅ Add better error messages for local API failures (offline, invalid token, graph not found)
- ✅ Keep existing `testConnection()`, `fetchAllPages()`, `writePage()` methods

**Key Changes**:
```typescript
// FROM:
private baseUrl = 'https://api.roamresearch.com/api/graph'

// TO:
private apiEndpoint: string

// Constructor now accepts endpoint
constructor(graphName: string, apiToken: string, apiEndpoint: string)

// Query method uses dynamic endpoint
private async queryDatalog(query: string) {
  const url = `${this.apiEndpoint}/api/graph/${this.graphName}/q`
  // ... rest of query logic
}
```

---

### 2. `lib/roam/sync.ts`

**Current State**: Basic sync, Cloud API specific  
**Changes Required**:

- ✅ Add `initialSync()` function - fetch and import all Roam pages
- ✅ Add `refreshSync()` function - fetch and update changes only
- ✅ Load RoamConfig with per-project endpoint
- ✅ Create or get repository
- ✅ Import pages into RepositoryNode tree
- ✅ Calculate test counts
- ✅ Log all sync operations
- ✅ Return clear status messages

**Key Functions**:
```typescript
export async function initialSync(projectId: string): Promise<{
  success: boolean
  error?: string
  nodesAdded: number
  message: string
}>

export async function refreshSync(projectId: string): Promise<{
  success: boolean
  error?: string
  nodesAdded: number
  nodesUpdated: number
  message: string
}>
```

---

### 3. `app/api/roam/config/route.ts`

**Current State**: Partially implemented  
**Changes Required**:

- ✅ Accept: `projectId`, `graphName`, `apiToken`, `apiEndpoint`
- ✅ Validate all required fields
- ✅ Save/update RoamConfig in database
- ✅ Call `testConnection()` after saving
- ✅ Return clear success/error messages

**Endpoint**: `POST /api/roam/config`

```typescript
// Request:
{
  projectId: string
  graphName: string
  apiToken: string
  apiEndpoint: string (optional, default: http://localhost:8000)
}

// Response (Success):
{
  success: true
  message: "Configuration saved"
  endpoint: "http://localhost:8000"
  graphName: "Project_Kinergy"
}

// Response (Error):
{
  success: false
  error: "Cannot connect to Roam API"
  details: "Roam is not running at http://localhost:8000"
}
```

---

### 4. `app/api/roam/test-connection/route.ts`

**Current State**: Exists but minimal  
**Changes Required**:

- ✅ Accept `projectId`
- ✅ Load RoamConfig for that project
- ✅ Test connection with clear error messages:
  - Server not running (502/503)
  - Graph not found (404)
  - Invalid token (401)
  - Network error
- ✅ Return detailed result

**Endpoint**: `POST /api/roam/test-connection`

```typescript
// Request:
{ projectId: string }

// Response (Success):
{
  success: true
  message: "Connected to Roam successfully"
  endpoint: "http://localhost:8000"
  graphName: "Project_Kinergy"
}

// Response (Failure - Server Down):
{
  success: false
  error: "Roam server is not running"
  details: "Cannot reach http://localhost:8000"
  hint: "Start Roam Desktop or check your endpoint configuration"
}

// Response (Failure - Invalid Token):
{
  success: false
  error: "Invalid API token"
  details: "Roam rejected the authentication token"
  hint: "Check your token in Roam settings"
}
```

---

### 5. `app/api/roam/sync/route.ts`

**Current State**: Exists but Cloud API specific  
**Changes Required**:

- ✅ Accept: `projectId`, `syncType` ("initial" | "refresh")
- ✅ Call appropriate sync function
- ✅ Return status and counts

**Endpoint**: `POST /api/roam/sync`

```typescript
// Request:
{
  projectId: string
  syncType: "initial" | "refresh"  // default: "refresh"
}

// Response (Success):
{
  success: true
  syncType: "initial"
  nodesAdded: 42
  nodesUpdated: 0
  message: "Initial sync completed: 42 test cases imported"
  timestamp: "2026-06-12T14:30:00Z"
}

// Response (Failure):
{
  success: false
  error: "Cannot connect to Roam"
  message: "Verify Roam is running and endpoint is correct"
}
```

---

### 6. `app/api/repository/status/route.ts` (NEW)

**Purpose**: Get repository sync status and details

**Endpoint**: `GET /api/repository/status?projectId=X`

```typescript
// Response:
{
  projectId: string
  lastSyncAt: DateTime | null
  lastSyncStatus: "success" | "failed" | "never" | null
  lastSyncError: string | null
  totalTests: number
  hierarchyDepth: number
  nodeCount: number
}
```

---

### 7. `components/forms/RoamConfigForm.tsx`

**Current State**: Basic form  
**Changes Required**:

- ✅ Add fields: `projectId`, `graphName`, `apiToken`, `apiEndpoint`
- ✅ Default `apiEndpoint` to "http://localhost:8000"
- ✅ Make all fields except `apiEndpoint` required
- ✅ Handle form submission
- ✅ Display loading state while saving
- ✅ Display success/error messages

**Form Fields**:
1. **Graph Name** - Required, text input
2. **API Token** - Required, password input
3. **API Endpoint** - Optional, text input (default: http://localhost:8000)
4. **Test Connection** - Button (separate call)
5. **Save Configuration** - Button

---

### 8. `app/roam/page.tsx` (OR integration into project details)

**Current State**: Exists but minimal  
**Changes Required**:

- ✅ Wrap entire page in ProtectedRoute
- ✅ Show RoamConfigForm
- ✅ Show RoamConnectionTest component
- ✅ Show SyncStatus component
- ✅ Show RepositoryVisualization component
- ✅ Show RepositorySyncButton component

---

## Files to Create

### 1. `components/roam/RoamConnectionTest.tsx`

**Purpose**: Display connection test UI and results

**Props**:
```typescript
interface RoamConnectionTestProps {
  projectId: string
  onTestComplete?: (success: boolean) => void
}
```

**Features**:
- Button: "Test Connection"
- Loading spinner while testing
- Success message: "Connected to Roam successfully"
- Error message with details
- Hints for common errors

---

### 2. `components/roam/SyncStatus.tsx`

**Purpose**: Display last sync status

**Props**:
```typescript
interface SyncStatusProps {
  projectId: string
}
```

**Displays**:
- Last sync time (or "Never synced")
- Status: ✅ Success | ❌ Failed | ⏳ In Progress
- Error message (if failed)
- Last sync details (node count, etc.)

---

### 3. `components/roam/RepositorySyncButton.tsx`

**Purpose**: Trigger initial or refresh sync

**Props**:
```typescript
interface RepositorySyncButtonProps {
  projectId: string
  syncType: "initial" | "refresh"
  onSyncComplete?: () => void
}
```

**Features**:
- Button with appropriate label ("Initial Sync" or "Refresh")
- Loading state with spinner
- Success message with counts
- Error message with troubleshooting hints
- Disabled state if no config

---

### 4. `components/repository/RepositoryVisualization.tsx`

**Purpose**: Display repository hierarchy and test counts

**Props**:
```typescript
interface RepositoryVisualizationProps {
  projectId: string
  compact?: boolean
}
```

**Displays**:
- Tree view of hierarchy
  - Folders
  - Pages
  - Test cases
- Test count badge on each node
- Tags display
- Collapsible tree structure
- Empty state message if no data

**Features**:
- Click to expand/collapse folders
- Show breadcrumb of current path
- Badge showing: "42 tests"

---

### 5. `app/api/repository/metrics/route.ts` (MODIFY)

**Current**: Exists, complex query  
**Changes for Phase 1A**:

- ✅ Add totalTests count from RepositoryNode
- ✅ Return repository sync status
- ✅ Add lastSyncAt, lastSyncStatus

---

## API Routes Summary

### Routes to Modify

```
POST /api/roam/config
  ├─ Accept: projectId, graphName, apiToken, apiEndpoint
  ├─ Save to RoamConfig
  └─ Return status

POST /api/roam/test-connection
  ├─ Accept: projectId
  ├─ Test Roam connectivity
  └─ Return detailed error messages

POST /api/roam/sync
  ├─ Accept: projectId, syncType
  ├─ Call initialSync() or refreshSync()
  └─ Return node counts and status

GET /api/repository/status
  ├─ Accept: projectId
  ├─ Return sync status
  └─ Return node/test counts
```

### Routes to Create

```
GET /api/repository/status [NEW]
  ├─ Get last sync info
  └─ Get tree statistics
```

---

## UI Flow

### User Journey: Connect Roam & Sync Repository

**1. Configure Roam** (New User)
```
Roam Configuration Page
├─ Graph Name: [Project_Kinergy]
├─ API Token: [paste token]
├─ API Endpoint: [http://localhost:8000]
└─ [Save Configuration] button
     ↓
     Test connection automatically
     ↓
     Show: ✅ "Connected to Roam successfully"
```

**2. Test Connection** (Verify)
```
Test Connection Card
├─ Status: Not tested
├─ [Test Connection] button
     ↓
     Show: ⏳ "Testing..."
     ↓
     Result: ✅ "Connected" OR ❌ "Failed"
     ↓
     If failed: Show error with hint
```

**3. Initial Sync** (First time)
```
Sync Controls
├─ Status: Never synced
├─ [Initial Sync] button
     ↓
     Show: ⏳ "Syncing..."
     ↓
     Result: ✅ "Imported 42 test cases from Roam"
```

**4. View Repository**
```
Repository Visualization
├─ Project_Kinergy
│  ├─ Folder: QA Automation (12 tests)
│  ├─ Folder: Manual Tests (30 tests)
│  └─ Last sync: 2 minutes ago
├─ [Refresh Sync] button (to update)
└─ Sync status: ✅ Success
```

**5. Refresh** (Ongoing)
```
Repository Visualization
├─ [Refresh Sync] button
     ↓
     Show: ⏳ "Refreshing..."
     ↓
     Result: ✅ "Added 2 new test cases"
     ↓
     Show updated tree
```

---

## Database State After Phase 1A

### Tables Created/Modified

**RoamConfig** (Modified)
```
- id: "abc123"
- projectId: "xyz789"
- graphName: "Project_Kinergy"
- apiToken: "token..." (encrypted)
- apiEndpoint: "http://localhost:8000"
- lastSyncAt: 2026-06-12T14:30:00Z
- lastSyncStatus: "SUCCESS"
- lastSyncError: null
```

**Repository** (Modified)
```
- id: "repo1"
- projectId: "xyz789"
- name: "Project_Kinergy Repository"
- lastSyncAt: 2026-06-12T14:30:00Z
- lastSyncStatus: "success"
- lastSyncError: null
- totalTests: 42
```

**RepositoryNode** (Created)
```
- id: "node1"
- repositoryId: "repo1"
- name: "QA Automation"
- type: "FOLDER"
- tags: ["#Automated"]
- children: [node2, node3, ...]
- createdAt: 2026-06-12T14:30:00Z

- id: "node2"
- repositoryId: "repo1"
- name: "Login Test"
- type: "FILE"
- tags: ["#Manual", "#Smoke"]
- roamPageId: "abc-xyz-123"
- createdAt: 2026-06-12T14:30:00Z
```

**SyncLog** (Created)
```
- id: "log1"
- projectId: "xyz789"
- action: "INITIAL_SYNC"
- status: "SUCCESS"
- nodesAdded: 42
- durationMs: 2340
- createdAt: 2026-06-12T14:30:00Z
```

---

## Success Criteria: Phase 1A

### ✅ Functional Requirements

- [ ] User can enter Roam Graph Name
- [ ] User can enter Roam API Token
- [ ] User can set custom API Endpoint (default: http://localhost:8000)
- [ ] Test Connection button shows clear success/failure
- [ ] Initial Sync imports all pages from Roam
- [ ] Refresh Sync updates changes only
- [ ] Repository tree displays hierarchy
- [ ] Test counts display correctly
- [ ] Tags display on each node
- [ ] Sync status shows last sync time and result

### ✅ Error Handling

- [ ] Cannot connect (server down) - Show helpful message
- [ ] Invalid token - Show clear error
- [ ] Graph not found - Show clear error
- [ ] Network error - Show with retry hint

### ✅ Data Integrity

- [ ] Never delete existing RepositoryNodes
- [ ] Never overwrite existing data
- [ ] SyncLog records every sync operation
- [ ] RoamConfig updates correctly

### ✅ UI/UX

- [ ] Loading states show during operations
- [ ] Success messages are clear
- [ ] Error messages provide troubleshooting hints
- [ ] Tree visualization is readable
- [ ] Responsive design works on mobile

---

## Files Change Summary

### Modified Files: 8
```
prisma/schema.prisma
lib/roam/client.ts
lib/roam/sync.ts
app/api/roam/config/route.ts
app/api/roam/test-connection/route.ts
app/api/roam/sync/route.ts
components/forms/RoamConfigForm.tsx
app/roam/page.tsx (or project details page)
```

### New Files: 5
```
app/api/repository/status/route.ts
components/roam/RoamConnectionTest.tsx
components/roam/SyncStatus.tsx
components/roam/RepositorySyncButton.tsx
components/repository/RepositoryVisualization.tsx
```

### Database Migrations: 1
```
prisma/migrations/1_phase_1a_roam_local_api.sql
```

### Total: 14 files

---

## Implementation Order

1. ✅ Update `prisma/schema.prisma`
2. ✅ Run database migration
3. ✅ Refactor `lib/roam/client.ts`
4. ✅ Implement sync functions in `lib/roam/sync.ts`
5. ✅ Create API routes (config, test-connection, sync, status)
6. ✅ Create UI components (form, test, status, visualization)
7. ✅ Create/update page to integrate all components
8. ✅ Test end-to-end with real Roam instance

---

## Out of Scope (Phase 1A)

- ❌ Push To Roam functionality
- ❌ Review Workflow (Draft/Approved)
- ❌ Automation Detection
- ❌ Test Suite Management
- ❌ Execution Cycles
- ❌ Dashboard Updates
- ❌ Reports
- ❌ Knowledge Hub
- ❌ AI Features
- ❌ Authentication Changes

---

**READY TO IMPLEMENT**

All files identified. All changes documented.  
Ready to begin Phase 1A implementation.

