# Execution Cycle Versioning System - Architectural Proposal

**Status:** ANALYSIS & PROPOSAL (Awaiting Approval)  
**Date:** 2026-06-22  
**Scope:** Major Redesign - Production-Grade Execution Versioning  

---

## EXECUTIVE SUMMARY

Current execution cycle system lacks versioning, making it unsuitable for real QA workflows. This proposal introduces a production-grade versioning system that supports:
- Pause/Resume execution without creating new versions
- Multiple executions of the same suite against different builds
- Historical comparison and regression tracking
- Execution state management (Draft → In Progress → Completed)
- Read-only archival of completed executions

**Key Change:** Separate Execution Cycles (logical test runs) from Execution Versions (physical build-specific runs)

---

## CURRENT STATE ANALYSIS

### Current Schema Structure

```
ExecutionCycle (1)
    ↓
TestRun (Many)
    ├─ RunComment
    ├─ JiraLink
    └─ RunAttachment
```

### Current Problems

| Problem | Impact | Business Risk |
|---------|--------|---------------|
| No build version tracking | Cannot compare same suite across builds | Cannot identify regressions |
| No execution versioning | Pause/resume creates confusion | Lost execution context |
| No state management | All cycles treated equally | Cannot enforce read-only on completed |
| Flat test run structure | No grouping by version | Cannot compare test results across builds |
| No execution history | Each run overwrites previous | No audit trail or historical comparison |
| No draft support | Changes auto-save | User cannot review before completion |

### Current Limitations

```
Scenario: Execute Suite for Build 2.4.0
  ├─ Mark 5 tests Pass
  ├─ Add comments on 2 tests
  ├─ Get interrupted
  └─ Leave session

Result: NO WAY to resume - must start over

---

Scenario: New Build 2.4.1 arrives
  ├─ Want to re-run same suite
  ├─ Previous results lost
  └─ Cannot compare: "Did this test pass before?"
```

---

## PROPOSED ARCHITECTURE

### Key Concept: Execution Versioning

**Execution Cycle** = Logical test run container  
**Execution Version** = Physical version tied to a build

```
ExecutionCycle "Login Tests"
├── ExecutionVersion 1 (Build 2.4.0) [COMPLETED]
│   └── 10 TestRuns
├── ExecutionVersion 2 (Build 2.4.1) [IN_PROGRESS]
│   └── 10 TestRuns
└── ExecutionVersion 3 (Build 2.4.2) [DRAFT]
    └── 10 TestRuns
```

### Proposed Schema Changes

#### New Tables

**1. ExecutionVersion**
```prisma
model ExecutionVersion {
  id                    String
  cycleId               String          // Link to parent cycle
  buildVersion          String          // e.g., "2.4.0"
  versionNumber         Int             // Sequence: 1, 2, 3...
  status                VersionStatus   // DRAFT, IN_PROGRESS, COMPLETED
  
  // Metrics
  passCount             Int             @default(0)
  failCount             Int             @default(0)
  blockedCount          Int             @default(0)
  notExecutedCount      Int             @default(0)
  
  // Timing
  createdAt             DateTime        @default(now())
  createdBy             String?
  completedAt           DateTime?
  completedBy           String?
  
  // Content
  releaseNotes          String?         @db.Text
  
  // Relations
  cycle                 ExecutionCycle  @relation(...)
  testRuns              TestRun[]       // Updated to link to version
  
  @@unique([cycleId, buildVersion])  // Prevent duplicate versions
  @@index([cycleId])
}

enum VersionStatus {
  DRAFT
  IN_PROGRESS
  COMPLETED
}
```

#### Modified Tables

**ExecutionCycle** (No breaking changes)
```prisma
model ExecutionCycle {
  id              String
  projectId       String
  name            String
  description     String?
  status          CycleStatus          @default(PLANNED)
  // NEW: Version management
  currentVersionId String?              // Link to active version
  currentVersion  ExecutionVersion?     @relation("CurrentVersion", ...)
  
  // RENAMED: testRuns → versions
  versions        ExecutionVersion[]
  
  // Keep existing fields for backward compat
  startDate       DateTime?
  endDate         DateTime?
  createdBy       String?
  sourceSuiteId   String?
  sourceSuite     TestSuite?            @relation(...)
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt
}
```

**TestRun** (Enhanced)
```prisma
model TestRun {
  id              String
  versionId       String              // NEW: Link to version instead of cycle
  version         ExecutionVersion    @relation(...)
  testCaseId      String
  testCase        TestCase            @relation(...)
  
  status          RunStatus           @default(NOT_EXECUTED)
  executedBy      String?
  executedAt      DateTime?
  durationMs      Int?
  
  // Existing relations
  comments        RunComment[]
  jiraLinks       JiraLink[]
  attachments     RunAttachment[]
  
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt
  
  @@index([versionId])     // NEW
  @@index([testCaseId])
}
```

### Database Migration Strategy

#### Phase 1: Add New Tables (Non-breaking)
```sql
-- Create ExecutionVersion table
CREATE TABLE ExecutionVersion (
  id VARCHAR(255) PRIMARY KEY,
  cycleId VARCHAR(255) NOT NULL,
  buildVersion VARCHAR(50) NOT NULL,
  versionNumber INT NOT NULL,
  status VARCHAR(50) DEFAULT 'DRAFT',
  passCount INT DEFAULT 0,
  failCount INT DEFAULT 0,
  blockedCount INT DEFAULT 0,
  notExecutedCount INT DEFAULT 0,
  createdAt TIMESTAMP DEFAULT NOW(),
  createdBy VARCHAR(255),
  completedAt TIMESTAMP NULL,
  completedBy VARCHAR(255),
  releaseNotes TEXT,
  UNIQUE(cycleId, buildVersion),
  FOREIGN KEY(cycleId) REFERENCES ExecutionCycle(id) ON DELETE CASCADE
);

-- Add new columns to ExecutionCycle (nullable)
ALTER TABLE ExecutionCycle ADD COLUMN currentVersionId VARCHAR(255);
ALTER TABLE ExecutionCycle ADD COLUMN currentVersionId_fk VARCHAR(255);

-- Add new column to TestRun (nullable initially)
ALTER TABLE TestRun ADD COLUMN versionId VARCHAR(255);
```

#### Phase 2: Data Migration
```sql
-- For each existing ExecutionCycle:
-- 1. Create ExecutionVersion with buildVersion = "1.0.0" (default)
-- 2. Copy testRuns to link to new version
-- 3. Calculate metrics from testRuns
-- 4. Set status = COMPLETED

INSERT INTO ExecutionVersion (id, cycleId, buildVersion, versionNumber, status, ...)
SELECT 
  CONCAT('version-', id, '-1'),
  id,
  '1.0.0',
  1,
  'COMPLETED',
  ...
FROM ExecutionCycle;

-- Link testRuns to versions
UPDATE TestRun 
SET versionId = CONCAT('version-', cycleId, '-1')
WHERE versionId IS NULL;
```

#### Phase 3: Make Columns Non-nullable
```sql
-- After verification
ALTER TABLE TestRun MODIFY COLUMN versionId VARCHAR(255) NOT NULL;
ALTER TABLE TestRun DROP COLUMN cycleId;  -- Cycle link now through version
```

---

## ENTITY RELATIONSHIP DIAGRAM

### Current ERD
```
ExecutionCycle ──(1:N)──→ TestRun ──(1:N)──→ RunComment
                          ├─(1:N)─→ JiraLink
                          └─(1:N)─→ RunAttachment
```

### Proposed ERD
```
ExecutionCycle ──(1:N)──→ ExecutionVersion ──(1:N)──→ TestRun ──(1:N)──→ RunComment
                                                       ├─(1:N)─→ JiraLink
                                                       └─(1:N)─→ RunAttachment

Key Relationships:
- ExecutionCycle.currentVersionId → ExecutionVersion (active version)
- ExecutionVersion.cycleId → ExecutionCycle (parent)
- TestRun.versionId → ExecutionVersion (version tracking)
- UNIQUE(cycleId, buildVersion) prevents duplicate versions
```

---

## API CHANGES REQUIRED

### New Endpoints

```
POST   /api/execution-cycles/{cycleId}/versions
       Create new execution version
       Body: { buildVersion: "2.4.1", releaseNotes?: "..." }
       Response: ExecutionVersion object
       Validations:
       - buildVersion must match pattern: \d+\.\d+\.\d+
       - UNIQUE(cycleId, buildVersion) constraint enforced
       - Error: "Build version already exists for this cycle"

GET    /api/execution-cycles/{cycleId}/versions
       List all versions for cycle
       Response: ExecutionVersion[] (ordered by versionNumber DESC)

GET    /api/execution-cycles/{cycleId}/versions/{versionId}
       Get specific version with all test runs
       Response: ExecutionVersion + TestRun[]

PUT    /api/execution-cycles/{cycleId}/versions/{versionId}
       Update version metadata
       Body: { releaseNotes?, status? }
       Status transitions: DRAFT → IN_PROGRESS → COMPLETED

PATCH  /api/execution-cycles/{cycleId}/versions/{versionId}/complete
       Finalize version execution
       Body: { completedBy: email }
       Actions:
       - Set status = COMPLETED
       - Set completedAt = now()
       - Calculate and store metrics
       - Lock version (read-only)
       Response: Completed ExecutionVersion

GET    /api/execution-cycles/{cycleId}/versions/compare
       Compare multiple versions
       Query: ?versions=v1,v2,v3
       Response: {
         results: [
           {
             testCaseId,
             testCaseName,
             results: { v1: "PASS", v2: "PASS", v3: "FAIL" }
           }
         ],
         newFailures: [...],
         fixedFailures: [...],
         regressionCount: N
       }
```

### Modified Endpoints

```
GET    /api/test-runs/{runId}
       Response: TestRun (with versionId instead of cycleId)

POST   /api/test-runs
       Now requires: { versionId, testCaseId, ... }

PATCH  /api/test-runs/{runId}
       Update test run status
       Body: { status: "PASS" | "FAIL" | "BLOCKED" | "NOT_EXECUTED" }
       Note: Does NOT auto-save to database
       - Changes stored in-memory in UI
       - Explicit save required

POST   /api/execution-cycles/{cycleId}/save-draft
       Save current version work without completing
       Body: { versionId }
       Action: Persist in-memory changes to database
       Response: Saved ExecutionVersion with updated metrics
```

---

## UI FLOW CHANGES

### Cycle Detail Page - Updated Flow

```
┌─────────────────────────────────────────────────────┐
│ Execution Cycle: "Login Tests" (Smoke Suite)        │
├─────────────────────────────────────────────────────┤

┌─ VERSION SELECTOR ──────────────────────────────────┐
│ [v] Version 3 - Build 2.4.2 - DRAFT (Active)       │
│     Version 2 - Build 2.4.1 - COMPLETED             │
│     Version 1 - Build 2.4.0 - COMPLETED             │
└─────────────────────────────────────────────────────┘

┌─ VERSION METADATA ──────────────────────────────────┐
│ Build: 2.4.2                                        │
│ Status: DRAFT                                       │
│ Created: 2026-06-22 10:30 AM by john@qa.com        │
│ Release Notes: [editable text area]                │
└─────────────────────────────────────────────────────┘

┌─ TEST RESULTS & FILTERS ────────────────────────────┐
│ [All] [Passed: 7] [Failed: 2] [Blocked: 1] [Not Ex: 0] │
│ [Show Changes vs Previous] [New Failures] [Fixed]      │
│ Search: [_____________]                                │
└─────────────────────────────────────────────────────┘

┌─ TEST EXECUTION TABLE ──────────────────────────────┐
│ # │ Test Case    │ Status   │ Exec By │ Comments   │
├───┼──────────────┼──────────┼─────────┼────────────┤
│ 1 │ Login Valid  │ [Pass ▼] │ john    │ [✎] [🔗]  │
│ 2 │ Login Invalid│ [Fail ▼] │ jane    │ [✎] [🔗]  │
│ 3 │ Logout       │ [Not Ex ▼]│ -      │ [ ] [ ]   │
└─────────────────────────────────────────────────────┘

┌─ ACTION BUTTONS ────────────────────────────────────┐
│ [Save Draft] [Complete Execution] [Compare Versions]│
└─────────────────────────────────────────────────────┘
```

### New Execution Version Modal

```
┌─────────────────────────────────────────┐
│ Create New Execution Version            │
├─────────────────────────────────────────┤
│ Cycle: Login Tests                      │
│                                         │
│ Build Version: [2.4.2___________]       │
│ (format: X.Y.Z)                         │
│                                         │
│ Release Notes (optional):               │
│ ┌─────────────────────────────────────┐ │
│ │ Fixed checkout flow                 │ │
│ │ Improved timeout handling           │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Cancel] [Create Version]               │
├─────────────────────────────────────────┤
│ ERROR (if exists):                      │
│ "Build version 2.4.2 already exists"   │
└─────────────────────────────────────────┘
```

### Version Comparison View

```
┌─────────────────────────────────────────────────────┐
│ Version Comparison: Login Tests                     │
├─────────────────────────────────────────────────────┤

[Version Selector]
Compare: V1 (2.4.0) vs V2 (2.4.1) vs V3 (2.4.2)

┌─────────────────────────────────────────────────────┐
│ Results Summary                                     │
│ ┌──────────┬─────┬─────┬─────┐                     │
│ │ Test Case│  V1 │  V2 │  V3 │                     │
│ ├──────────┼─────┼─────┼─────┤                     │
│ │ Login    │✓Pass│✓Pass│✗Fail│ [REGRESSION]      │
│ │ Logout   │✓Pass│✓Pass│✓Pass│ [STABLE]          │
│ │ Checkout │✗Fail│✓Pass│✓Pass│ [FIXED]           │
│ │ Payment  │✗Fail│✗Fail│✗Fail│ [BROKEN]          │
│ └──────────┴─────┴─────┴─────┘                     │
│                                                     │
│ Metrics:                                            │
│ • New Failures: 1 (Login)                           │
│ • Fixed Failures: 1 (Checkout)                      │
│ • Regressions: 1                                    │
│ • Stable Tests: 6                                   │
└─────────────────────────────────────────────────────┘
```

### Dashboard - Version Metrics

```
┌─────────────────────────────────────────────────────┐
│ Dashboard                                           │
├─────────────────────────────────────────────────────┤

Version Selector: [Latest ▼]
(Options: Latest, V1, V2, V3)

┌─ EXECUTION METRICS (V3) ────────────────────────────┐
│ Pass Rate: 70% (7/10)      Trend: ↓ (was 80%)     │
│ Failures: 2                New: 1                   │
│ Blocked: 1                 Regression: 1           │
│ Not Executed: 0            Fixed: 1                │
└─────────────────────────────────────────────────────┘

┌─ VERSION HISTORY ───────────────────────────────────┐
│ V3 │ 2.4.2 │ DRAFT      │ 3h ago  │ 7/2/1/0       │
│ V2 │ 2.4.1 │ COMPLETED  │ 1d ago  │ 8/1/1/0       │
│ V1 │ 2.4.0 │ COMPLETED  │ 3d ago  │ 7/3/0/0       │
└─────────────────────────────────────────────────────┘

┌─ PASS RATE TREND ───────────────────────────────────┐
│ Graph: 70% ↓ 80% → 73% ↑ 70%                       │
│        V1  V2   V3                                  │
└─────────────────────────────────────────────────────┘
```

---

## WORKFLOW SCENARIOS

### Scenario 1: Pause & Resume (Same Version)

```
TIME 1 (Morning):
  User logs in
  ├─ Open Cycle: "Login Tests"
  ├─ Active Version: V1 (Build 2.4.0) [DRAFT]
  ├─ Mark Test 1: PASS
  ├─ Mark Test 2: FAIL + Add Comment
  ├─ Add Jira Link: PROJ-123
  ├─ Click [Save Draft]
  │  └─ Action: Persist changes to database, status stays DRAFT
  └─ Log out

TIME 2 (Afternoon):
  User logs in
  ├─ Open Cycle: "Login Tests"
  ├─ Active Version: V1 (Build 2.4.0) [DRAFT]
  ├─ All previous work visible: Test 1 PASS, Test 2 FAIL, comments intact
  ├─ Continue from Test 3
  ├─ Mark Test 3-10
  ├─ Click [Complete Execution]
  │  └─ Action: Status → COMPLETED, version locked, metrics finalized
  └─ Log out

RESULT:
✅ No new version created
✅ Execution remains contiguous
✅ All work preserved
✅ State machine: DRAFT → IN_PROGRESS → COMPLETED
```

### Scenario 2: New Build (Create New Version)

```
TIME 1 (Build 2.4.0):
  ├─ Execute Suite: "Login Tests"
  ├─ Version 1 created (Build 2.4.0)
  ├─ Run 10 tests, store results
  ├─ Click [Complete Execution]
  └─ Status: COMPLETED (read-only)

TIME 2 (Build 2.4.1 released):
  ├─ Click [+ New Version]
  ├─ Enter Build Version: 2.4.1
  ├─ Click [Create Version]
  │  └─ Validation: Unique(cycleId, "2.4.1")
  ├─ New Version 2 created (Build 2.4.1) [DRAFT]
  ├─ Run same 10 tests again
  │  └─ Test results can differ from V1
  ├─ Click [Compare Versions]
  │  └─ See: "Login: PASS→FAIL (REGRESSION)"
  ├─ Click [Complete Execution]
  └─ Status: COMPLETED

RESULT:
✅ New version created with new buildVersion
✅ Previous results (V1) remain unchanged
✅ Historical comparison available
✅ Regressions identified: Login test
```

---

## STATE MACHINE

```
ExecutionVersion States:

                   ┌──────────────────────┐
                   │      DRAFT           │
                   │  (Initial state)     │
                   └──────────┬───────────┘
                              │
                    [Save Draft] or continue
                              │
                              ▼
                   ┌──────────────────────┐
                   │   IN_PROGRESS        │
                   │  (User executing)    │
                   └──────────┬───────────┘
                              │
                  [Complete Execution]
                              │
                              ▼
                   ┌──────────────────────┐
                   │    COMPLETED         │
                   │  (Locked/Read-only)  │
                   └──────────────────────┘

Transitions:
- DRAFT → DRAFT (Save Draft)
- DRAFT → IN_PROGRESS (implicit on first test change)
- IN_PROGRESS → IN_PROGRESS (continued execution)
- IN_PROGRESS → COMPLETED (Complete Execution button)
- COMPLETED → ✗ (No transitions, read-only)

Operations by State:
- DRAFT: Full edit, Save Draft, Complete
- IN_PROGRESS: Full edit, Save Draft, Complete
- COMPLETED: Read-only (display metrics only)
```

---

## BACKWARD COMPATIBILITY ASSESSMENT

### Breaking Changes
```
1. TestRun schema change
   - Remove: cycleId
   - Add: versionId
   - BREAKING: Any code querying TestRun by cycleId must use version

2. ExecutionCycle.testRuns relationship
   - Changes from direct to through ExecutionVersion
   - BREAKING: Direct access to cycle.testRuns invalid

3. Cycle listing API
   - Response structure stays same
   - BREAKING: None (cycles themselves unchanged)
```

### Non-Breaking Changes
```
1. ExecutionCycle retains all existing fields
   - Can coexist with new versioning
   - Old cycles automatically migrated to V1

2. New endpoints are additive
   - Existing endpoints remain (with version awareness)
   - Gradual migration possible

3. UI can support both old and new flows
   - Legacy cycles show single "V1" auto-created
   - New cycles show full versioning UI
```

### Migration Path

```
PHASE 1: Dual Mode (2 weeks)
  ├─ Old system works as-is
  ├─ New version tables exist but unused
  ├─ Data migration staged
  └─ Testing in parallel

PHASE 2: Automatic Migration (1 day)
  ├─ All existing cycles → Create V1 automatically
  ├─ All testRuns linked to new versions
  ├─ Metrics calculated and stored
  └─ No downtime (transaction-wrapped)

PHASE 3: New Versioning Live (ongoing)
  ├─ Users create new versions explicitly
  ├─ Old cycles still visible (as V1)
  ├─ Full feature parity
  └─ Deprecate old cycle-level operations

PHASE 4: Cleanup (3 months later, optional)
  ├─ Remove deprecated cycle-level testRuns relation
  ├─ Simplify API surface
  └─ Full new model
```

---

## VALIDATION RULES

### Build Version Validation

```
Rule 1: Format
  Pattern: ^\d+\.\d+\.\d+$
  Examples:
    ✓ 2.4.0
    ✓ 10.20.30
    ✗ v2.4.0 (no "v" prefix)
    ✗ 2.4 (incomplete)

Rule 2: Uniqueness
  UNIQUE(cycleId, buildVersion)
  
  Attempt:
  POST /cycles/cycle1/versions
  { buildVersion: "2.4.0" }
  
  Response:
  ✗ 409 Conflict
  "Build version 2.4.0 already exists for this cycle.
   To execute again, create a new version:
   e.g., 2.4.1, 2.4.2, or edit release notes of existing version."

Rule 3: Required Field
  buildVersion: required
  Cannot create version without buildVersion

Rule 4: Immutable After Completion
  Once status = COMPLETED:
  ├─ buildVersion: locked
  ├─ versionNumber: locked
  ├─ testRuns: locked
  └─ Can only view metrics, cannot edit

Rule 5: One Draft Per Cycle
  At most one version with status = DRAFT
  
  Attempt:
  POST /cycles/cycle1/versions
  { buildVersion: "2.4.2" }
  
  When: Cycle already has DRAFT version
  Response:
  ✗ 400 Bad Request
  "Cycle already has a DRAFT version.
   Complete the current version first or
   choose 'Continue' to resume existing version."
```

---

## APPROVAL CHECKLIST

Before implementation, please review and approve:

- [ ] **Schema Design**: Do the new tables (ExecutionVersion) meet requirements?
- [ ] **API Design**: Are the endpoints and validations appropriate?
- [ ] **State Machine**: Does the DRAFT→IN_PROGRESS→COMPLETED flow work for your workflow?
- [ ] **Migration Strategy**: Is the phased approach acceptable?
- [ ] **UI Flow**: Do the new screens and interactions align with your vision?
- [ ] **Backward Compatibility**: Can we migrate existing data automatically?
- [ ] **Version Comparison**: Does the diff view meet your needs?
- [ ] **Build Version Format**: Is the X.Y.Z semantic versioning suitable?
- [ ] **Read-Only Enforcement**: Is locking after completion necessary?
- [ ] **Release Notes**: Should this be versioned with each build?

### Questions for Clarification

1. **Build Version Source**: Will build version come from:
   - Manual user entry (current proposal)
   - Automated integration with CI/CD system
   - Both options?

2. **Draft Limit**: Should a cycle allow:
   - Only 1 DRAFT version (current proposal)
   - Multiple DRAFT versions

3. **Version Deletion**: Should completed versions be:
   - Permanent (cannot delete)
   - Archivable (hide but keep)
   - Deletable (remove completely)

4. **Release Notes**: Should they be:
   - Optional per version
   - Required for completion
   - Auto-populated from git changelog

5. **Metrics Rollup**: On cycle completion, should we also calculate:
   - Overall cycle pass rate across all versions
   - Trend analysis (pass rate change per version)
   - Failure analysis (new vs persistent failures)

---

## TIMELINE ESTIMATE

Once approved:
- **Database Schema**: 3 days (design validation + migration testing)
- **API Endpoints**: 4 days (versioning, comparison, filtering)
- **UI Implementation**: 5 days (new screens, version selector, comparison view)
- **Testing & QA**: 3 days (integration, edge cases, migration validation)
- **Deployment & Migration**: 2 days (production migration, monitoring)

**Total: 17 days** (including contingency)

---

## NEXT STEPS

1. **Review this proposal** (today)
2. **Approve/Request Changes** (by EOD)
3. **Clarify outstanding questions** (tomorrow)
4. **Begin database design** (immediately after approval)
5. **Create Prisma migration files** (parallel with API design)
6. **Implement API endpoints**
7. **Build UI components**
8. **Test end-to-end workflows**
9. **Deploy to staging**
10. **Production migration & verification**

---

**This proposal is complete and ready for your review.**  
**Please provide feedback on the design before implementation begins.**

