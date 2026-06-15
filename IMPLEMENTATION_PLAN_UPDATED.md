# QA Ops Platform - Updated Implementation Plan

**Status**: Ready for Implementation (Revised)  
**Date**: June 12, 2026  
**Updates**: Based on clarification answers

---

## Key Decision: Keep Current Authentication

**MAJOR CHANGE**: Per your instruction "Do not redesign authentication in this phase if current authentication is functional," we will:

✅ **KEEP**: Current localStorage-based auth with base64 tokens  
✅ **KEEP**: Current login flow and session management  
✅ **DEFER**: JWT redesign to Phase 2 (future)  
✅ **FOCUS**: On functional QA operations features  

**Impact**: Removes ~20 hours of auth work. Reduces Phase 1 scope significantly.

---

## Revised Priority Order

Instead of Auth → Projects → Repository → Roam → Suites → Cycles → Dashboard → Reports, we now focus on:

### **Phase 1: Roam Local API Integration** (LOWEST RISK, HIGHEST VALUE)
- Migrate from Cloud API to Local API only
- Per-project configurable endpoint
- Connection testing with detailed errors
- Initial sync + refresh sync
- **Risk**: LOW
- **Value**: HIGH - Unblocks all other features
- **Effort**: 15-20 hours
- **Timeline**: 2-3 days

### **Phase 2: Test Case Management & Review Workflow** (MEDIUM RISK, HIGH VALUE)
- Add TestCaseStatus: DRAFT → APPROVED
- Repository read-only sync from Roam
- Tag-based automation classification
- Review workflow UI
- **Risk**: MEDIUM
- **Value**: HIGH - Enables execution
- **Effort**: 20-25 hours
- **Timeline**: 3-4 days

### **Phase 3: Test Suite & Execution** (MEDIUM RISK, MEDIUM VALUE)
- Complete TestSuite CRUD
- ExecutionCycle CRUD
- Test selection (manual/automated)
- Result recording
- **Risk**: MEDIUM
- **Value**: MEDIUM - Core operations
- **Effort**: 25-30 hours
- **Timeline**: 4-5 days

### **Phase 4: Roam Push Implementation** (HIGH RISK, HIGH VALUE)
- On-demand push to Roam
- Only push APPROVED cases
- Append-only protection
- Conflict detection
- **Risk**: HIGH - Data protection critical
- **Value**: HIGH - Roam bidirectional sync
- **Effort**: 15-20 hours
- **Timeline**: 2-3 days

### **Phase 5: Dashboard & Reporting** (LOW RISK, MEDIUM VALUE)
- Update metrics calculations
- Sync status widget
- Manual/Automated breakdown
- Basic reports
- **Risk**: LOW
- **Value**: MEDIUM - Visibility
- **Effort**: 15-20 hours
- **Timeline**: 2-3 days

---

## Revised Implementation Details

### Phase 1: Roam Local API Integration

#### 1.1 Roam Configuration Database Changes

**RoamConfig Schema Update**:
```
model RoamConfig {
  id                String        @id @default(cuid())
  projectId         String        @unique
  project           Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  // Local API configuration (REQUIRED)
  graphName         String        // Graph name in local Roam
  apiToken          String        // Local API token (encrypted)
  apiEndpoint       String        // http://localhost:PORT (configurable per project)
  
  // Sync management
  syncEnabled       Boolean       @default(false)
  syncIntervalMin   Int           @default(15)
  syncDirection     SyncDirection @default(IMPORT_ONLY)
  lastSyncAt        DateTime?
  lastSyncStatus    SyncStatus    @default(NEVER)
  lastSyncError     String?
  lastPushAt        DateTime?
  lastPushStatus    String?
  
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
}
```

**Migration** (1 SQL file):
```sql
-- Rename/modify columns for local API
ALTER TABLE "RoamConfig" RENAME COLUMN "apiKey" TO "apiToken";
ALTER TABLE "RoamConfig" DROP COLUMN "graphUrl";
ALTER TABLE "RoamConfig" ADD COLUMN "apiEndpoint" VARCHAR DEFAULT 'http://localhost:8000';
ALTER TABLE "RoamConfig" ADD COLUMN "lastSyncError" TEXT;
ALTER TABLE "RoamConfig" ADD COLUMN "lastPushAt" TIMESTAMP;
ALTER TABLE "RoamConfig" ADD COLUMN "lastPushStatus" VARCHAR;
```

**Files to modify**:
- `prisma/schema.prisma` - Update RoamConfig model
- `prisma/migrations/1_roam_local_api_config.sql` - Migration

**Risk**: LOW - Column rename is non-destructive

#### 1.2 RoamClient Refactor

**File to modify**: `lib/roam/client.ts`

**Changes**:
```typescript
export class RoamClient {
  private graphName: string
  private apiToken: string
  private apiEndpoint: string  // Per-project endpoint
  
  constructor(
    graphName: string,
    apiToken: string,
    apiEndpoint: string = 'http://localhost:8000'
  ) {
    this.graphName = graphName
    this.apiToken = apiToken
    this.apiEndpoint = apiEndpoint
  }
  
  private async queryDatalog(query: string): Promise<unknown> {
    // NEW: Use configurable endpoint
    const url = `${this.apiEndpoint}/api/graph/${this.graphName}/q`
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      })
      
      if (!response.ok) {
        // Better error messages for local API
        if (response.status === 502 || response.status === 503) {
          throw new Error(
            `Roam local API not running at ${this.apiEndpoint}. ` +
            `Start Roam Desktop or check endpoint configuration.`
          )
        }
        if (response.status === 404) {
          throw new Error(
            `Graph "${this.graphName}" not found in Roam. ` +
            `Check graph name and local Roam instance.`
          )
        }
        if (response.status === 401) {
          throw new Error('Invalid Roam API token')
        }
        throw new Error(`Roam API error: ${response.status}`)
      }
      
      return response.json()
    } catch (error) {
      if (error instanceof Error) throw error
      throw new Error('Failed to connect to Roam')
    }
  }
}
```

**Risk**: LOW - Backward compatible with existing implementation

#### 1.3 Sync Service: Initial + Refresh

**File to modify**: `lib/roam/sync.ts`

**New Functions**:

```typescript
export async function initialSync(projectId: string): Promise<{
  success: boolean
  error?: string
  nodesAdded: number
  syncDurationMs: number
  syncLogId: string
}> {
  const startTime = Date.now()
  
  try {
    // 1. Load Roam config
    const config = await prisma.roamConfig.findUnique({
      where: { projectId },
    })
    
    if (!config) {
      throw new Error('No Roam configuration found')
    }
    
    // 2. Get or create repository
    let repository = await prisma.repository.findFirst({
      where: { projectId },
    })
    
    if (!repository) {
      repository = await prisma.repository.create({
        data: {
          projectId,
          name: `${config.graphName} Repository`,
          description: `Imported from Roam graph: ${config.graphName}`,
        },
      })
    }
    
    // 3. Create Roam client
    const client = new RoamClient(
      config.graphName,
      config.apiToken,
      config.apiEndpoint
    )
    
    // 4. Test connection
    const canConnect = await client.testConnection()
    if (!canConnect) {
      throw new Error('Cannot connect to Roam API')
    }
    
    // 5. Fetch all pages from Roam
    const pages = await client.fetchAllPages()
    
    // 6. Import into database
    const result = await importRoamJSON(pages, repository.id, projectId)
    
    // 7. Update repository sync status
    await prisma.repository.update({
      where: { id: repository.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
        lastSyncError: null,
      },
    })
    
    // 8. Log sync
    const duration = Date.now() - startTime
    const syncLog = await prisma.syncLog.create({
      data: {
        projectId,
        action: 'INITIAL_SYNC',
        status: 'SUCCESS',
        nodesAdded: result.added,
        nodesUpdated: 0,
        nodesSkipped: result.skipped,
        error: result.errors.length > 0 ? result.errors.join('; ') : null,
        durationMs: duration,
      },
    })
    
    // 9. Update Roam config
    await prisma.roamConfig.update({
      where: { projectId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'SUCCESS',
      },
    })
    
    return {
      success: true,
      nodesAdded: result.added,
      syncDurationMs: duration,
      syncLogId: syncLog.id,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    
    // Log failure
    const syncLog = await prisma.syncLog.create({
      data: {
        projectId,
        action: 'INITIAL_SYNC',
        status: 'FAILED',
        error: errorMsg,
        durationMs: duration,
      },
    })
    
    // Update config
    await prisma.roamConfig.update({
      where: { projectId },
      data: {
        lastSyncStatus: 'FAILED',
        lastSyncError: errorMsg,
      },
    }).catch(() => null)
    
    return {
      success: false,
      error: errorMsg,
      nodesAdded: 0,
      syncDurationMs: duration,
      syncLogId: syncLog.id,
    }
  }
}

export async function refreshSync(projectId: string): Promise<{
  success: boolean
  error?: string
  nodesAdded: number
  nodesUpdated: number
  syncDurationMs: number
}> {
  const startTime = Date.now()
  
  try {
    // Similar to initialSync but:
    // 1. Only fetch changes since lastSyncAt
    // 2. Update existing nodes
    // 3. Create new nodes
    // 4. Never delete nodes
    
    const config = await prisma.roamConfig.findUnique({
      where: { projectId },
    })
    
    if (!config) throw new Error('No Roam config')
    
    const repository = await prisma.repository.findFirst({
      where: { projectId },
    })
    
    if (!repository) throw new Error('No repository')
    
    const client = new RoamClient(
      config.graphName,
      config.apiToken,
      config.apiEndpoint
    )
    
    // Fetch pages
    const pages = await client.fetchAllPages()
    
    // Import with delta logic (see importRoamJSON enhancement)
    const result = await importRoamJSONWithDelta(
      pages,
      repository.id,
      projectId,
      config.lastSyncAt // Only update since this time
    )
    
    // Update repository
    await prisma.repository.update({
      where: { id: repository.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
      },
    })
    
    const duration = Date.now() - startTime
    await prisma.syncLog.create({
      data: {
        projectId,
        action: 'REFRESH_SYNC',
        status: 'SUCCESS',
        nodesAdded: result.added,
        nodesUpdated: result.updated,
        nodesSkipped: result.skipped,
        durationMs: duration,
      },
    })
    
    await prisma.roamConfig.update({
      where: { projectId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'SUCCESS',
      },
    })
    
    return {
      success: true,
      nodesAdded: result.added,
      nodesUpdated: result.updated,
      syncDurationMs: duration,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    
    await prisma.syncLog.create({
      data: {
        projectId,
        action: 'REFRESH_SYNC',
        status: 'FAILED',
        error: errorMsg,
        durationMs: duration,
      },
    })
    
    return {
      success: false,
      error: errorMsg,
      nodesAdded: 0,
      nodesUpdated: 0,
      syncDurationMs: duration,
    }
  }
}
```

**Risk**: MEDIUM - Delta sync logic must be tested thoroughly

#### 1.4 API Routes for Local API Configuration

**Files to modify**:
```
app/api/roam/config/route.ts          - Save config, test connection
app/api/roam/test-connection/route.ts - Detailed connection test
app/api/roam/sync/route.ts            - Initial + refresh sync
```

**Enhanced config/route.ts**:
```typescript
export async function POST(req: NextRequest) {
  try {
    const {
      projectId,
      graphName,
      apiToken,
      apiEndpoint = 'http://localhost:8000',
    } = await req.json()
    
    // Validate input
    if (!projectId || !graphName || !apiToken) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Test connection first
    const client = new RoamClient(graphName, apiToken, apiEndpoint)
    const canConnect = await client.testConnection()
    
    if (!canConnect) {
      return NextResponse.json(
        {
          error: 'Cannot connect to Roam API',
          details: {
            endpoint: apiEndpoint,
            graphName,
            hint: 'Verify Roam is running and endpoint is correct',
          },
        },
        { status: 400 }
      )
    }
    
    // Save configuration
    const config = await prisma.roamConfig.upsert({
      where: { projectId },
      create: {
        projectId,
        graphName,
        apiToken: encryptApiKey(apiToken),
        apiEndpoint,
      },
      update: {
        graphName,
        apiToken: encryptApiKey(apiToken),
        apiEndpoint,
      },
    })
    
    return NextResponse.json({
      success: true,
      message: 'Configuration saved. Ready to sync.',
      config: {
        projectId: config.projectId,
        graphName: config.graphName,
        apiEndpoint: config.apiEndpoint,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

**New sync/route.ts**:
```typescript
export async function POST(req: NextRequest) {
  try {
    const { projectId, syncType = 'refresh' } = await req.json()
    
    if (syncType === 'initial') {
      const result = await initialSync(projectId)
      return NextResponse.json(result)
    } else {
      const result = await refreshSync(projectId)
      return NextResponse.json(result)
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

**Risk**: LOW - Straightforward endpoints

#### 1.5 Repository Sync UI

**Files to create**:
```
components/repository/RepositorySyncButton.tsx [NEW]
components/roam/SyncStatusWidget.tsx           [NEW]

app/api/repository/sync/route.ts              [NEW] - Trigger sync
app/api/repository/status/route.ts            [NEW] - Get sync status
```

**RepositorySyncButton.tsx**:
```typescript
export function RepositorySyncButton({ projectId }: { projectId: string }) {
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  
  async function handleSync(type: 'initial' | 'refresh') {
    setSyncing(true)
    setError('')
    
    try {
      const response = await fetch('/api/roam/sync', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          syncType: type,
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || 'Sync failed')
        return
      }
      
      // Success - refresh repository
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }
  
  return (
    <div className="space-y-2">
      <button
        onClick={() => handleSync('initial')}
        disabled={syncing}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {syncing ? 'Syncing...' : 'Initial Sync'}
      </button>
      <button
        onClick={() => handleSync('refresh')}
        disabled={syncing}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {syncing ? 'Syncing...' : 'Refresh Sync'}
      </button>
      {error && <p className="text-red-600">{error}</p>}
    </div>
  )
}
```

**Risk**: LOW - Simple UI

---

### Phase 2: Test Case Management & Review Workflow

#### 2.1 Database Schema Changes

**TestCase Model**:
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
  
  // Existing
  nodes         TestCaseNode[]
  testRuns      TestRun[]
  suites        SuiteTestCase[]
  tags          TagTestCase[]
  
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt
  
  @@index([projectId])
  @@index([status])
}

enum TestCaseStatus {
  DRAFT
  APPROVED
}
```

**RepositoryNode Update**:
```
model RepositoryNode {
  // ... existing fields ...
  
  // NEW: Tag-based classification for automation
  tags          String[]          // ["#Manual", "#Automated", "#API", etc.]
  isAutomated   Boolean           @default(false)  // Computed from tags
  
  @@index([isAutomated])
}
```

**Migration**:
```sql
ALTER TABLE "TestCase" ADD COLUMN "status" VARCHAR DEFAULT 'DRAFT';
ALTER TABLE "TestCase" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "reviewedAt" TIMESTAMP;
CREATE INDEX idx_testcase_status ON "TestCase"("status");

ALTER TABLE "RepositoryNode" ADD COLUMN "tags" TEXT[] DEFAULT '{}';
ALTER TABLE "RepositoryNode" ADD COLUMN "isAutomated" BOOLEAN DEFAULT FALSE;
CREATE INDEX idx_repositorynode_isautomated ON "RepositoryNode"("isAutomated");
```

**Risk**: LOW - Additive changes

#### 2.2 Test Case Review API

**Files to create**:
```
app/api/test-cases/[id]/approve/route.ts   [NEW]
app/api/test-cases/[id]/reject/route.ts    [NEW]
```

**Implementation**:
```typescript
// approve/route.ts
export async function POST(req: NextRequest) {
  try {
    const { id } = await req.params
    const { userId } = await req.json()
    
    const testCase = await prisma.testCase.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedBy: userId,
        reviewedAt: new Date(),
      },
    })
    
    return NextResponse.json({
      success: true,
      testCase,
      message: 'Test case approved. Ready to push to Roam.',
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

**Risk**: LOW - Simple update

#### 2.3 Tag-Based Automation Classification

**New Utility Function**: `lib/utils/automation.ts`

```typescript
export function detectAutomation(
  pageTitle: string,
  tags: string[] = [],
  content?: string
): {
  isAutomated: boolean
  framework?: string
  tags: string[]
} {
  const lowerTitle = pageTitle.toLowerCase()
  const lowerContent = content?.toLowerCase() ?? ''
  const allText = `${lowerTitle} ${lowerContent}`
  
  // Check explicit tags
  const hasManualTag = tags.some(t => t.includes('#Manual'))
  const hasAutomatedTag = tags.some(t =>
    t.includes('#Automated') ||
    t.includes('#API') ||
    t.includes('#Performance')
  )
  
  // Explicit tag takes precedence
  if (hasManualTag) return { isAutomated: false, tags }
  if (hasAutomatedTag) return { isAutomated: true, tags }
  
  // Auto-detect from content keywords
  const automatedKeywords = [
    'selenium',
    'playwright',
    'cypress',
    'automation',
    'api test',
    'load test',
    'performance',
  ]
  
  const isAutomated = automatedKeywords.some(kw => allText.includes(kw))
  
  // Determine framework
  let framework: string | undefined
  if (allText.includes('selenium')) framework = 'Selenium'
  else if (allText.includes('playwright')) framework = 'Playwright'
  else if (allText.includes('cypress')) framework = 'Cypress'
  else if (allText.includes('api')) framework = 'API'
  
  return { isAutomated, framework, tags }
}
```

**Risk**: LOW - Detection is best-effort, can be corrected manually

#### 2.4 UI Components for Review Workflow

**Files to create**:
```
components/test-cases/TestCaseReview.tsx      [NEW]
components/test-cases/ApprovalStatusBadge.tsx [NEW]
components/test-cases/ReviewModal.tsx         [NEW]
```

**Risk**: LOW - UI only

---

### Phase 3: Test Suite & Execution

#### 3.1 TestSuite CRUD

**Files to modify**:
```
app/api/test-suites/route.ts              [MODIFY] - Add POST
app/api/test-suites/[id]/route.ts         [MODIFY] - Add PUT, DELETE
app/api/test-suites/[id]/tests/route.ts   [NEW] - Manage tests
```

**API Endpoints**:
```
GET    /api/test-suites?projectId=X       - List suites
POST   /api/test-suites                   - Create suite
GET    /api/test-suites/[id]              - Get suite details
PUT    /api/test-suites/[id]              - Update suite
DELETE /api/test-suites/[id]              - Delete suite
POST   /api/test-suites/[id]/tests        - Add tests
DELETE /api/test-suites/[id]/tests/[tcId] - Remove test
```

**Risk**: LOW - Standard CRUD

#### 3.2 ExecutionCycle CRUD

**Files to modify**:
```
app/api/execution-cycles/route.ts           [MODIFY]
app/api/execution-cycles/[id]/route.ts      [MODIFY]
app/api/execution-cycles/[id]/execute/route.ts [NEW] - Execute test
```

**API Endpoints**:
```
GET    /api/execution-cycles?projectId=X         - List cycles
POST   /api/execution-cycles                     - Create cycle
GET    /api/execution-cycles/[id]                - Get cycle
PUT    /api/execution-cycles/[id]                - Update status
POST   /api/execution-cycles/[id]/execute        - Execute test & record result
```

**Result Recording**:
```typescript
// POST /api/execution-cycles/[id]/execute
interface ExecuteTestRequest {
  testCaseId: string
  executedBy: string
  status: 'PASS' | 'FAIL' | 'BLOCKED'
  result?: string
  durationMs?: number
  attachmentUrls?: string[]
}
```

**Risk**: LOW - Straightforward operations

#### 3.3 UI Components

**Files to create**:
```
app/test-suites/page.tsx                           [MODIFY/NEW]
components/suites/SuiteForm.tsx                    [MODIFY]
components/suites/SuiteTestCaseSelector.tsx        [NEW]

app/cycles/page.tsx                                [MODIFY/NEW]
components/cycles/ExecutionCycleForm.tsx           [NEW]
components/cycles/TestExecutor.tsx                 [NEW]
components/cycles/ResultRecorder.tsx               [NEW]
```

**Risk**: MEDIUM - Complex UI workflows

---

### Phase 4: Roam Push Implementation

#### 4.1 Roam Push Design

**CRITICAL REQUIREMENTS**:
- ✅ Only push APPROVED test cases
- ✅ Only append new content to Roam
- ✅ Never modify existing Roam content
- ✅ Never delete existing Roam content
- ✅ Never overwrite existing Roam content
- ✅ Conflict detection & error handling

#### 4.2 Append-Only Push Logic

**New Service**: `lib/roam/exporter.ts`

```typescript
export async function pushApprovedTestCasesToRoam(
  projectId: string
): Promise<{
  success: boolean
  error?: string
  pushed: number
  skipped: number
  conflicts: number
}> {
  try {
    // 1. Load Roam config
    const config = await prisma.roamConfig.findUnique({
      where: { projectId },
    })
    
    if (!config) throw new Error('No Roam config')
    
    // 2. Get all APPROVED test cases not yet pushed
    const testCases = await prisma.testCase.findMany({
      where: {
        projectId,
        status: 'APPROVED',
        // Exclude already pushed (via lastPushedAt check)
      },
      include: {
        nodes: {
          include: { node: true },
        },
      },
    })
    
    if (testCases.length === 0) {
      return { success: true, pushed: 0, skipped: 0, conflicts: 0 }
    }
    
    // 3. For each test case, create Roam page
    const client = new RoamClient(
      config.graphName,
      config.apiToken,
      config.apiEndpoint
    )
    
    let pushed = 0
    let conflicts = 0
    
    for (const testCase of testCases) {
      try {
        // Check if page already exists in Roam (conflict detection)
        const existingPage = await checkPageExists(client, testCase.title)
        
        if (existingPage) {
          conflicts++
          continue // Skip if exists (don't overwrite)
        }
        
        // Create new page in Roam (append only)
        await createPageInRoam(client, testCase)
        
        // Track push
        await prisma.testCase.update({
          where: { id: testCase.id },
          data: {
            roamPageId: generateId(), // Store Roam page ID
          },
        })
        
        pushed++
      } catch (error) {
        console.error(`Failed to push test case ${testCase.id}:`, error)
      }
    }
    
    // 4. Log push operation
    await prisma.syncLog.create({
      data: {
        projectId,
        action: 'PUSH_TO_ROAM',
        status: conflicts === 0 ? 'SUCCESS' : 'PARTIAL',
        nodesAdded: pushed,
        nodesSkipped: conflicts,
        error: conflicts > 0 ? `${conflicts} conflicts detected` : null,
      },
    })
    
    // 5. Update config
    await prisma.roamConfig.update({
      where: { projectId },
      data: {
        lastPushAt: new Date(),
        lastPushStatus: conflicts === 0 ? 'SUCCESS' : 'PARTIAL',
      },
    })
    
    return {
      success: true,
      pushed,
      skipped: 0,
      conflicts,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: msg, pushed: 0, skipped: 0, conflicts: 0 }
  }
}

async function checkPageExists(
  client: RoamClient,
  pageTitle: string
): Promise<boolean> {
  // Query Roam to see if page with this title exists
  const query = `[:find ?e :where [?e :node/title "${pageTitle}"]]`
  const result = await client.queryDatalog(query)
  return Array.isArray(result) && result.length > 0
}

async function createPageInRoam(
  client: RoamClient,
  testCase: TestCase
): Promise<void> {
  // Create new page with test case content
  // Convert test case to Roam format
  // Use client.writePage() to append
}
```

**Risk**: HIGH - Must handle all edge cases

#### 4.3 Push API & UI

**Files to create**:
```
app/api/roam/push/route.ts              [NEW]
components/roam/PushToRoamButton.tsx    [NEW]
components/roam/PushConflictDialog.tsx  [NEW]
```

**Push Dialog Flow**:
1. User clicks "Push To Roam"
2. Dialog shows: X approved test cases ready to push
3. Click "Push"
4. Show progress: "Pushing X of Y..."
5. Show results:
   - ✅ Pushed: X
   - ⚠️ Conflicts: Y (not pushed due to existing content)
   - Recommendation to resolve conflicts manually in Roam

**Risk**: HIGH - User communication critical

---

### Phase 5: Dashboard & Reporting

#### 5.1 Dashboard Updates

**Files to modify**:
```
lib/services/dashboard.service.ts       [MODIFY]
app/api/dashboard/route.ts             [MODIFY]
app/dashboard/page.tsx                 [MODIFY]
```

**New Metrics**:
```typescript
interface UpdatedMetrics {
  // Test Status
  totalTests: number
  draftTests: number
  approvedTests: number
  
  // Manual vs Automated
  manualTests: number
  automatedTests: number
  
  // Roam Integration
  lastSyncAt: DateTime | null
  lastSyncStatus: 'success' | 'failed' | 'never'
  lastPushAt: DateTime | null
  lastPushStatus: 'success' | 'partial' | 'failed' | null
  pendingApproval: number
  pendingPush: number
  
  // Execution
  activeCycles: number
  passRate: number | null
  failRate: number | null
  blockedRate: number | null
}
```

**New Dashboard Widgets**:
1. **Pending Approvals** - Count of DRAFT tests with approval action
2. **Pending Push** - Count of APPROVED tests not yet pushed to Roam
3. **Sync Status** - Last sync time, result, ability to refresh
4. **Manual vs Automated** - Pie chart breakdown
5. **Test Status Breakdown** - Draft, Approved, Executed counts

**Risk**: LOW - Display only

#### 5.2 Reporting

**Files to create**:
```
app/api/reports/execution/route.ts       [NEW]
app/api/reports/coverage/route.ts        [NEW]
app/reports/page.tsx                     [NEW]
components/reports/ExecutionReport.tsx   [NEW]
components/reports/CoverageReport.tsx    [NEW]
```

**Execution Report**:
- Cycle name, date range, status
- Pass/Fail/Blocked counts and percentages
- Test results table
- Export to CSV

**Coverage Report**:
- Total tests, draft, approved
- Manual, automated counts
- Test per tag
- Charts

**Risk**: LOW - Read-only, no side effects

---

## Risk & Value Analysis

### Phase 1: Roam Local API Integration

**Risk Level**: 🟢 LOW
- Minimal schema changes
- Backward compatible
- Errors are clear
- No data mutations

**Business Value**: 🔴 CRITICAL
- Unblocks all downstream features
- Enables Roam synchronization
- Solves Cloud API limitation
- Core requirement

**Recommendation**: ✅ **START HERE**

**Why**: No dependencies, highest value, lowest risk

---

### Phase 2: Test Case Review Workflow

**Risk Level**: 🟡 MEDIUM
- Delta sync logic complex
- Tag classification needs testing
- Review workflow must be clear

**Business Value**: 🟠 HIGH
- Enables test execution
- Protects Roam content
- Approval governance
- Essential for operations

**Dependencies**: Requires Phase 1 complete

---

### Phase 3: Test Suite & Execution

**Risk Level**: 🟡 MEDIUM
- Complex UI workflows
- Multiple state management
- Results tracking

**Business Value**: 🟠 HIGH
- Core QA operations feature
- Enables teams to execute tests
- Primary use case

**Dependencies**: Requires Phase 2

---

### Phase 4: Roam Push Implementation

**Risk Level**: 🔴 HIGH
- Append-only logic critical
- Conflict detection complex
- Data protection paramount
- Irreversible operation

**Business Value**: 🟠 MEDIUM-HIGH
- Bidirectional sync
- Roam as source of truth
- Useful but not blocking

**Dependencies**: Requires Phase 1-3

**Recommendation**: Thorough testing, staged rollout

---

### Phase 5: Dashboard & Reporting

**Risk Level**: 🟢 LOW
- Read-only operations
- Display logic only
- No side effects

**Business Value**: 🟢 MEDIUM
- Visibility & insights
- Not critical for operations
- Nice to have

**Dependencies**: Requires Phase 1-3

---

## Recommended Implementation Starting Point

### ✅ **START: Phase 1 - Roam Local API Integration**

**Why This First**:

1. **Lowest Risk** - Only configuration changes, no data mutations
2. **Highest Value** - Unblocks all other features
3. **No Dependencies** - Can start immediately
4. **Clear Success Criteria** - Connection test + sync works
5. **Fast Iteration** - Can test with real Roam locally
6. **Foundation** - All other phases depend on this

**Phase 1 Timeline**: 2-3 days (15-20 hours)

**Success Criteria**:
- ✅ RoamConfig updated for local API
- ✅ RoamClient uses configurable endpoint
- ✅ Initial sync imports all pages
- ✅ Refresh sync updates changes only
- ✅ Error handling for offline Roam
- ✅ Test with local Roam Desktop instance

### 📋 **THEN: Phase 2 - Test Case Review Workflow**

**Why This Second**:
1. Builds on Phase 1 foundation
2. Enables Phase 3 (execution)
3. Protects Roam content (APPROVED gate)
4. Medium risk, high value

**Phase 2 Timeline**: 3-4 days (20-25 hours)

### 🎯 **THEN: Phase 3 - Test Suite & Execution**

**Why This Third**:
1. Primary use case
2. Requires review workflow
3. Teams can start executing tests
4. Medium risk, high value

**Phase 3 Timeline**: 4-5 days (25-30 hours)

### 🔒 **THEN: Phase 4 - Roam Push**

**Why This Fourth**:
1. High risk, requires extensive testing
2. Depends on Phases 1-3
3. Useful but not critical
4. Needs careful implementation

**Phase 4 Timeline**: 2-3 days (15-20 hours)

### 📊 **THEN: Phase 5 - Dashboard & Reports**

**Why This Last**:
1. Low risk
2. Depends on other phases
3. Visibility feature
4. Nice to have

**Phase 5 Timeline**: 2-3 days (15-20 hours)

---

## Total Implementation Effort

| Phase | Effort | Timeline |
|-------|--------|----------|
| Phase 1: Roam Local API | 15-20 hrs | 2-3 days |
| Phase 2: Review Workflow | 20-25 hrs | 3-4 days |
| Phase 3: Suite & Execution | 25-30 hrs | 4-5 days |
| Phase 4: Roam Push | 15-20 hrs | 2-3 days |
| Phase 5: Dashboard & Reports | 15-20 hrs | 2-3 days |
| **TOTAL** | **90-115 hrs** | **4-5 weeks** |

---

## Key Decisions Made

1. ✅ **Keep Current Auth** - Do not redesign, current system is functional
2. ✅ **Local API Only** - Remove Cloud API, per-project configurable endpoint
3. ✅ **On-Demand Push** - User clicks "Push To Roam" button explicitly
4. ✅ **Tag-Based Classification** - Use tags (#Manual, #Automated, etc.) for automation detection
5. ✅ **Draft Execution** - Can execute DRAFT tests but cannot push them
6. ✅ **Append-Only Roam** - Never modify/delete/overwrite existing content
7. ✅ **Phased Approach** - Start with lowest risk, highest value

---

## Next Steps

Upon approval:

1. ✅ Begin Phase 1: Roam Local API Integration
2. ✅ Implement RoamConfig updates
3. ✅ Refactor RoamClient for local API
4. ✅ Implement initial + refresh sync
5. ✅ Create sync UI components
6. ✅ Test with local Roam Desktop

**Estimated Phase 1 Completion**: 2-3 days

---

**Status**: READY FOR IMPLEMENTATION PHASE 1

**Approval Checkpoint**: Ready to begin Roam Local API Integration?

