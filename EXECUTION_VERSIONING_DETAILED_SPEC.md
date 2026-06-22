# Execution Cycle Versioning System - Detailed Specification

**Status:** DETAILED SPEC - AWAITING FINAL APPROVAL BEFORE IMPLEMENTATION  
**Date:** 2026-06-22  
**Version:** 2.0 (Updated with architectural decisions)

---

## ARCHITECTURAL DECISIONS INCORPORATED

### 1. Build Version Format - APPROVED ✅

**Decision**: Flexible string format, not strict semantic versioning

**Format Rules**:
```
Allowed formats:
  ✓ 2.4.1
  ✓ v2.4.1
  ✓ Build-456
  ✓ Sprint-24-UAT
  ✓ Release-2026.06.22

Processing:
  1. Required field (cannot be empty/null)
  2. Trim whitespace (leading/trailing)
  3. Case-insensitive uniqueness check per cycle

Database Constraint:
  UNIQUE(cycleId, LOWER(buildVersion))
  
  Example:
  Cycle A + "2.4.1" = OK
  Cycle A + "2.4.1" (duplicate) = ERROR
  Cycle A + "2.4.1" and Cycle B + "2.4.1" = OK (different cycles)

Error Handling:
  Status: 409 Conflict
  Message: "Build version already exists for this cycle."
```

---

### 2. Draft Version Rules - APPROVED ✅

**Decision**: Only ONE active Draft/In Progress version per cycle

**Enforcement**:
```
Rule: At most 1 version with status in (DRAFT, IN_PROGRESS)

Valid State:
  Cycle "Sprint 12 Regression"
  ├─ V1 - COMPLETED ✓
  ├─ V2 - COMPLETED ✓
  └─ V3 - IN_PROGRESS ✓

Invalid State:
  Cycle "Sprint 12 Regression"
  ├─ V3 - DRAFT ✗ Cannot create
  ├─ V4 - DRAFT ← Blocked (V3 still DRAFT/IN_PROGRESS)
  
Error:
  Status: 400 Bad Request
  Message: "Complete or delete the current draft version 
            before creating a new execution version."

Transitions Required:
  DRAFT → COMPLETED (Complete Execution)
  DRAFT → DELETED (Delete Draft)
  IN_PROGRESS → COMPLETED (Complete Execution)
  IN_PROGRESS → ARCHIVED (Archive after view)
```

---

### 3. Version Deletion Rules - APPROVED ✅

**Decision**: DRAFT deletable, COMPLETED archivable only

**Implementation**:
```
Status Enum Change:
  OLD: DRAFT, IN_PROGRESS, COMPLETED
  NEW: DRAFT, IN_PROGRESS, COMPLETED, ARCHIVED, DELETED

Version States:
  DRAFT
    ├─ Can delete: DELETE endpoint
    ├─ Can edit: Full edit capability
    ├─ Database: DELETE from ExecutionVersion
    └─ Reason: Incomplete, not yet locked

  IN_PROGRESS
    ├─ Can delete: NO (in execution)
    ├─ Can only: Complete or Archive
    └─ Reason: Partially executed, keep history

  COMPLETED
    ├─ Can delete: NO (must preserve history)
    ├─ Can archive: Yes, soft delete
    ├─ Status change: COMPLETED → ARCHIVED
    └─ Reason: Auditability & regression tracking

  ARCHIVED
    ├─ Status: Locked
    ├─ Display: Hidden by default, restorable
    ├─ Reason: Historical preservation
    └─ Can restore: Yes, ARCHIVED → COMPLETED

Rationale:
  "Execution history must always be preserved for auditability 
   and regression tracking."
```

---

### 4. Release Notes - APPROVED ✅

**Decision**: OPTIONAL field per version

**Implementation**:
```
ExecutionVersion Fields:
  buildVersion       STRING NOT NULL
  releaseNotes       TEXT NULL (OPTIONAL)
  
UI Behavior:
  Create Version Form:
    Build Version: [Required Input]
    Release Notes: [Optional Textarea]
    
    Example:
    Build Version: 2.4.1
    Release Notes:
      • Fixed Login issue
      • Fixed Checkout API
      • Updated Billing UI

  Display:
    If releaseNotes present: Show in version card
    If null: Show "No release notes" (placeholder)

Workflow:
  1. User creates version without notes: OK
  2. User can edit notes after creation: Yes
  3. User can clear notes: Yes
  4. Cannot require notes for completion: Enforced
```

---

### 5. Metrics Requirements - APPROVED ✅

**Decision**: Support BOTH version-level and cycle-level metrics

#### A. Version-Level Metrics

```
Per ExecutionVersion:
  totalTests        INT
  passCount         INT
  failCount         INT
  blockedCount      INT
  notExecutedCount  INT
  passRate          FLOAT (calculated: passCount / totalTests * 100)

Calculation:
  On Complete Execution:
    totalTests = COUNT(TestRun WHERE versionId = X)
    passCount = COUNT(TestRun WHERE versionId = X AND status = PASS)
    failCount = COUNT(TestRun WHERE versionId = X AND status = FAIL)
    blockedCount = COUNT(TestRun WHERE versionId = X AND status = BLOCKED)
    notExecutedCount = COUNT(TestRun WHERE versionId = X AND status = NOT_EXECUTED)
    passRate = (passCount / totalTests) * 100

Display:
  Version Card:
    Version 1 - Build 2.4.0 - COMPLETED
    Pass Rate: 85% (17/20)
    Results: 17 ✓ | 2 ✗ | 1 ⊗ | 0 ○
```

#### B. Cycle-Level Metrics (Across All Versions)

```
Per ExecutionCycle (aggregated from all versions):
  totalVersions           INT
  latestPassRate          FLOAT
  previousPassRate        FLOAT
  newFailures             INT
  fixedFailures           INT
  regressionCount         INT
  trendAnalysis           ARRAY[{version, passRate, date}]

Calculations:
  totalVersions = COUNT(ExecutionVersion WHERE cycleId = X)
  
  latestPassRate = (Latest COMPLETED or IN_PROGRESS version).passRate
  
  previousPassRate = (Second latest COMPLETED or IN_PROGRESS version).passRate
  
  newFailures = COUNT(
    Tests where:
      Latest version: FAIL
      Previous version: NOT FAIL
  )
  
  fixedFailures = COUNT(
    Tests where:
      Latest version: NOT FAIL
      Previous version: FAIL
  )
  
  regressionCount = COUNT(
    Tests where:
      Latest version: FAIL
      Previous version: PASS
  )
  
  trendAnalysis = [
    {version: "2.4.0", passRate: 85%, date: "2026-06-20"},
    {version: "2.4.1", passRate: 88%, date: "2026-06-21"},
    {version: "2.4.2", passRate: 90%, date: "2026-06-22"},
    {version: "2.4.3", passRate: 92%, date: "2026-06-23"}
  ]

Display Example:
  Pass Rate Trend:
    2.4.0 → 85%
    2.4.1 → 88% (+3%)
    2.4.2 → 90% (+2%)
    2.4.3 → 92% (+2%)
    
  Quality Metrics:
    New Failures: 1
    Fixed Failures: 2
    Regressions: 0
    Stable Tests: 18/20
```

---

## UPDATED PRISMA SCHEMA

### Core Tables

```prisma
enum VersionStatus {
  DRAFT
  IN_PROGRESS
  COMPLETED
  ARCHIVED
  DELETED
}

model ExecutionCycle {
  id              String
  projectId       String
  name            String
  description     String?
  
  // Version management
  versions        ExecutionVersion[]
  currentVersionId String?
  currentVersion  ExecutionVersion? @relation("CurrentActive", fields: [currentVersionId], references: [id])
  
  // Metadata
  status          CycleStatus
  sourceSuiteId   String?
  sourceSuite     TestSuite? @relation(...)
  createdBy       String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([projectId, id])
  @@index([projectId])
  @@index([currentVersionId])
}

model ExecutionVersion {
  id                    String @id @default(cuid())
  cycleId               String
  cycle                 ExecutionCycle @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  
  // Version identification
  buildVersion          String        // Flexible format: "2.4.1", "v2.4.1", "Build-456", etc.
  versionNumber         Int           // Sequence: 1, 2, 3...
  
  // Status lifecycle
  status                VersionStatus @default(DRAFT)
  displayStatus         String        @default("DRAFT")  // ACTIVE, ARCHIVED for UI
  
  // Metrics (calculated on completion)
  totalTests            Int           @default(0)
  passCount             Int           @default(0)
  failCount             Int           @default(0)
  blockedCount          Int           @default(0)
  notExecutedCount      Int           @default(0)
  passRate              Float         @default(0.0)  // Percentage 0-100
  
  // Timing & ownership
  createdAt             DateTime      @default(now())
  createdBy             String?
  completedAt           DateTime?
  completedBy           String?
  archivedAt            DateTime?
  archivedBy            String?
  
  // Optional content
  releaseNotes          String?       @db.Text  // OPTIONAL
  
  // Relations
  testRuns              TestRun[]
  cycleActive           ExecutionCycle? @relation("CurrentActive")
  
  // Constraints
  @@unique([cycleId, LOWER(buildVersion)])  // Case-insensitive
  @@index([cycleId])
  @@index([status])
  @@index([createdAt])
}

model TestRun {
  id                String @id @default(cuid())
  versionId         String
  version           ExecutionVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)
  testCaseId        String
  testCase          TestCase @relation(fields: [testCaseId], references: [id], onDelete: Cascade)
  
  // Execution data
  status            RunStatus @default(NOT_EXECUTED)
  executedBy        String?
  executedAt        DateTime?
  durationMs        Int?
  
  // Evidence & notes
  comments          RunComment[]
  jiraLinks         JiraLink[]
  attachments       RunAttachment[]
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([versionId])
  @@index([testCaseId])
  @@index([status])
}

model RunComment {
  id                String @id @default(cuid())
  runId             String
  run               TestRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  content           String
  author            String?
  createdAt         DateTime @default(now())
  
  @@index([runId])
}

model JiraLink {
  id                String @id @default(cuid())
  runId             String
  run               TestRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  issueKey          String
  issueUrl          String?
  issueType         String?
  summary           String?
  createdAt         DateTime @default(now())
  
  @@index([runId])
}

model RunAttachment {
  id                String @id @default(cuid())
  runId             String
  run               TestRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  name              String
  url               String
  sizeBytes         Int?
  mimeType          String?
  createdAt         DateTime @default(now())
  
  @@index([runId])
}
```

---

## UPDATED ERD DIAGRAM

### Relationship Structure

```
ExecutionCycle (1)
    ├─ currentVersion ────→ ExecutionVersion (1)
    └─ versions (1:N)────→ ExecutionVersion (Many)
                              ├─ testRuns (1:N)────→ TestRun (Many)
                              │                         ├─ comments (1:N)
                              │                         ├─ jiraLinks (1:N)
                              │                         └─ attachments (1:N)
                              └─ displayStatus (ACTIVE/ARCHIVED)

Key Relationships:
  • ExecutionCycle.currentVersionId → ExecutionVersion.id
  • ExecutionVersion.cycleId → ExecutionCycle.id
  • TestRun.versionId → ExecutionVersion.id
  • UNIQUE(cycleId, LOWER(buildVersion)) prevents duplicate versions per cycle
  • Only 1 version with status in (DRAFT, IN_PROGRESS) per cycle (enforced at API)
  • Version can be COMPLETED or ARCHIVED (not deleted if completed)
```

---

## MIGRATION STRATEGY

### Phase 1: Schema Extension (Non-breaking)

```
1. Add ExecutionVersion table
   - All columns nullable initially
   - No data migration yet
   - Duration: 1 migration file

2. Rename TestRun.cycleId → versionId
   - Keep cycleId temporarily (backward compat)
   - Add versionId as nullable
   - Update indexes

3. Add status management columns
   - ExecutionVersion.status (DRAFT)
   - ExecutionVersion.displayStatus (ACTIVE)
   - ExecutionVersion.archivedAt
   - ExecutionVersion.releaseNotes
```

### Phase 2: Data Migration

```
For each ExecutionCycle with testRuns:
  1. Fetch all testRuns for this cycle
  2. Create ExecutionVersion:
     - buildVersion: "1.0.0"
     - versionNumber: 1
     - status: COMPLETED (old executions are done)
     - displayStatus: ACTIVE
     - Calculate metrics from testRuns
  3. Link all testRuns to new version
  4. Set cycle.currentVersionId = this version.id
  5. Verify migration (count matches)

Validation:
  Before: ExecutionCycle → TestRun count
  After: ExecutionCycle → ExecutionVersion → TestRun count
  (Must match exactly)
```

### Phase 3: Code Cutover

```
1. Update API queries to use version
2. Update UI to show version selector
3. Deprecate cycle-level test run queries
4. Enable version creation UI
5. Deploy with backward compat layer
```

---

## API CONTRACT

### New Endpoints

```
POST /api/execution-cycles/{cycleId}/versions
  Create new execution version
  
  Body:
    {
      buildVersion: "2.4.1" | "v2.4.1" | "Build-456" | etc.
      releaseNotes?: "Optional release notes...",
      clonePreviousVersion?: true  // NEW: Copy tests from previous
    }
  
  Response:
    {
      id: "version-123",
      cycleId: "cycle-456",
      buildVersion: "2.4.1",
      versionNumber: 2,
      status: "DRAFT",
      testRuns: [...]  // Cloned from previous if requested
    }
  
  Validations:
    - buildVersion: Required, trimmed, case-insensitive unique
    - No other DRAFT/IN_PROGRESS version exists
    - clonePreviousVersion: If true, copy from latest completed version
  
  Errors:
    409: "Build version already exists for this cycle."
    400: "Complete or delete the current draft version..."

---

GET /api/execution-cycles/{cycleId}/versions
  List all versions (paginated)
  
  Query:
    ?status=DRAFT|IN_PROGRESS|COMPLETED|ARCHIVED
    ?limit=20&offset=0
  
  Response:
    {
      versions: [
        {
          id, buildVersion, versionNumber, status, displayStatus,
          totalTests, passCount, failCount, blockedCount, notExecutedCount,
          passRate, createdAt, completedAt, releaseNotes
        }
      ],
      total: 10,
      limit: 20,
      offset: 0
    }

---

GET /api/execution-cycles/{cycleId}/versions/{versionId}
  Get full version with test runs
  
  Response:
    {
      id, cycleId, buildVersion, versionNumber, status, displayStatus,
      totalTests, passCount, failCount, blockedCount, notExecutedCount,
      passRate, releaseNotes,
      testRuns: [
        {
          id, testCaseId, status, comments, jiraLinks, attachments,
          executedBy, executedAt
        }
      ]
    }

---

PUT /api/execution-cycles/{cycleId}/versions/{versionId}
  Update version metadata
  
  Body:
    {
      releaseNotes?: "Updated notes...",
      status?: "DRAFT" | "IN_PROGRESS"  // Can only change if not COMPLETED
    }
  
  Validations:
    - Cannot change status if COMPLETED
    - Cannot change buildVersion
  
  Response:
    Updated ExecutionVersion

---

PATCH /api/execution-cycles/{cycleId}/versions/{versionId}/complete
  Complete/finalize execution
  
  Body:
    {
      completedBy: "user@email.com"
    }
  
  Actions:
    1. status → COMPLETED
    2. completedAt → now()
    3. displayStatus → ACTIVE
    4. Calculate and store metrics
    5. Lock version (read-only)
  
  Response:
    Completed ExecutionVersion

---

DELETE /api/execution-cycles/{cycleId}/versions/{versionId}
  Delete DRAFT version
  
  Validations:
    - Only DRAFT versions can be deleted
    - Cannot delete COMPLETED versions
  
  Errors:
    400: "Only DRAFT versions can be deleted."
    409: "Cannot delete completed version. Archive instead."

---

POST /api/execution-cycles/{cycleId}/versions/{versionId}/archive
  Archive COMPLETED version (soft delete)
  
  Body:
    {
      archivedBy: "user@email.com"
    }
  
  Actions:
    1. status → ARCHIVED
    2. archivedAt → now()
    3. displayStatus → ARCHIVED
    4. Version hidden from main list, still queryable
  
  Response:
    Archived ExecutionVersion

---

GET /api/execution-cycles/{cycleId}/versions/compare
  Compare versions side-by-side
  
  Query:
    ?versions=v1,v2,v3
    ?viewType=changes|stable|regressions|all
  
  Response:
    {
      comparison: [
        {
          testCaseId,
          testCaseName,
          v1: "PASS",
          v2: "PASS",
          v3: "FAIL",
          change: "REGRESSION"
        }
      ],
      summary: {
        newFailures: [testIds],
        fixedFailures: [testIds],
        regressions: [testIds],
        stableTests: count,
        changedTests: count
      }
    }

---

GET /api/execution-cycles/{cycleId}/metrics
  Get cycle-level metrics
  
  Query:
    ?version=latest  // or specific version ID
  
  Response:
    {
      // Version-level
      currentVersion: {
        versionNumber, buildVersion, status, passRate,
        totalTests, passCount, failCount, blockedCount, notExecutedCount
      },
      
      // Cycle-level (across all versions)
      cycleMetrics: {
        totalVersions: 3,
        latestPassRate: 92,
        previousPassRate: 88,
        newFailures: 1,
        fixedFailures: 2,
        regressions: 0
      },
      
      // Trend
      trend: [
        {versionNumber: 1, buildVersion: "2.4.0", passRate: 85, date: "2026-06-20"},
        {versionNumber: 2, buildVersion: "2.4.1", passRate: 88, date: "2026-06-21"},
        {versionNumber: 3, buildVersion: "2.4.2", passRate: 90, date: "2026-06-22"},
        {versionNumber: 4, buildVersion: "2.4.3", passRate: 92, date: "2026-06-23"}
      ]
    }

---

PATCH /api/test-runs/{runId}
  Update test run (NO auto-save)
  
  Body:
    {
      status: "PASS" | "FAIL" | "BLOCKED" | "NOT_EXECUTED"
    }
  
  Behavior:
    - Updates test run in database immediately
    - BUT does not recalculate version metrics
    - Metrics only update on "Complete Execution"
  
  Response:
    Updated TestRun

---

POST /api/test-runs/{runId}/comments
  Add comment to test run
  
  Body:
    {
      content: "Test failed due to timeout",
      author: "user@email.com"
    }
  
  Response:
    RunComment

---

POST /api/test-runs/{runId}/jira-links
  Link Jira issue to test run
  
  Body:
    {
      issueKey: "PROJ-123",
      issueUrl?: "https://jira...",
      issueType?: "Bug",
      summary?: "Login timeout issue"
    }
  
  Response:
    JiraLink

---

POST /api/execution-cycles/{cycleId}/save-draft
  Explicitly save draft version work
  
  Body:
    {
      versionId: "version-123"
    }
  
  Actions:
    - Persist all pending changes to database
    - Recalculate metrics
    - Keep status as DRAFT/IN_PROGRESS
  
  Response:
    Saved ExecutionVersion with updated metrics
```

---

## UI MOCKUPS & FLOWS

### 1. Cycle Detail - Version Selector

```
┌──────────────────────────────────────────────────────────┐
│ Execution Cycle: "Sprint 12 Regression"                 │
├──────────────────────────────────────────────────────────┤

┌─ VERSION SELECTOR ────────────────────────────────────────┐
│ [v] Version 4 - Build 2.4.3 - IN_PROGRESS (Active)      │
│     Version 3 - Build 2.4.2 - COMPLETED                 │
│     Version 2 - Build 2.4.1 - COMPLETED                 │
│     Version 1 - Build 2.4.0 - COMPLETED                 │
│                                                          │
│ [+ New Version]  [Delete Draft (if applicable)]         │
└──────────────────────────────────────────────────────────┘

CLICKING "New Version" OPENS MODAL...

┌─────────────────────────────────────────────────────────┐
│ Create New Execution Version                            │
├─────────────────────────────────────────────────────────┤
│ Cycle: Sprint 12 Regression                             │
│ Current Draft: None (ready to create)                   │
│                                                         │
│ Build Version: [v2.4.3____________]                     │
│ Examples: 2.4.1, v2.4.1, Build-456, Sprint-24-UAT      │
│                                                         │
│ Release Notes (Optional):                               │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ • Fixed Login timeout                               │ │
│ │ • Improved Checkout performance                     │ │
│ │ • Updated Payment UI                                │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ☑ Copy test cases from previous version                 │
│   (Preserves structure, resets statuses)               │
│                                                         │
│ [Cancel] [Create Version]                               │
├─────────────────────────────────────────────────────────┤
│ ERROR (if build version exists):                        │
│ "Build version already exists for this cycle."         │
└─────────────────────────────────────────────────────────┘
```

### 2. Cycle Detail - Test Execution (Not Auto-Save)

```
┌──────────────────────────────────────────────────────────┐
│ Version 4 - Build 2.4.3 - IN_PROGRESS                   │
├──────────────────────────────────────────────────────────┤

┌─ METRICS (Calculated on Complete) ────────────────────────┐
│ Status: IN_PROGRESS                                      │
│ Progress: 8/20 tests marked (12 still not executed)      │
│ Current Pass Rate: To be calculated on completion        │
└──────────────────────────────────────────────────────────┘

┌─ TEST EXECUTION TABLE ────────────────────────────────────┐
│ # │ Test Case    │ Status      │ By    │ Actions         │
├───┼──────────────┼─────────────┼───────┼─────────────────┤
│ 1 │ Login Valid  │ [Pass ▼]    │ john  │ [✎] [🔗] [📎]  │
│ 2 │ Login Invalid│ [Fail ▼]    │ jane  │ [✎] [🔗] [📎]  │
│ 3 │ Logout       │ [Blocked ▼] │ john  │ [✎] [🔗] [📎]  │
│ 4 │ Checkout     │ [Not Ex ▼]  │ -     │ [✎] [🔗] [📎]  │
│...│              │             │       │                 │
└───┴──────────────┴─────────────┴───────┴─────────────────┘

CLICKING [✎] OPENS COMMENT PANEL FOR THAT TEST...

┌────────────────────────────────────────┐
│ Comments - Test 2: Login Invalid       │
├────────────────────────────────────────┤
│ [x] john (2026-06-22 10:30 AM)         │
│ "Failed due to database timeout"       │
│ [Delete]                               │
│                                        │
│ [x] jane (2026-06-22 11:00 AM)         │
│ "Reproduced in UAT also"               │
│ [Delete]                               │
│                                        │
│ New Comment:                           │
│ ┌──────────────────────────────────┐  │
│ │ Enter comment...                  │  │
│ └──────────────────────────────────┘  │
│ [Add Comment]                          │
└────────────────────────────────────────┘

CLICKING [🔗] OPENS JIRA LINK PANEL...

┌────────────────────────────────────────┐
│ Jira Links - Test 2: Login Invalid     │
├────────────────────────────────────────┤
│ [Link] QA-456                          │
│ Type: Bug | Summary: Login timeout     │
│ URL: https://jira.../browse/QA-456    │
│ [Remove Link]                          │
│                                        │
│ Add New Link:                          │
│ Issue Key: [QA-____]                   │
│ [Link] [Cancel]                        │
└────────────────────────────────────────┘

┌─ ACTION BUTTONS ──────────────────────────────────────────┐
│ [Save Draft]  [Complete Execution]  [Compare with V3]    │
├──────────────────────────────────────────────────────────┤
│ NOTE: Changes NOT saved automatically.                   │
│       Click [Save Draft] to persist work.                │
│       Click [Complete Execution] to finalize & lock.     │
└──────────────────────────────────────────────────────────┘
```

### 3. Version Comparison

```
┌──────────────────────────────────────────────────────────┐
│ Version Comparison: Sprint 12 Regression                 │
├──────────────────────────────────────────────────────────┤

Compare Versions: [v] V1 (2.4.0) [v] V2 (2.4.1) [v] V3 (2.4.2) [v] V4 (2.4.3)
View: [All] [New Failures] [Fixed] [Regressions] [Stable]

┌────────────────────────────────────────────────────────────────────┐
│ Test Results Comparison                                            │
│ ┌──────────────┬─────────┬─────────┬─────────┬─────────┬─────────┐ │
│ │ Test Case    │   V1    │   V2    │   V3    │   V4    │ Status  │ │
│ ├──────────────┼─────────┼─────────┼─────────┼─────────┼─────────┤ │
│ │ Login Valid  │  PASS   │  PASS   │  PASS   │  FAIL   │REGRESS.│ │
│ │ Login Invalid│  FAIL   │  PASS   │  PASS   │  PASS   │ FIXED  │ │
│ │ Logout       │  PASS   │  PASS   │  BLOCKED│  PASS   │CHANGED │ │
│ │ Checkout     │  FAIL   │  FAIL   │  PASS   │  PASS   │ FIXED  │ │
│ │ Payment      │  FAIL   │  FAIL   │  FAIL   │  FAIL   │ BROKEN │ │
│ │ Refund       │  PASS   │  PASS   │  PASS   │  PASS   │STABLE  │ │
│...│              │         │         │         │         │        │ │
│ └──────────────┴─────────┴─────────┴─────────┴─────────┴─────────┘ │
└────────────────────────────────────────────────────────────────────┘

COMPARISON SUMMARY

┌────────────────────────────────────────────────────────────────────┐
│ Metrics: V4 (2.4.3) vs Previous (V3 - 2.4.2)                     │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ Pass Rate:          90% (V3) → 87% (V4)  [-3%] ↓                 │
│                                                                    │
│ New Failures:       1 (Login Valid)      [🔴]                    │
│ Fixed Failures:     1 (Login Invalid)    [🟢]                    │
│ Regressions:        1                    [🔴]                    │
│ Stable Tests:       15/20                [✓]                     │
│                                                                    │
│ Test Coverage:      20/20 (100%)         [✓]                     │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 4. Dashboard - Version Selector & Metrics

```
┌──────────────────────────────────────────────────────────┐
│ Dashboard                                                │
├──────────────────────────────────────────────────────────┤

Cycle: [Sprint 12 Regression]

View Version: [Latest ▼]
  Options: Latest
           Version 4 - Build 2.4.3 (IN_PROGRESS)
           Version 3 - Build 2.4.2 (COMPLETED)
           Version 2 - Build 2.4.1 (COMPLETED)
           Version 1 - Build 2.4.0 (COMPLETED)

┌─ VERSION METRICS ────────────────────────────────────────┐
│ Version 4 - Build 2.4.3 - IN_PROGRESS                   │
│                                                          │
│ Pass Rate: 87%  Trend: ↓ (was 90%)  [Chart]             │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ │ 17      │ │ 2       │ │ 1       │ │ 0       │        │
│ │ Passed  │ │ Failed  │ │ Blocked │ │ Not Ex  │        │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
└──────────────────────────────────────────────────────────┘

┌─ BUILD QUALITY ──────────────────────────────────────────┐
│ New Failures:      1  [🔴 Login Valid]                   │
│ Fixed Failures:    1  [🟢 Login Invalid]                 │
│ Regressions:       1  [🔴]                               │
│ Stable Tests:      15/20                                 │
└──────────────────────────────────────────────────────────┘

┌─ PASS RATE TREND ────────────────────────────────────────┐
│ Build 2.4.0: 85%                                         │
│ Build 2.4.1: 88% ↑                                       │
│ Build 2.4.2: 90% ↑                                       │
│ Build 2.4.3: 87% ↓                                       │
│                                                          │
│ [Graph visualization]                                   │
│        90%  ╱╲                                           │
│        88% ╱  ╲87%                                       │
│        85% ╱    ╲                                        │
│      2.4.0  2.4.1  2.4.2  2.4.3                          │
└──────────────────────────────────────────────────────────┘

┌─ VERSION HISTORY ────────────────────────────────────────┐
│ V4 │ Build 2.4.3 │ IN_PROGRESS │ 2h ago  │ 17/2/1/0    │
│ V3 │ Build 2.4.2 │ COMPLETED   │ 1d ago  │ 18/1/1/0    │
│ V2 │ Build 2.4.1 │ COMPLETED   │ 2d ago  │ 17/2/1/0    │
│ V1 │ Build 2.4.0 │ COMPLETED   │ 3d ago  │ 17/3/0/0    │
│    │             │             │         │             │
│ [View V3] [View V2] [View V1]  [Compare All]           │
└──────────────────────────────────────────────────────────┘
```

---

## BACKWARD COMPATIBILITY ASSESSMENT

### Breaking Changes

```
1. TestRun.cycleId → versionId
   IMPACT: HIGH
   MITIGATION: Gradual migration with compatibility layer
   
2. Cycle.testRuns relationship changes
   IMPACT: MEDIUM
   MITIGATION: New cycle.versions relationship, old API deprecated
   
3. Metrics calculation timing
   OLD: Real-time per test change
   NEW: Calculated on "Complete Execution"
   IMPACT: MEDIUM
   MITIGATION: Save Draft provides manual calculation
```

### Non-Breaking Changes

```
1. ExecutionVersion is new table
   - No existing code affected
   - Additive change
   
2. ExecutionCycle retains all old fields
   - Backward compatible
   - currentVersionId is optional
   
3. New enums (VersionStatus, displayStatus)
   - Additive
   - Existing code unaffected
```

### Migration Compatibility Layer

```
During Migration Phase (Weeks 1-2):

1. Both old and new APIs work
   - GET /cycles/{id}/test-runs → Uses version internally
   - GET /cycles/{id}/versions/{vid}/test-runs → Direct query

2. Data duplication avoided
   - Single source: ExecutionVersion.testRuns
   - Cycle-level access proxied through version

3. Legacy queries:
   - ExecutionCycle.testRuns (deprecated) → Redirect to current version
   - Cycle status → Computed from current version status

After Migration (Week 3+):
   - Old APIs marked deprecated in code comments
   - Can remove in next major version
   - No forced cutover
```

---

## DATA MIGRATION PLAN

### Pre-Migration Validation

```
1. Count validation
   SELECT COUNT(*) FROM ExecutionCycle;
   SELECT COUNT(*) FROM TestRun;
   → Store baseline counts

2. Relationship check
   SELECT cycleId, COUNT(*) FROM TestRun
   GROUP BY cycleId
   → Verify every cycle has runs

3. Backup
   CREATE TABLE ExecutionCycle_backup AS SELECT * FROM ExecutionCycle;
   CREATE TABLE TestRun_backup AS SELECT * FROM TestRun;
```

### Migration Script

```
FOR EACH ExecutionCycle (in batches of 1000):
  1. SELECT all testRuns for this cycle
  2. CREATE ExecutionVersion:
       buildVersion: "1.0.0"
       versionNumber: 1
       status: COMPLETED
       displayStatus: ACTIVE
       createdBy: NULL
       createdAt: cycle.createdAt
       completedAt: cycle.updatedAt
  
  3. UPDATE TestRun:
       versionId: new version.id
       (Keep cycleId temporarily)
  
  4. CALCULATE metrics:
       totalTests: COUNT(testRun)
       passCount: COUNT WHERE status = PASS
       failCount: COUNT WHERE status = FAIL
       blockedCount: COUNT WHERE status = BLOCKED
       notExecutedCount: COUNT WHERE status = NOT_EXECUTED
       passRate: (passCount / totalTests) * 100
  
  5. UPDATE ExecutionCycle:
       currentVersionId: new version.id
  
  6. VERIFY counts match

POST-MIGRATION:
  1. Compare row counts
  2. Spot-check 10 random cycles
  3. Verify metrics calculations
  4. Test API with old and new queries
```

### Rollback Plan

```
IF migration fails:
  1. ROLLBACK transaction (auto-rollback if incomplete)
  2. Restore from backup:
       TRUNCATE ExecutionVersion;
       DROP TABLE ExecutionVersion;
  3. Restore cycle/testrun original state
  4. Zero data loss (transaction atomic)

IF bugs found post-migration:
  1. Keep backup tables for 30 days
  2. Can re-run migration with fixes
  3. Zero customer impact (backward compat layer)
```

---

## RISK ANALYSIS

### Risk Matrix

| Risk | Probability | Impact | Severity | Mitigation |
|------|-------------|--------|----------|-----------|
| Data loss during migration | Low | Critical | HIGH | Transaction-based, backup, rollback tested |
| Duplicate versions created | Medium | Medium | MEDIUM | UNIQUE constraint + API validation |
| Metrics calculation errors | Medium | Medium | MEDIUM | Spot-check in backup, re-calculate script |
| UI performance with many versions | Low | Low | LOW | Pagination, lazy-load test runs |
| Legacy API backward compatibility | Low | High | MEDIUM | Compatibility layer for 1 release |
| Concurrent version creation | Low | Medium | MEDIUM | Database-level constraint + app lock |

### Mitigation Strategies

```
1. Transaction Wrapper
   - All migration in single transaction
   - All-or-nothing atomic operation
   - Any error rolls back completely

2. Pre-Migration Testing
   - Run on copy of production data
   - Validate counts and metrics
   - Test both old and new APIs
   
3. Staged Rollout
   - Phase 1: Staging environment
   - Phase 2: Canary (5% of users)
   - Phase 3: Full production
   
4. Monitoring
   - Alert on metric calculation anomalies
   - Monitor duplicate version attempts
   - Track legacy vs new API usage
   
5. Quick Rollback
   - Backup tables kept for 30 days
   - Documented rollback procedure
   - Test rollback before production
```

---

## ROLLBACK STRATEGY

### Immediate Rollback (< 24 hours)

```
IF critical bug discovered:
  1. Identify issue from monitoring/logs
  2. Stop accepting new version creations
  3. Restore from backup (automated script):
       TRUNCATE ExecutionVersion CASCADE;
       RESTORE FROM backup.sql;
       TRUNCATE TestRun_new CASCADE;
       RESTORE TestRun FROM backup;
  4. Revert code to previous release
  5. Verify data consistency
  6. Re-enable normal operations

Recovery time: ~1 hour
Data loss: None (backup is current)
```

### Staged Rollback (24-72 hours)

```
IF issue affects data but not critical:
  1. Keep new system online
  2. Implement workaround/patch
  3. Test fix in staging
  4. Deploy fix to production
  5. Monitor for 48 hours
  6. If stable, decomission backup

Recovery time: Variable
Data loss: None
```

### Post-Production Analysis

```
For all incidents:
  1. Capture logs and metrics
  2. Root cause analysis
  3. Update risk matrix
  4. Implement preventive measures
  5. Update migration runbook
  6. Share lessons learned
```

---

## APPROVAL CHECKLIST

- [ ] **Schema Design**: ExecutionVersion model and relationships
- [ ] **Build Version Format**: Flexible string with case-insensitive uniqueness
- [ ] **Draft Version Rules**: Only 1 Draft/In Progress per cycle
- [ ] **Version Deletion**: Draft deletable, Completed archivable
- [ ] **Release Notes**: Optional field
- [ ] **Metrics**: Both version-level and cycle-level with trends
- [ ] **Clone Feature**: Copy tests from previous version
- [ ] **Comparison View**: Side-by-side version comparison
- [ ] **Workflow**: Save Draft vs Complete Execution
- [ ] **Dashboard**: Version selector with dynamic metrics
- [ ] **API Contract**: All endpoints documented
- [ ] **UI Mockups**: Flow and screens designed
- [ ] **Migration Strategy**: Phased approach with validation
- [ ] **Backward Compatibility**: Compatibility layer documented
- [ ] **Risk Analysis**: Risks identified and mitigated
- [ ] **Rollback Strategy**: Clear rollback procedures

---

## FINAL SIGN-OFF

**Status**: Ready for implementation approval

**Recommendation**: All architectural decisions approved. Proceed to:
  1. Create Prisma migration files
  2. Implement API endpoints
  3. Build UI components
  4. Execute phased migration
  5. Deploy to production

**Estimated Timeline**: 17 days from approval to production deployment

---

