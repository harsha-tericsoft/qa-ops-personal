# CRITICAL SCHEMA ANALYSIS - Answers to 9 Questions

**Date:** 2026-06-23
**Status:** DETAILED ANALYSIS WITH SCHEMA EVIDENCE

---

## 1. TAG STORAGE - WHERE ARE TAGS CURRENTLY STORED?

### SCHEMA EVIDENCE

**Location 1: RepositoryNode.tags** (Line 180 of schema.prisma)
```typescript
model RepositoryNode {
  // ... other fields ...
  tags         String[]         @default([]) // Tag-based automation detection
  // ... other fields ...
}
```

**Location 2: RoamTestCase.tags** (Line 203 of schema.prisma)
```typescript
model RoamTestCase {
  // ... other fields ...
  tags         String[]         @default([])
  // ... other fields ...
}
```

**Location 3: Tag table** (Lines 473-483 of schema.prisma)
```typescript
model Tag {
  id        String       @id @default(cuid())
  projectId String
  project   Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name      String
  color     String       @default("#6366f1")
  testCases TagTestCase[]

  @@unique([projectId, name])
  @@index([projectId])
}

model TagTestCase {
  tagId      String
  tag        Tag      @relation(fields: [tagId], references: [id], onDelete: Cascade)
  testCaseId String
  testCase   TestCase @relation(fields: [testCaseId], references: [id], onDelete: Cascade)

  @@id([tagId, testCaseId])
}
```

### ANSWERS TO TAG QUESTIONS

**Q1: Are tags already coming from Roam?**
✅ **YES** - RoamTestCase.tags is a String[] populated during Roam sync

**Q2: Which table stores tags?**
- **RoamTestCase.tags** (String[] - flat array)
- **RepositoryNode.tags** (String[] - flat array)
- **Tag table** (separate records for centralized tag management)

**Q3: Which field stores tags?**
- RoamTestCase.tags (String[])
- RepositoryNode.tags (String[])
- Tag.name + TagTestCase junction table

**Q4: Are tags currently persisted in database?**
✅ **YES** - They're persisted as:
1. String arrays in RoamTestCase and RepositoryNode
2. Individual Tag records (if manually created or migrated)
3. TagTestCase relationships (if migrated)

**Q5: Are tags available in API responses today?**
⚠️ **PARTIALLY**
- RoamTestCase.tags: Available in responses that fetch RoamTestCase
- Tag table: Available if API explicitly includes the Tag/TagTestCase relationships
- Need to verify which APIs currently expose tags

### CURRENT TAG FLOW

```
Roam Research
    ↓
Import Process
    ↓
RoamTestCase.tags (String[])  ← TAGS STORED HERE
RepositoryNode.tags (String[])  ← ALSO HERE
    ↓
Tag table (Optional - if migration ran)
TagTestCase (Optional - if migration ran)
```

### CRITICAL FINDING

**Two tag systems exist:**
1. **RoamTestCase.tags** - String array (source of truth from Roam)
2. **Tag + TagTestCase** - Relational model (for filtering)

**They may be out of sync!** If RoamTestCase.tags was updated but Tag table wasn't, filters won't work correctly.

---

## 2. TEST CASE DATA STRUCTURE - ACTUAL SCHEMA

### TestCase Model
```typescript
model TestCase {
  id          String            @id @default(cuid())
  title       String
  description String?
  projectId   String
  project     Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  nodes       TestCaseNode[]
  testRuns    TestRun[]
  suites      SuiteTestCase[]
  tags        TagTestCase[]
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  @@index([projectId])
}
```

**Current Fields:**
- id (UUID)
- title (String)
- description (String, optional)
- projectId (FK)
- Relationships: nodes, testRuns, suites, tags

**Missing Fields (for filtering):**
- ❌ module (String) - need to denormalize
- ❌ feature (String) - need to denormalize
- ❌ type (String) - need to extract from tags
- ❌ Any tags field directly

### RepositoryNode Model
```typescript
model RepositoryNode {
  id           String           @id @default(cuid())
  repositoryId String
  repository   Repository       @relation(fields: [repositoryId], references: [id], onDelete: Cascade)
  projectId    String
  name         String
  slug         String
  path         String           // "/id1/id2/id3" - supports unlimited nesting
  depth        Int              @default(0)
  order        Int              @default(0)
  type         NodeType         @default(FOLDER)
  description  String?
  metadata     Json?
  parentId     String?
  parent       RepositoryNode?  @relation("NodeTree", fields: [parentId], references: [id], onDelete: SetNull)
  children     RepositoryNode[] @relation("NodeTree")
  roamNodeId   String?
  roamPageId   String?
  syncedAt     DateTime?
  tags         String[]         @default([])
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt
  deletedAt    DateTime?
  testCases    TestCaseNode[]
  testCase     RoamTestCase?

  @@unique([repositoryId, roamNodeId])
  @@index([repositoryId])
  @@index([projectId])
  @@index([parentId])
  @@index([path])
}
```

**Current Fields:**
- Hierarchy: id, name, type, path, parentId, children
- Roam: roamNodeId, roamPageId, syncedAt
- Tags: tags (String[])
- Structure: Full tree with parent/child relationships

**Key for Filtering:**
- type field contains: MODULE, FEATURE, SCREEN, etc.
- path field contains full hierarchy path
- name field contains display name

### TestSuite Model
```typescript
model TestSuite {
  id                String              @id @default(cuid())
  projectId         String
  project           Project             @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name              String
  description       String?
  category          SuiteCategory       @default(CUSTOM)
  selectionMethod   String
  selectionConfig   Json?
  testCases         SuiteTestCase[]
  usedInCycles      ExecutionCycle[]    @relation("CycleFromSuite")
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  @@index([projectId])
}

model SuiteTestCase {
  id         String    @id @default(cuid())
  suiteId    String
  suite      TestSuite @relation(fields: [suiteId], references: [id], onDelete: Cascade)
  testCaseId String
  testCase   TestCase  @relation(fields: [testCaseId], references: [id], onDelete: Cascade)
  order      Int       @default(0)

  @@unique([suiteId, testCaseId])
  @@index([suiteId])
}
```

**Current Fields:**
- Suite: id, name, description, category, projectId
- Creation: selectionMethod (String), selectionConfig (Json)
- Relationships: testCases (via SuiteTestCase)

**KEY DISCOVERY:**
- ✅ `selectionMethod` and `selectionConfig` ALREADY exist!
- ✅ Infrastructure for both creation methods ALREADY in place!
- ❌ Just needs UI and API to use it

---

## 3. SUITE CREATION IMPACT - EXACT DATABASE CHANGES

### For Filter-Based Suite Creation

**New Tables Required:** ❌ **NONE**
**New Relationships:** ❌ **NONE**
**New Indexes:** ❌ **NONE**

**Why?** The infrastructure already exists:
- TestSuite.selectionMethod (String)
- TestSuite.selectionConfig (Json)
- SuiteTestCase junction table

### Database Changes Needed

**Only enhancements to TestCase (optional, for performance):**

```typescript
model TestCase {
  // Existing
  id, title, description, projectId, project
  nodes, testRuns, suites, tags
  createdAt, updatedAt

  // OPTIONAL - Add for filtering performance
  module        String?     // Denormalized from RepositoryNode
  feature       String?     // Denormalized from RepositoryNode
  
  // Add indexes for filtering
  @@index([projectId, module])
  @@index([projectId, feature])
}
```

**However:** These are optimization only, NOT required for functionality.

### Minimal Change: Tag Synchronization

**The real requirement is synchronizing tags:**

```
RoamTestCase.tags (String[])  → Tag table + TagTestCase
                                    ↑
                              Need migration/sync
```

**Migration needed:**
```sql
1. Create Tag records from unique values in RoamTestCase.tags
2. Create TagTestCase relationships
3. Ensure they stay in sync during future Roam syncs
```

**NO schema changes needed** for this sync!

### CRITICAL FINDING

**Filter-based suite creation requires:**
- ✅ No new tables
- ✅ No new relationships  
- ✅ No new indexes (optional performance ones)
- ✅ Just tag synchronization
- ✅ Just API + UI to use existing infrastructure

---

## 4. EXECUTION CYCLE COMPATIBILITY IMPACT

### Current Execution Flow

```
TestSuite
    ↓ (sourceSuiteId)
ExecutionCycle
    ↓
ExecutionVersion
    ↓
TestRun (for each test in suite)
```

### Schema Evidence - ExecutionCycle

```typescript
model ExecutionCycle {
  id             String             @id @default(cuid())
  projectId      String
  project        Project            @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name           String
  description    String?
  startDate      DateTime?
  endDate        DateTime?
  status         CycleStatus        @default(PLANNED)
  createdBy      String?
  sourceSuiteId  String?
  sourceSuite    TestSuite?         @relation("CycleFromSuite", fields: [sourceSuiteId], references: [id], onDelete: SetNull)
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt
  versions       ExecutionVersion[]
  testRuns       TestRun[]

  @@index([projectId])
  @@index([sourceSuiteId])
}
```

### Impact Analysis

**Q1: Will execution cycles still work without modification?**
✅ **YES - COMPLETELY COMPATIBLE**

Reason: ExecutionCycle links to TestSuite via sourceSuiteId.
- Doesn't care how suite was created (hierarchy or filter)
- Doesn't care about selectionMethod or selectionConfig
- Only cares about TestSuite → SuiteTestCase → TestCase → TestRun relationships

**Q2: Will versioning still work?**
✅ **YES - NO CHANGES NEEDED**

ExecutionVersion relationships:
```typescript
model ExecutionVersion {
  cycleId        String             // Links to cycle
  cycle          ExecutionCycle
  versionNumber  Int
  buildVersion   String
  status         ExecutionStatus
  testRuns       TestRun[]          // TestRuns linked by versionId
  // ...
}
```

- TestRun(versionId) links versions to test runs
- Doesn't depend on how suite was created
- Version isolation works the same way regardless

**Q3: Will execution metrics still work?**
✅ **YES - NO CHANGES NEEDED**

Metrics calculate from:
```
TestRun.status (PASS, FAIL, BLOCKED, NOT_EXECUTED)
TestRun.versionId (for version-specific rollup)
```

- These fields unchanged
- Grouping by version still works
- Metrics calculation untouched

### CRITICAL FINDING

**No compatibility issues!** Execution cycles, versions, and metrics are completely isolated from suite creation method. They only care about which TestCases are in a TestSuite - not HOW they got there.

---

## 5. DASHBOARD COMPATIBILITY - NO SCHEMA CHANGES NEEDED

### Current Dashboard Schema Dependencies

**Project Metrics:**
```
Project
  ├─ testCases (count)
  ├─ testSuites (count)
  └─ executionCycles (count by status)
```

**Cycle Metrics:**
```
ExecutionCycle
  ├─ TestRun.status (PASS/FAIL/BLOCKED/NOT_EXECUTED)
  ├─ ExecutionVersion (for version-specific grouping)
  └─ Test counts per status
```

**Version Metrics:**
```
ExecutionVersion
  ├─ TestRun filtered by versionId
  ├─ Status breakdown (PASS/FAIL/BLOCKED/NOT_EXECUTED)
  └─ Pass rate calculation
```

### Impact of Filter-Based Suites

**Q1: Can proposed redesign support Project Metrics?**
✅ **YES - No changes**
- Project → testSuites (count unchanged)
- Project → testCases (count unchanged)
- Nothing about suite creation method affects this

**Q2: Can it support Cycle Metrics?**
✅ **YES - No changes**
- Cycle → TestRun (linked via SuiteTestCase → TestCase → TestRun)
- TestRun.status still the source of truth
- Metrics calculation unchanged

**Q3: Can it support Version Metrics?**
✅ **YES - No changes**
- Version → TestRun (filtered by versionId)
- TestRun.status still the source of truth
- Version isolation unaffected

### Why No Changes Needed

```
Suite Creation Method (Hierarchy or Filter)
    ↓
SuiteTestCase (junction - same for both)
    ↓
TestRun (linked same way regardless of suite creation)
    ↓
ExecutionVersion (metrics calculated from status)
```

The metrics pipeline only sees:
- TestRun records
- Their status
- Their versionId

It doesn't see selectionMethod or selectionConfig at all!

---

## 6. AUTOMATION READINESS - RECOMMENDED TAG MODEL

### Current Tag Usage

**Roam provides:**
```
#Manual
#Automated
#HappyPath
#Smoke
#Regression
#Sanity
#API
#Billing
#Scheduling
```

**Stored in:** RoamTestCase.tags (String[])

### Recommended Model for Automation

**Option 1: Flat Tags (RECOMMENDED)**
```
Tags:
  #Manual
  #Automated
  #HappyPath
  #Smoke
  #Regression
  #Sanity
  #API
  #Billing
  #Scheduling
  #Web
  #Mobile
  #Performance
  
Test Example:
  "When I login..."
  Tags: [#Manual, #HappyPath, #Smoke, #Web]
  
Future Automation:
  "CI runs #Automated tests"
  "Pipeline runs #Smoke tests"
  "Playwright handles #Web tests"
```

**Why this model:**
1. ✅ Simple flat structure (already implemented)
2. ✅ Supports both manual and automated
3. ✅ Easy to filter combinations (#Manual AND #Smoke)
4. ✅ Scalable for future execution methods
5. ✅ Doesn't require schema changes

### Future Dashboard Usage

```
Manual Tests
  - Show only tests with #Manual tag
  - Calculate manual pass rate
  - Exclude #Automated tests

Automated Tests
  - Show only tests with #Automated tag
  - Show Playwright/API test execution
  - Show automation pass rate

Combined Dashboard
  - Total pass rate
  - Manual vs Automated split
  - Execution method breakdown
```

### Schema Already Ready

No changes needed to support this. Just use:
```
Tag.name (String)        # "Manual", "Automated", "HappyPath", etc.
TagTestCase (junction)   # Links tags to test cases
RoamTestCase.tags        # Source of truth during import
```

---

## 7. PHASE BREAKDOWN - EXACT DELIVERABLES

### PHASE 1: Database & APIs Only (Week 1)

**Database Changes:**
```
1. OPTIONAL: Add denormalized fields to TestCase
   - module (String?)
   - feature (String?)
   - Add indexes: (projectId, module), (projectId, feature)

2. REQUIRED: Tag Synchronization
   - Migrate RoamTestCase.tags → Tag + TagTestCase records
   - Enhance Roam sync to maintain sync automatically

3. NO breaking changes to existing schema
4. NO changes to ExecutionCycle, TestRun, TestSuite structure
```

**API Changes:**
```
NEW:
  GET  /api/test-cases/search
       - Filters: module, type, tags, search
       - Returns: { testCases, total, offset, limit }

  GET  /api/test-cases/filter-options
       - Returns: { modules, types, tags (with counts) }

  GET  /api/test-cases/summary
       - Returns: { total, byType, byTag, byModule }

  POST /api/test-suites/preview
       - Preview matching tests before suite creation
       - Body: { filters: { modules, tags, type } }
       - Returns: { matchingTests, count }

  POST /api/test-suites/from-filters
       - Create suite from filter criteria
       - Body: { name, description, filters: {...} }
       - Uses existing TestSuite + SuiteTestCase

MODIFIED:
  POST /api/test-suites
       - Already supports selectionMethod + selectionConfig
       - Just ensure filter method works via API
```

**NO UI changes in Phase 1**
**NO breaking changes**
**Deliverable: APIs working, tag sync complete**

---

### PHASE 2: Test Cases UI (Week 1-2)

**UI Components:**
```
- TestCaseGrid (table display)
- FilterSidebar (module, type, tags, search filters)
- SummaryCards (total, manual, automated, by tag)
- Pagination component
```

**UI Logic:**
```
- Wire to /api/test-cases/search
- Wire to /api/test-cases/filter-options
- Wire to /api/test-cases/summary
- Update cards on filter change
```

**NO Database changes**
**NO API changes**
**Deliverable: Test Cases module redesigned**

---

### PHASE 3: Filter-Based Suite Creation (Week 2)

**UI Components:**
```
- FilterSelection component
- TestPreview component
- SuiteDetailsForm
```

**UI Flow:**
```
Step 1: Select filters (module, tags, type)
Step 2: Preview matching tests
Step 3: Enter suite details
Step 4: Create (calls POST /api/test-suites)
```

**Functionality:**
```
- Uses existing /api/test-suites/preview API
- Uses existing POST /api/test-suites API
- Creates suite with selectionMethod="FILTER"
- Stores selectionConfig with filter criteria
```

**NO Database changes**
**NO new API endpoints**
**Uses already-built APIs from Phase 1**
**Deliverable: Filter method UI for suite creation**

---

### PHASE 4: Dashboard Integration (Week 3)

**UI Integration:**
```
- Dashboard displays Project Metrics
- Dashboard displays Cycle Metrics
- Dashboard displays Version Metrics
```

**Using what exists:**
```
- APIs already exist (from earlier work)
- Metrics calculation unchanged
- No new schema needed
```

**NO Database changes**
**NO API changes**
**Deliverable: Dashboard shows all three metric scopes**

---

### PHASE 5: Performance Optimization (Week 3-4)

**Optimizations:**
```
1. Lazy load filter options
2. Add pagination to test cases
3. Cache filter counts
4. Add TestCase.module/feature indexes
5. Batch tag sync operations
```

**NO Database schema changes required**
**Optional: Add indexes for performance**
**Deliverable: < 1s page load, < 500ms filters**

---

## 8. RISK ANALYSIS - BREAKING EXISTING FEATURES

### Feature 1: Repository Tree

**Risk Level: 🟢 LOW**

**Why:**
- Repository tree uses RepositoryNode hierarchy
- Not affected by TestCase changes or suite creation method
- Completely independent feature

**Mitigation:** None needed - no changes to RepositoryNode

---

### Feature 2: Existing Suite Creation (Hierarchy Method)

**Risk Level: 🟢 LOW**

**Why:**
- Uses TestSuite + SuiteTestCase (unchanged)
- Just adds new selectionMethod option
- Backward compatible

**Mitigation:** 
- Keep existing UI tab for hierarchy method
- Test both methods create identical SuiteTestCase records

---

### Feature 3: Execution Cycles

**Risk Level: 🟢 LOW**

**Why:**
- Links to TestSuite via sourceSuiteId (unchanged)
- TestRun creation unchanged
- Doesn't care how suite was created

**Mitigation:**
- No changes needed
- Create execution cycles from both suite types
- Verify TestRun records identical

---

### Feature 4: Versioning

**Risk Level: 🟢 LOW**

**Why:**
- ExecutionVersion links via versionId
- TestRun.versionId unchanged
- Version isolation logic unchanged

**Mitigation:**
- No changes needed
- Version isolation tested with both suite types

---

### Feature 5: Dashboard Metrics

**Risk Level: 🟢 LOW**

**Why:**
- Metrics calculate from TestRun.status
- Version-specific grouping by versionId (unchanged)
- Doesn't see suite creation method

**Mitigation:**
- No changes needed
- Test metrics with suites from both creation methods

---

### Feature 6: Roam Sync

**Risk Level: 🟡 MEDIUM**

**Why:**
- RoamTestCase.tags → Tag table sync needed
- Must keep synchronized on future imports
- If sync breaks, filtering breaks

**Mitigation:**
- Test migration carefully before deploying
- Add sync validation to import process
- Monitor tag count consistency
- Handle tag renames gracefully

---

### Overall Risk Summary

```
Repository Tree:      🟢 LOW    (no changes)
Hierarchy Suites:     🟢 LOW    (backward compatible)
Execution Cycles:     🟢 LOW    (unaffected)
Versioning:           🟢 LOW    (unaffected)
Dashboard Metrics:    🟢 LOW    (unaffected)
Roam Sync:           🟡 MEDIUM (requires careful migration)
```

**No high-risk changes needed!**

---

## 9. FINAL RECOMMENDATION

### Recommendation: **ENHANCE (Option A)**

### Why NOT Redesign

**Current state:**
- TestSuite already has selectionMethod + selectionConfig (lines 451-452)
- Tag table already exists with relationships (lines 473-492)
- Execution cycles, versioning, and metrics completely separate
- No breaking changes needed

**Redesign would be:**
- ❌ Unnecessary (infrastructure exists)
- ❌ Risky (more changes = more things to break)
- ❌ Wasteful (rewriting working code)

### Recommended Approach: SELECTIVE ENHANCEMENT

```
What to KEEP:
  ✅ RepositoryNode hierarchy
  ✅ TestSuite.selectionMethod/selectionConfig
  ✅ ExecutionCycle/TestRun/ExecutionVersion
  ✅ Dashboard metric APIs

What to ADD:
  ✅ Tag synchronization (RoamTestCase.tags → Tag table)
  ✅ Filter-based suite creation UI
  ✅ Test Cases working view (filters + grid)
  ✅ API endpoints for filtering

What to CHANGE MINIMALLY:
  ⚠️ Optional: Add TestCase.module/feature denormalization (for perf)
  ⚠️ Optional: Add indexes for filtering

Risk: MINIMAL
Effort: 2-3 weeks (not 2-3 months)
Upside: Tag-based filtering + cleaner QA experience
```

### Implementation Order (Critical for Safety)

```
1. Phase 1: Tag sync + APIs
   - Migrate tags to Tag table
   - Build filter APIs
   - NO UI changes yet
   - Test thoroughly

2. Phase 2: Test Cases UI
   - Add filter sidebar
   - Add grid display
   - Wire to APIs
   - Keep hierarchy tab as fallback

3. Phase 3: Suite creation UI
   - Add filter method tab
   - Use existing APIs
   - Keep hierarchy method working

4. Phase 4-5: Polish
   - Dashboard integration
   - Performance optimization
```

### Why This Order

1. **De-risk early:** Tag sync is the only risky part
2. **APIs before UI:** Can test APIs without touching UI
3. **Additive only:** Each phase adds features, doesn't break existing ones
4. **Parallel work:** Teams can work on different phases independently

### Safety Verification

Before deploy:
```
1. All three metrics scopes return data (unchanged)
2. Existing suite creation works (unchanged)
3. Execution cycles work with both suite types
4. Version isolation preserved
5. Comments and Jira links persist
6. Repository tree untouched
```

---

## CONCLUSION

**The current schema is 80% ready for this feature.**

Test creation, suite linkage, execution, metrics, and versioning are completely separate from suite creation method. Only enhancements needed:

1. Tag synchronization (data migration)
2. API endpoints (use existing models)
3. UI components (new, not replacement)

**Ready to proceed with Phase 1: Database & APIs**

No breaking changes. Minimum risk. Maximum upside.

