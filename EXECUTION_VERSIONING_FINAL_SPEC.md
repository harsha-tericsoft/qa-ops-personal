# Execution Cycle Versioning System - FINAL SPECIFICATION

**Status:** FINAL SPECIFICATION - READY FOR IMPLEMENTATION APPROVAL  
**Date:** 2026-06-22  
**Version:** 3.0 (Final with all requirements)

---

## CONDITIONAL APPROVAL REQUIREMENTS - INCORPORATED

### 1. Environment Tracking ✅

**Requirement**: Track which environment each version was executed in

**Implementation**:
```prisma
enum ExecutionEnvironment {
  DEV        // Development
  QA         // Quality Assurance
  UAT        // User Acceptance Testing
  STAGING    // Staging/Pre-Production
  PROD       // Production
}

model ExecutionVersion {
  // ... existing fields ...
  
  environment        ExecutionEnvironment    // NEW: Track execution environment
  environmentNotes   String?                 // Optional notes about env (e.g., "Chrome 120, Windows 11")
  
  // ... rest of fields ...
}
```

**Impact**:
- Allows filtering versions by environment
- Enables environment-specific trend analysis
- Supports compliance: "Which builds passed UAT but failed PROD?"
- Version comparison across environments

**UI Examples**:
```
Version History:
  V4 │ Build 2.4.3 │ PROD      │ 87% │ Passed
  V3 │ Build 2.4.2 │ STAGING   │ 90% │ Passed
  V2 │ Build 2.4.1 │ UAT       │ 88% │ Passed
  V1 │ Build 2.4.0 │ QA        │ 85% │ Passed

Dashboard Filter: [All Environments ▼]
  ├─ All
  ├─ PROD
  ├─ STAGING
  ├─ UAT
  ├─ QA
  └─ DEV
```

---

### 2. Baseline Version Support ✅

**Requirement**: Mark Version 1 as baseline, compare against it

**Implementation**:
```prisma
model ExecutionVersion {
  // ... existing fields ...
  
  isBaseline         Boolean               @default(false)  // NEW: Mark as baseline
  
  // Automatically set to true for first version
  // Only one baseline per cycle
  
  // ... rest of fields ...
}

model ExecutionCycle {
  // ... existing fields ...
  
  baselineVersionId  String?               // NEW: Explicit baseline reference
  baselineVersion    ExecutionVersion?     @relation("BaselineVersion", fields: [baselineVersionId], references: [id])
  
  // ... rest of fields ...
}
```

**Baseline Rules**:
```
Rule 1: Auto-mark First Version
  When: Create Version 1 (versionNumber = 1)
  Then: isBaseline = true
  
Rule 2: Single Baseline Per Cycle
  Constraint: UNIQUE(cycleId WHERE isBaseline = true)
  
Rule 3: Change Baseline
  Allow: Update different version to isBaseline = true
  Effect: Previous baseline.isBaseline = false
  
Rule 4: Cannot Delete Baseline
  If: version.isBaseline = true AND version.status = COMPLETED
  Then: Cannot delete or archive (read-only)
```

**Comparison Views**:
```
Comparison Options:
  1. Compare Against Baseline (Fixed: V1)
  2. Compare Against Previous Version
  3. Compare Multiple Versions

Example Output:
  Test Case │ Baseline (V1) │ Previous (V3) │ Current (V4) │ Change
  ─────────────────────────────────────────────────────────────────
  Login     │ PASS          │ PASS          │ FAIL         │ REGRESS.
  Checkout  │ FAIL          │ PASS          │ PASS         │ FIXED
  Payment   │ FAIL          │ FAIL          │ FAIL         │ BROKEN
  Refund    │ PASS          │ PASS          │ PASS         │ STABLE
  
  Since Baseline:
    Pass Rate: V1 (85%) → V4 (87%) [+2%]
    New Failures vs Baseline: 1
    Fixed Failures vs Baseline: 0
    Regressions vs Baseline: 1
```

---

### 3. Defect Metrics ✅

**Requirement**: Track defects linked to test results

**Implementation**:
```prisma
model TestDefectLink {
  id                String    @id @default(cuid())
  runId             String
  run               TestRun   @relation(fields: [runId], references: [id], onDelete: Cascade)
  defectId          String    // External Jira issue ID or internal defect ID
  defectTitle       String?   // Cached title for quick display
  defectStatus      String    // OPEN, IN_PROGRESS, CLOSED, BLOCKED, DUPLICATE
  severity          String?   // CRITICAL, HIGH, MEDIUM, LOW
  linkedAt          DateTime  @default(now())
  linkedBy          String?
  
  @@index([runId])
  @@index([defectId])
  @@index([defectStatus])
}

model ExecutionVersion {
  // ... existing fields ...
  
  // NEW: Metrics for defects
  linkedDefectCount    Int       @default(0)    // Total defects linked
  openDefectCount      Int       @default(0)    // Defects with status = OPEN
  closedDefectCount    Int       @default(0)    // Defects with status = CLOSED
  criticalCount        Int       @default(0)    // Critical severity defects
  
  // Relations
  linkedDefects        TestDefectLink[]
  
  // ... rest of fields ...
}

model TestRun {
  // ... existing fields ...
  
  linkedDefects        TestDefectLink[]        // NEW: Link to defects
  
  // ... rest of fields ...
}
```

**Defect Calculation**:
```
On Complete Execution:
  linkedDefectCount = COUNT(TestDefectLink WHERE versionId = X)
  
  openDefectCount = COUNT(TestDefectLink 
    WHERE versionId = X AND defectStatus IN ('OPEN', 'IN_PROGRESS'))
  
  closedDefectCount = COUNT(TestDefectLink 
    WHERE versionId = X AND defectStatus = 'CLOSED')
  
  criticalCount = COUNT(TestDefectLink 
    WHERE versionId = X AND severity = 'CRITICAL')
```

**UI Display**:
```
Version Metrics Card:
  Pass Rate: 87%
  ┌──────────────────────────────────┐
  │ Defects                          │
  │ Linked: 5                        │
  │ Open: 3                          │
  │ Closed: 2                        │
  │ Critical: 1                      │
  └──────────────────────────────────┘

Dashboard Trend:
  Build 2.4.0: 5 linked, 2 open
  Build 2.4.1: 4 linked, 1 open
  Build 2.4.2: 3 linked, 1 open
  Build 2.4.3: 5 linked, 3 open  ← Increase in defects
```

---

### 4. Bulk Execution Actions ✅

**Requirement**: Mark multiple tests at once

**Implementation**:
```prisma
// No schema changes needed - handled at API level
// API endpoint accepts array of testRunIds
```

**API Endpoints**:
```
POST /api/execution-cycles/{cycleId}/versions/{versionId}/bulk-update
  Body:
    {
      action: "PASS" | "FAIL" | "BLOCKED" | "NOT_EXECUTED",
      testRunIds: ["runId1", "runId2", "runId3", ...],
      executedBy: "user@email.com"
    }
  
  Response:
    {
      updated: 10,
      failed: 0,
      results: [
        {
          runId,
          testCaseId,
          previousStatus,
          newStatus,
          success: true
        }
      ]
    }

---

POST /api/execution-cycles/{cycleId}/versions/{versionId}/bulk-select-status
  Select tests by current status and update
  
  Body:
    {
      selectFrom: "NOT_EXECUTED" | "PASS" | "FAIL" | "BLOCKED",
      updateTo: "PASS" | "FAIL" | "BLOCKED" | "NOT_EXECUTED",
      executedBy: "user@email.com"
    }
  
  Example:
    Select all NOT_EXECUTED tests
    Update to PASS (e.g., for rerun where all passed)
```

**UI Implementation**:
```
Test Execution Table:

[x] Test 1  │ [Not Ex ▼]
[x] Test 2  │ [Not Ex ▼]
[x] Test 3  │ [Pass ▼]
[x] Test 4  │ [Not Ex ▼]

Bulk Action Bar (when items selected):
  [↓] Mark Selected As:
      [Pass] [Fail] [Blocked] [Not Executed]
  
  Selected: 3 tests
  
Context Menu on Selection:
  "Mark 3 tests as PASS"
  "Mark 3 tests as FAIL"
  "Mark 3 tests as BLOCKED"
```

**Workflow**:
```
USE CASE: Bulk mark all as PASS after successful run
  1. Select all tests (Ctrl+A)
  2. Click [Pass] button
  3. System updates all 20 tests to PASS
  4. Metrics recalculated in-memory
  5. Click [Save Draft] to persist
  6. Click [Complete Execution] to finalize
```

---

### 5. Future Traceability Placeholders ✅

**Requirement**: Support requirement/story/epic linking

**Implementation**:
```prisma
model TestCaseTraceability {
  id                String    @id @default(cuid())
  testCaseId        String
  testCase          TestCase  @relation(fields: [testCaseId], references: [id], onDelete: Cascade)
  
  // Traceability identifiers
  requirementId      String?   // e.g., "REQ-001", "SPEC-123"
  storyId            String?   // e.g., "USER-456", "STORY-789"
  epicId             String?   // e.g., "EPIC-001", "FEATURE-001"
  
  // Reverse links
  jiraRequirementUrl String?   // Link to Jira requirement
  jiraStoryUrl       String?   // Link to Jira story
  jiraEpicUrl        String?   // Link to Jira epic
  
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  
  @@unique([testCaseId])
  @@index([requirementId])
  @@index([storyId])
  @@index([epicId])
}

model ExecutionVersion {
  // ... existing fields ...
  
  // Aggregated traceability for this version
  requirementsCovered   Int     @default(0)   // COUNT(DISTINCT requirementId)
  storiesCovered        Int     @default(0)   // COUNT(DISTINCT storyId)
  epicsCovered          Int     @default(0)   // COUNT(DISTINCT epicId)
  
  // ... rest of fields ...
}
```

**Calculations**:
```
On Complete Execution:
  requirementsCovered = COUNT(DISTINCT TestCaseTraceability.requirementId
    WHERE testCase IN version.testRuns AND requirementId IS NOT NULL)
  
  storiesCovered = COUNT(DISTINCT TestCaseTraceability.storyId
    WHERE testCase IN version.testRuns AND storyId IS NOT NULL)
  
  epicsCovered = COUNT(DISTINCT TestCaseTraceability.epicId
    WHERE testCase IN version.testRuns AND epicId IS NOT NULL)
```

**UI Implementation**:
```
Test Case Detail View:
  Test: Login Valid
  Status: [Pass ▼]
  
  Traceability:
    Requirement: [REQ-001]  ────→ Opens Jira Requirement
    Story: [USER-456]       ────→ Opens Jira Story
    Epic: [EPIC-001]        ────→ Opens Jira Epic
  
  [Edit Traceability]

Version Metrics Card:
  Coverage Summary:
    Requirements Covered: 12/15 (80%)
    Stories Covered: 18/25 (72%)
    Epics Covered: 4/6 (67%)
  
  Gaps:
    Missing Requirements: REQ-003, REQ-007, REQ-009
    Missing Stories: USER-123, USER-124, USER-125, ...
    Missing Epics: EPIC-003, EPIC-004, ...

Requirements Traceability Report:
  REQ-001: 5 tests │ 5 passed │ 0 failed │ ✓ Covered
  REQ-002: 3 tests │ 3 passed │ 0 failed │ ✓ Covered
  REQ-003: 2 tests │ 1 passed │ 1 failed │ ⚠ PARTIAL
  REQ-004: 0 tests │ N/A      │ N/A      │ ✗ NOT COVERED
```

---

## IMPACT ANALYSIS

### Schema Expansion Impact

| Component | Tables | New Fields | New Relations | Impact |
|-----------|--------|-----------|---------------|--------|
| Environment | 1 (Version) | 2 | 0 | +20KB storage per 1M versions |
| Baseline | 2 (Version, Cycle) | 2 | 1 | +15KB per cycle |
| Defects | 2 (New table + Version) | 5 | 1 | +50KB per 10K defect links |
| Bulk Actions | 0 (API only) | 0 | 0 | No storage impact |
| Traceability | 2 (New table) | 6 | 1 | +30KB per 10K test cases |
| **TOTAL** | **4 new** | **15 new** | **3 new** | **~150KB per 1M operations** |

### Performance Impact

```
Query Impact:
  1. Environment Filter: +1 index lookup (negligible)
  2. Baseline Comparison: +1 join (20-30% slower than binary compare)
  3. Defect Metrics: +1 aggregate query (50-100ms)
  4. Bulk Actions: Loop vs batch (N queries → 1 batch update)
  5. Traceability: +1 join on test cases (10-20% slower)

Mitigation:
  - Index on environment
  - Partial index on isBaseline
  - Denormalize defect counts on version
  - Batch bulk operations
  - Eager-load traceability
```

### Database Size Impact

```
Additional Storage:
  ExecutionVersion: +2 columns (environment, isBaseline, baselineVersionId)
  TestRun: 0 new columns (link is in TestDefectLink)
  NEW Table: TestDefectLink (8 columns, ~200 bytes per record)
  NEW Table: TestCaseTraceability (6 columns, ~150 bytes per record)

Per 1000 test runs:
  Without defects: +2KB
  With 5 defects avg: +1MB additional (TestDefectLink records)
  With traceability: +200KB additional (TestCaseTraceability)
  
  Estimated: +1.2MB per 1000 test runs
```

### Migration Impact

```
Migration Complexity: MEDIUM
  - Add 2 new tables (requires CREATE)
  - Add 4 columns to ExecutionVersion (backward compatible)
  - Add 1 column to ExecutionCycle (backward compatible)
  - Backfill isBaseline = true for versionNumber = 1
  - No data transformation needed (all new fields)

Risk: LOW
  - All changes are additive
  - No data deletion
  - Can rollback by dropping new tables
  - Existing queries unaffected
```

---

## FINAL SCHEMA

```prisma
// ENUMS
enum VersionStatus {
  DRAFT
  IN_PROGRESS
  COMPLETED
  ARCHIVED
  DELETED
}

enum ExecutionEnvironment {
  DEV
  QA
  UAT
  STAGING
  PROD
}

// CORE TABLES

model ExecutionCycle {
  id                  String
  projectId           String
  name                String
  description         String?
  
  // Version management
  versions            ExecutionVersion[]
  currentVersionId    String?
  currentVersion      ExecutionVersion? @relation("CurrentActive", fields: [currentVersionId], references: [id], onDelete: SetNull)
  
  baselineVersionId   String?
  baselineVersion     ExecutionVersion? @relation("BaselineVersion", fields: [baselineVersionId], references: [id], onDelete: SetNull)
  
  // Metadata
  status              CycleStatus
  sourceSuiteId       String?
  sourceSuite         TestSuite? @relation(...)
  createdBy           String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  
  @@unique([projectId, id])
  @@index([projectId])
  @@index([currentVersionId])
  @@index([baselineVersionId])
}

model ExecutionVersion {
  id                    String @id @default(cuid())
  cycleId               String
  cycle                 ExecutionCycle @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  
  // Version identification
  buildVersion          String
  versionNumber         Int
  
  // Status lifecycle
  status                VersionStatus @default(DRAFT)
  displayStatus         String @default("DRAFT")
  
  // Environment tracking
  environment           ExecutionEnvironment
  environmentNotes      String?
  
  // Baseline tracking
  isBaseline            Boolean @default(false)
  
  // Metrics (version-level)
  totalTests            Int @default(0)
  passCount             Int @default(0)
  failCount             Int @default(0)
  blockedCount          Int @default(0)
  notExecutedCount      Int @default(0)
  passRate              Float @default(0.0)
  
  // Defect metrics
  linkedDefectCount     Int @default(0)
  openDefectCount       Int @default(0)
  closedDefectCount     Int @default(0)
  criticalCount         Int @default(0)
  
  // Traceability metrics
  requirementsCovered   Int @default(0)
  storiesCovered        Int @default(0)
  epicsCovered          Int @default(0)
  
  // Timing & ownership
  createdAt             DateTime @default(now())
  createdBy             String?
  completedAt           DateTime?
  completedBy           String?
  archivedAt            DateTime?
  archivedBy            String?
  
  // Content
  releaseNotes          String? @db.Text
  
  // Relations
  testRuns              TestRun[]
  linkedDefects         TestDefectLink[]
  cycleActive           ExecutionCycle? @relation("CurrentActive")
  cycleBaseline         ExecutionCycle? @relation("BaselineVersion")
  
  // Constraints
  @@unique([cycleId, buildVersion])
  @@index([cycleId])
  @@index([status])
  @@index([environment])
  @@index([isBaseline])
  @@index([createdAt])
}

model TestRun {
  id                String @id @default(cuid())
  versionId         String
  version           ExecutionVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)
  testCaseId        String
  testCase          TestCase @relation(fields: [testCaseId], references: [id], onDelete: Cascade)
  
  status            RunStatus @default(NOT_EXECUTED)
  executedBy        String?
  executedAt        DateTime?
  durationMs        Int?
  
  comments          RunComment[]
  jiraLinks         JiraLink[]
  attachments       RunAttachment[]
  linkedDefects     TestDefectLink[]
  
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

// NEW TABLES

model TestDefectLink {
  id                String @id @default(cuid())
  runId             String
  run               TestRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  versionId         String
  version           ExecutionVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)
  
  defectId          String
  defectTitle       String?
  defectStatus      String
  severity          String?
  
  linkedAt          DateTime @default(now())
  linkedBy          String?
  
  @@index([runId])
  @@index([versionId])
  @@index([defectId])
  @@index([defectStatus])
  @@index([severity])
}

model TestCaseTraceability {
  id                String @id @default(cuid())
  testCaseId        String
  testCase          TestCase @relation(fields: [testCaseId], references: [id], onDelete: Cascade)
  
  requirementId     String?
  storyId           String?
  epicId            String?
  
  jiraRequirementUrl String?
  jiraStoryUrl       String?
  jiraEpicUrl        String?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@unique([testCaseId])
  @@index([requirementId])
  @@index([storyId])
  @@index([epicId])
}
```

---

## FINAL MIGRATION PLAN

### Migration Steps

**Step 1: Create New Tables** (5 minutes)
```sql
CREATE TABLE TestDefectLink (
  id VARCHAR(255) PRIMARY KEY,
  runId VARCHAR(255) NOT NULL,
  versionId VARCHAR(255) NOT NULL,
  defectId VARCHAR(255) NOT NULL,
  defectTitle VARCHAR(255),
  defectStatus VARCHAR(50) NOT NULL,
  severity VARCHAR(50),
  linkedAt TIMESTAMP DEFAULT NOW(),
  linkedBy VARCHAR(255),
  FOREIGN KEY(runId) REFERENCES TestRun(id) ON DELETE CASCADE,
  FOREIGN KEY(versionId) REFERENCES ExecutionVersion(id) ON DELETE CASCADE
);

CREATE INDEX idx_testdefectlink_runid ON TestDefectLink(runId);
CREATE INDEX idx_testdefectlink_versionid ON TestDefectLink(versionId);
CREATE INDEX idx_testdefectlink_defectid ON TestDefectLink(defectId);
CREATE INDEX idx_testdefectlink_defectstatus ON TestDefectLink(defectStatus);
CREATE INDEX idx_testdefectlink_severity ON TestDefectLink(severity);

CREATE TABLE TestCaseTraceability (
  id VARCHAR(255) PRIMARY KEY,
  testCaseId VARCHAR(255) NOT NULL UNIQUE,
  requirementId VARCHAR(255),
  storyId VARCHAR(255),
  epicId VARCHAR(255),
  jiraRequirementUrl VARCHAR(1024),
  jiraStoryUrl VARCHAR(1024),
  jiraEpicUrl VARCHAR(1024),
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY(testCaseId) REFERENCES TestCase(id) ON DELETE CASCADE
);

CREATE INDEX idx_testcasetraceability_requirementid ON TestCaseTraceability(requirementId);
CREATE INDEX idx_testcasetraceability_storyid ON TestCaseTraceability(storyId);
CREATE INDEX idx_testcasetraceability_epicid ON TestCaseTraceability(epicId);
```

**Step 2: Add Columns to ExecutionVersion** (5 minutes)
```sql
ALTER TABLE ExecutionVersion ADD COLUMN environment VARCHAR(50);
ALTER TABLE ExecutionVersion ADD COLUMN environmentNotes TEXT;
ALTER TABLE ExecutionVersion ADD COLUMN isBaseline BOOLEAN DEFAULT FALSE;
ALTER TABLE ExecutionVersion ADD COLUMN linkedDefectCount INT DEFAULT 0;
ALTER TABLE ExecutionVersion ADD COLUMN openDefectCount INT DEFAULT 0;
ALTER TABLE ExecutionVersion ADD COLUMN closedDefectCount INT DEFAULT 0;
ALTER TABLE ExecutionVersion ADD COLUMN criticalCount INT DEFAULT 0;
ALTER TABLE ExecutionVersion ADD COLUMN requirementsCovered INT DEFAULT 0;
ALTER TABLE ExecutionVersion ADD COLUMN storiesCovered INT DEFAULT 0;
ALTER TABLE ExecutionVersion ADD COLUMN epicsCovered INT DEFAULT 0;

CREATE INDEX idx_executionversion_environment ON ExecutionVersion(environment);
CREATE INDEX idx_executionversion_isbaseline ON ExecutionVersion(isBaseline);
```

**Step 3: Add Columns to ExecutionCycle** (5 minutes)
```sql
ALTER TABLE ExecutionCycle ADD COLUMN baselineVersionId VARCHAR(255);
ALTER TABLE ExecutionCycle ADD FOREIGN KEY(baselineVersionId) REFERENCES ExecutionVersion(id) ON DELETE SET NULL;
CREATE INDEX idx_executioncycle_baselineversion ON ExecutionCycle(baselineVersionId);
```

**Step 4: Backfill Baseline Versions** (10 minutes)
```sql
-- Mark version 1 of each cycle as baseline
UPDATE ExecutionVersion
SET isBaseline = TRUE
WHERE versionNumber = 1
AND cycleId IN (
  SELECT cycleId FROM ExecutionVersion
  GROUP BY cycleId
  HAVING MIN(versionNumber) = 1
);

-- Set baselineVersionId on cycles
UPDATE ExecutionCycle c
SET c.baselineVersionId = (
  SELECT id FROM ExecutionVersion ev
  WHERE ev.cycleId = c.id
  AND ev.isBaseline = TRUE
  LIMIT 1
);
```

**Step 5: Validation** (10 minutes)
```sql
-- Verify backfill
SELECT COUNT(*) as baseline_versions FROM ExecutionVersion WHERE isBaseline = TRUE;
SELECT COUNT(*) as cycles_with_baseline FROM ExecutionCycle WHERE baselineVersionId IS NOT NULL;

-- Verify no duplicates
SELECT cycleId, COUNT(*) as baseline_count 
FROM ExecutionVersion 
WHERE isBaseline = TRUE 
GROUP BY cycleId 
HAVING COUNT(*) > 1;

-- Should return 0 rows (no duplicates)
```

**Total Migration Time**: ~35 minutes

### Rollback Plan

```sql
-- If needed, rollback new tables only:
DROP TABLE TestDefectLink;
DROP TABLE TestCaseTraceability;

-- If needed, rollback new columns:
ALTER TABLE ExecutionVersion DROP COLUMN environment;
ALTER TABLE ExecutionVersion DROP COLUMN environmentNotes;
ALTER TABLE ExecutionVersion DROP COLUMN isBaseline;
ALTER TABLE ExecutionVersion DROP COLUMN linkedDefectCount;
ALTER TABLE ExecutionVersion DROP COLUMN openDefectCount;
ALTER TABLE ExecutionVersion DROP COLUMN closedDefectCount;
ALTER TABLE ExecutionVersion DROP COLUMN criticalCount;
ALTER TABLE ExecutionVersion DROP COLUMN requirementsCovered;
ALTER TABLE ExecutionVersion DROP COLUMN storiesCovered;
ALTER TABLE ExecutionVersion DROP COLUMN epicsCovered;

ALTER TABLE ExecutionCycle DROP COLUMN baselineVersionId;

-- Rollback is safe: no data loss, only schema removal
```

---

## FINAL ERD

```
ExecutionCycle (1)
├─ currentVersion (1:1)────→ ExecutionVersion
├─ baselineVersion (1:1)───→ ExecutionVersion  [NEW]
└─ versions (1:N)──────────→ ExecutionVersion (Many)
                              ├─ environment: DEV|QA|UAT|STAGING|PROD [NEW]
                              ├─ isBaseline: boolean [NEW]
                              ├─ linkedDefects (1:N)───→ TestDefectLink [NEW]
                              ├─ testRuns (1:N)───────→ TestRun
                              │                         ├─ comments (1:N)
                              │                         ├─ jiraLinks (1:N)
                              │                         ├─ attachments (1:N)
                              │                         └─ linkedDefects (1:N)── [NEW]
                              │                                    │
                              │                                    └─ defectStatus
                              │                                    └─ severity
                              └─ [NEW] TestDefectLink
                                   ├─ defectId
                                   ├─ defectStatus
                                   ├─ severity

TestCase (1)
└─ traceability (1:1)───→ TestCaseTraceability [NEW]
   ├─ requirementId
   ├─ storyId
   ├─ epicId
   └─ jira URLs

Key Changes:
  • Environment field added to version lifecycle
  • Baseline version tracked with isBaseline + baselineVersionId
  • Defect tracking via new TestDefectLink junction table
  • Traceability stored in TestCaseTraceability (linked to test cases)
  • Metrics denormalized on ExecutionVersion (defect + traceability counts)
```

---

## FINAL API CONTRACT

### 1. Version Management (Existing)
```
POST /api/execution-cycles/{cycleId}/versions
  Create new execution version
  
  Body:
    {
      buildVersion: string (required)
      releaseNotes: string (optional)
      environment: "DEV"|"QA"|"UAT"|"STAGING"|"PROD" (required) [NEW]
      environmentNotes: string (optional) [NEW]
      clonePreviousVersion: boolean (optional)
    }

GET /api/execution-cycles/{cycleId}/versions
  List versions
  
  Query:
    ?status=DRAFT|IN_PROGRESS|COMPLETED|ARCHIVED
    ?environment=PROD|STAGING [NEW]
    ?isBaseline=true [NEW]

PATCH /api/execution-cycles/{cycleId}/versions/{versionId}/complete
  Complete execution
  [Returns updated metrics including defect counts]
```

### 2. Baseline Management [NEW]
```
PUT /api/execution-cycles/{cycleId}/baseline
  Set baseline version
  
  Body:
    {
      versionId: string
    }
  
  Response:
    {
      cycleId,
      baselineVersionId,
      previousBaselineVersionId
    }

GET /api/execution-cycles/{cycleId}/baseline
  Get baseline version
  
  Response:
    {
      cycleId,
      baselineVersion: ExecutionVersion
    }

GET /api/execution-cycles/{cycleId}/versions/compare-with-baseline
  Compare all versions against baseline
  
  Response:
    {
      baseline: ExecutionVersion,
      comparison: [
        {
          versionId,
          buildVersion,
          regressions: count,
          improvements: count,
          stable: count
        }
      ]
    }
```

### 3. Defect Management [NEW]
```
POST /api/test-runs/{runId}/defects
  Link defect to test run
  
  Body:
    {
      defectId: string (required)
      defectTitle: string (optional)
      defectStatus: string (required)  // OPEN, IN_PROGRESS, CLOSED, BLOCKED
      severity: string (optional)      // CRITICAL, HIGH, MEDIUM, LOW
      linkedBy: string
    }

DELETE /api/test-runs/{runId}/defects/{defectId}
  Unlink defect from test run

GET /api/execution-cycles/{cycleId}/versions/{versionId}/defects
  List all defects for version
  
  Query:
    ?status=OPEN|CLOSED|IN_PROGRESS
    ?severity=CRITICAL|HIGH
  
  Response:
    {
      version: ExecutionVersion,
      defects: [
        {
          defectId,
          defectTitle,
          defectStatus,
          severity,
          linkedTestCases: count,
          linkedRuns: TestRun[]
        }
      ],
      metrics: {
        total: count,
        open: count,
        closed: count,
        critical: count
      }
    }

PATCH /api/execution-cycles/{cycleId}/versions/{versionId}/defects/{defectId}
  Update defect status
  
  Body:
    {
      defectStatus: string,
      severity: string
    }
  
  Action: Recalculates version metrics
```

### 4. Bulk Test Actions [NEW]
```
POST /api/execution-cycles/{cycleId}/versions/{versionId}/bulk-update
  Bulk update test run statuses
  
  Body:
    {
      action: "PASS"|"FAIL"|"BLOCKED"|"NOT_EXECUTED" (required)
      testRunIds: string[] (required)
      executedBy: string
      comment: string (optional)  // Add same comment to all
    }
  
  Response:
    {
      updated: count,
      failed: count,
      results: [
        {
          runId,
          testCaseId,
          previousStatus,
          newStatus,
          success: boolean,
          error: string
        }
      ]
    }

POST /api/execution-cycles/{cycleId}/versions/{versionId}/bulk-select-status
  Select and update tests by status
  
  Body:
    {
      selectFrom: "NOT_EXECUTED"|"PASS"|"FAIL"|"BLOCKED" (required)
      updateTo: "PASS"|"FAIL"|"BLOCKED"|"NOT_EXECUTED" (required)
      executedBy: string
    }
  
  Response:
    {
      selected: count,
      updated: count,
      failed: count
    }
```

### 5. Traceability Management [NEW]
```
POST /api/test-cases/{testCaseId}/traceability
  Link test case to requirements/stories/epics
  
  Body:
    {
      requirementId: string (optional)
      storyId: string (optional)
      epicId: string (optional)
      jiraRequirementUrl: string (optional)
      jiraStoryUrl: string (optional)
      jiraEpicUrl: string (optional)
    }

GET /api/test-cases/{testCaseId}/traceability
  Get traceability information

GET /api/execution-cycles/{cycleId}/versions/{versionId}/coverage
  Get traceability coverage for version
  
  Response:
    {
      versionId,
      requirementsCovered: count,
      storiesCovered: count,
      epicsCovered: count,
      requirements: [{ id, testCount, coverage }],
      stories: [{ id, testCount, coverage }],
      epics: [{ id, testCount, coverage }],
      gaps: {
        missingRequirements: [id],
        missingStories: [id],
        missingEpics: [id]
      }
    }

POST /api/execution-cycles/{cycleId}/versions/{versionId}/traceability-report
  Generate traceability report
  
  Response:
    {
      report: {
        byRequirement: [{ id, tests: count, passed, failed, covered }],
        byStory: [...],
        byEpic: [...],
        metrics: {
          totalRequirements: count,
          totalStories: count,
          totalEpics: count,
          coverage: percentage
        }
      }
    }
```

### 6. Comparison Endpoints [NEW]
```
GET /api/execution-cycles/{cycleId}/versions/compare
  Compare multiple versions
  
  Query:
    ?versions=v1,v2,v3
    ?mode=baseline|previous|all  // baseline = against v1, previous = v2 vs v1, all = multi-version
  
  Response:
    {
      versions: [ExecutionVersion],
      comparison: [
        {
          testCaseId,
          testCaseName,
          v1: status,
          v2: status,
          v3: status,
          regressions: boolean,
          improvements: boolean,
          defectChanges: { opened, closed }
        }
      ],
      summary: {
        newFailures: count,
        fixedFailures: count,
        regressions: count,
        improvements: count,
        stableTests: count,
        changedTests: count,
        defectMetrics: { openedDefects, closedDefects }
      }
    }
```

### 7. Dashboard Endpoints [NEW]
```
GET /api/dashboard/versions/{cycleId}
  Get dashboard data for version
  
  Query:
    ?version=latest|{versionId}
    ?compareWith=baseline|previous|{versionId}  // NEW: Environment-aware trends
  
  Response:
    {
      currentVersion: ExecutionVersion,
      metrics: {
        passRate: percentage,
        testCoverage: {
          total: count,
          requirementsCovered: count,
          storiesCovered: count,
          epicsCovered: count
        },
        defectMetrics: {
          linked: count,
          open: count,
          closed: count,
          critical: count,
          bySeverity: { CRITICAL, HIGH, MEDIUM, LOW }
        }
      },
      trend: [
        {
          versionNumber,
          buildVersion,
          environment,
          passRate,
          defectTrend: { linkedCount, openCount },
          date
        }
      ],
      environments: [
        {
          environment: "PROD"|"STAGING"|"UAT"|"QA"|"DEV",
          latestVersion: ExecutionVersion,
          trend: [...]
        }
      ]
    }
```

---

## IMPLEMENTATION SUMMARY

**Schema Size Growth**: ~150KB per 1M test operations
**Migration Time**: 35 minutes
**New Tables**: 2 (TestDefectLink, TestCaseTraceability)
**Modified Tables**: 2 (ExecutionVersion, ExecutionCycle)
**New API Endpoints**: 12+
**Backward Compatibility**: 100% (all changes additive)

**Key Features Added**:
- ✅ Environment tracking (DEV/QA/UAT/STAGING/PROD)
- ✅ Baseline version management
- ✅ Defect metrics and linking
- ✅ Bulk execution actions
- ✅ Future traceability placeholders

**Risk Level**: LOW
- All changes are schema-additive
- No data transformation
- Rollback is simple
- Existing queries unaffected

---

**FINAL SPECIFICATION COMPLETE - READY FOR IMPLEMENTATION APPROVAL**

