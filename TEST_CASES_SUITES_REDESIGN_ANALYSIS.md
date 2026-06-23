# Test Cases & Test Suites Redesign - Detailed Analysis & Implementation Plan

## Executive Summary

This document provides a comprehensive analysis and phased implementation plan for redesigning the Test Cases and Test Suites modules to support both hierarchy-based and tag/filter-based suite creation.

**Current State:** Test Cases module duplicates Repository functionality with minimal added value
**Target State:** Test Cases becomes QA working view with powerful filtering; Test Suites support tag-based creation

---

## 1. CURRENT ARCHITECTURE ANALYSIS

### 1.1 Module Structure

**Repository Module** (`app/repository/page.tsx`)
- ✅ Shows full hierarchy tree (TestSuite → Module → Feature → Screen → Test Cases)
- ✅ Uses RepositoryTree component to display Roam-imported structure
- ✅ Has RepositoryFilters (search, tags, node type, automated status)
- ✅ Shows RepositoryMetrics (test counts)
- **Purpose:** Raw data/administrative view
- **User:** LEAD/QA viewing source data

**Test Cases Module** (`app/test-cases/page.tsx`)
- ⚠️ PROBLEM: Uses HierarchicalTestCaseTree (same as Repository)
- ⚠️ Shows identical hierarchy tree structure
- ❌ Minimal added value over Repository
- ❌ Doesn't help QA efficiently find/filter tests
- **Current Purpose:** Unclear/duplicative

**Test Suites Module** (`app/test-suites/page.tsx`)
- ✅ Supports hierarchy-based suite creation (select nodes → create suite)
- ✅ Lists existing suites
- ✅ Shows test counts per suite
- ❌ Only supports METHOD 1 (hierarchy selection)
- ❌ Can't create suites like "Happy Path + Smoke Tests"
- ❌ Limited flexibility

### 1.2 Database Structure (Current)

```
TestCase (282-296)
├── id, title, description
├── projectId
├── nodes (TestCaseNode[]) - links to RepositoryNode
├── testRuns (TestRun[]) - execution history
├── suites (SuiteTestCase[]) - suite membership
└── tags (TagTestCase[]) - relationship to tags

TestSuite (444-459)
├── id, name, description
├── projectId
├── category (SMOKE, REGRESSION, SPRINT, RELEASE, CUSTOM)
├── selectionMethod (STRING - unclear)
├── selectionConfig (JSON - config for creation)
├── testCases (SuiteTestCase[]) - linked tests
└── usedInCycles (ExecutionCycle[]) - cycles created from this suite

Tag (473-483)
├── id, name, color
├── projectId
├── testCases (TagTestCase[]) - relationship

RoamTestCase (194-216) - Imported test case metadata
├── repositoryNodeId (links to RepositoryNode)
├── title, status, priority
├── tags (STRING[]) - tag names from Roam
├── sourceRoamUid

RepositoryNode (161-192) - Roam hierarchy structure
├── repositoryId, projectId
├── name, slug, path, depth
├── type (FOLDER, FILE, MODULE, FEATURE, EPIC, STORY)
├── parentId (tree structure)
├── tags (STRING[])
├── roamNodeId, roamPageId
└── testCase (RoamTestCase?) - optional link
```

### 1.3 Current Data Flow

```
Roam Research
    ↓
RoamConfig (import config)
    ↓
RepositoryNode (hierarchy tree)
    ↓
RoamTestCase (test case metadata)
    ↓
TestCase (QA test case record)
    ↓
TestSuite (suite membership)
    ↓
ExecutionCycle (execution)
```

### 1.4 API Endpoints (Current)

**Test Cases API:**
- `GET /api/test-cases?projectId=X` - Returns all test cases
- `POST /api/test-cases` - Create test case
- `GET /api/test-cases?projectId=X&search=...` - Search (if implemented)

**Test Suites API:**
- `GET /api/test-suites?projectId=X` - List suites
- `POST /api/test-suites?projectId=X` - Create suite (hierarchy method)
- `GET /api/test-suites/{id}` - Get suite details
- `PATCH /api/test-suites/{id}` - Update suite
- `DELETE /api/test-suites/{id}` - Delete suite

**Repository API:**
- `GET /api/repositories?projectId=X` - List repositories
- `GET /api/repositories/{id}/nodes?...` - Get hierarchy nodes with filters
- `GET /api/repository/tags?projectId=X` - Get available tags
- `GET /api/repository/metrics?projectId=X` - Get test counts

---

## 2. DATABASE CHANGES REQUIRED

### 2.1 Schema Modifications

**TestCase Model** - ADD fields for QA working view:
```typescript
model TestCase {
  // Existing
  id, title, description, projectId, project
  nodes (TestCaseNode[])
  testRuns (TestRun[])
  suites (SuiteTestCase[])
  tags (TagTestCase[])
  
  // NEW FIELDS - QA working view support
  priority       TestCasePriority   // CRITICAL, HIGH, MEDIUM, LOW
  testType       String              // "MANUAL" | "AUTOMATED"
  module         String?             // Denormalized for fast filtering
  feature        String?             // Denormalized for fast filtering
  lastUpdatedAt  DateTime            // Track last modification
  
  @@index([projectId, priority])
  @@index([projectId, testType])
  @@index([projectId, module])
  @@index([projectId, feature])
}
```

**TestSuite Model** - CLARIFY selectionMethod:
```typescript
model TestSuite {
  // Existing
  id, name, description, projectId, category
  testCases (SuiteTestCase[])
  usedInCycles (ExecutionCycle[])
  
  // MODIFY - Make selection method explicit
  creationMethod  String  // "HIERARCHY" | "FILTER" | "MANUAL"
  
  // Existing selectionConfig is good - enhance documentation
  selectionConfig Json?   // 
  // For HIERARCHY: { nodeIds: [id1, id2, ...] }
  // For FILTER: { 
  //   modules: [...], 
  //   testTypes: [...], 
  //   priorities: [...],
  //   tags: [...]
  // }
  // For MANUAL: {}
}
```

**Tag Model** - Keep as is (already good)
```typescript
model Tag {
  id, projectId, name, color
  testCases (TagTestCase[])
}
```

### 2.2 Data Synchronization

**When Roam syncs:**
```
RoamTestCase.tags (imported from Roam)
    ↓
Should populate Tag records
    ↓
Should link TagTestCase relationships
    ↓
Should denormalize TestCase.module, .feature, .testType
```

**Migration Tasks:**
1. ✅ Ensure all TestCase records have priority (add if missing)
2. ✅ Denormalize module/feature from RepositoryNode path
3. ✅ Extract testType from RoamTestCase tags or title patterns
4. ✅ Create Tag records from RoamTestCase.tags
5. ✅ Create TagTestCase relationships
6. ✅ Add database indexes for filtering

---

## 3. API CHANGES REQUIRED

### 3.1 New API Endpoints (Test Cases Module)

**GET /api/test-cases/search** - Advanced search with filters
```
Parameters:
- projectId (required)
- search (optional) - search by ID, title, tag
- modules (optional) - comma-separated module names
- testTypes (optional) - MANUAL,AUTOMATED
- priorities (optional) - CRITICAL,HIGH,MEDIUM,LOW
- tags (optional) - comma-separated tag names
- limit (optional) - default 100
- offset (optional) - default 0

Response:
{
  tests: [
    {
      id, title, description, module, feature,
      testType, priority, tags, lastUpdatedAt
    }
  ],
  total, offset, limit
}
```

**GET /api/test-cases/filters** - Get available filter options
```
Parameters:
- projectId (required)

Response:
{
  modules: [
    { name, count }
  ],
  testTypes: [
    { type, count }
  ],
  priorities: [
    { priority, count }
  ],
  tags: [
    { name, count }
  ]
}
```

**GET /api/test-cases/counts** - Get summary counts
```
Parameters:
- projectId (required)
- filters (optional) - applied filters

Response:
{
  totalTests,
  manualTests,
  automatedTests,
  byTag: { tagName: count },
  byPriority: { priority: count }
}
```

### 3.2 Enhanced API Endpoints (Test Suites Module)

**POST /api/test-suites/from-filters** - NEW: Create suite from filters
```
Request Body:
{
  projectId,
  suiteName,
  description,
  creationMethod: "FILTER",
  selectionConfig: {
    modules: ["Help", "Billing"],
    testTypes: ["MANUAL"],
    priorities: ["CRITICAL", "HIGH"],
    tags: ["Happy Path", "Smoke"]
  }
}

Response:
{
  id, name, description, createdAt,
  testCases: [{ id, title, ... }],
  count: 18
}
```

**POST /api/test-suites/preview** - NEW: Preview matching tests before creating
```
Request Body:
{
  projectId,
  creationMethod: "FILTER",
  selectionConfig: { ... }
}

Response:
{
  matchingTests: [{ id, title, module, feature, ... }],
  count: 18
}
```

### 3.3 Modified API Endpoints

**POST /api/test-suites** - Enhanced to support both methods
```
Request Body (METHOD 1 - existing):
{
  projectId, name, description, category,
  nodeIds: [...]  // hierarchy nodes
}

OR (METHOD 2 - new):
{
  projectId, name, description, category,
  creationMethod: "FILTER",
  selectionConfig: { ... }
}

Response:
{ id, name, testCases, ... }
```

---

## 4. UI CHANGES REQUIRED

### 4.1 Test Cases Module - Complete Redesign

**Current:** Hierarchical tree (duplicates Repository)
**Target:** QA working view with table + powerful filters

**Layout:**
```
┌─────────────────────────────────────────┐
│ Test Cases                              │
│ View test cases with filters            │
└─────────────────────────────────────────┘

┌─ SUMMARY CARDS ─────────────────────────┐
│ Total: 98  Manual: 98  Automated: 52    │
│ Critical: 15  Happy Path: 45  Smoke: 32 │
└─────────────────────────────────────────┘

┌─ FILTERS (SIDEBAR OR COLLAPSIBLE) ──────┐
│ Module:                                  │
│  □ Help (45)                             │
│  □ Billing (32)                          │
│  □ Scheduling (21)                       │
│                                           │
│ Test Type:                                │
│  ☑ Manual (98)                            │
│  ☐ Automated (52)                         │
│                                           │
│ Priority:                                 │
│  □ Critical (15)                          │
│  □ High (25)                              │
│  ☑ Medium (40)                            │
│  □ Low (18)                               │
│                                           │
│ Tags:                                     │
│ □ Happy Path (45)                         │
│ □ Smoke (32)                              │
│ □ Regression (150)                        │
│ □ Sanity (20)                             │
│ □ API (40)                                │
│ □ Billing (60)                            │
│                                           │
│ Search: [___________]                     │
│ By ID, name, tag                          │
└─────────────────────────────────────────┘

┌─ TEST CASES TABLE ──────────────────────┐
│ ID    │ Title      │ Module │ Feature    │
│ TC-01 │ Login page │ Help   │ Auth       │
│ TC-02 │ Payment    │ Billing│ Checkout   │
│ ...                                      │
│                                           │
│ Showing 1-20 of 98                       │
└─────────────────────────────────────────┘
```

**Table Columns:**
- ID (sortable)
- Title (sortable)
- Module (filterable)
- Feature (sortable)
- Test Type (badge: Manual/Automated)
- Priority (badge: Critical/High/Medium/Low)
- Tags (tag pills)
- Last Updated (date)

**Features:**
- Checkbox selection for bulk actions
- Sortable columns
- Responsive design
- Multi-select filters
- Count updates as filters change
- Search highlights results

### 4.2 Test Suites Module - Add Filter-Based Creation

**Current Tab:** Keep existing hierarchy-based creation
**New Tab:** Add filter-based creation

**Tab 1: Hierarchy-Based Creation** (existing)
```
┌─ Create Suite from Hierarchy ───────────┐
│ Select hierarchy nodes:                  │
│ ├ Module: Help                           │
│ │ ├ Feature: FAQ                         │
│ │ │ └─ [✓] Test 1                        │
│ │ │ └─ [✓] Test 2                        │
│ ├ Module: Billing                        │
│ │ ├ Feature: Checkout                    │
│ │ │ └─ [✓] Test 3                        │
│                                           │
│ Selected: 18 tests                       │
│ Suite Name: [_____________________]      │
│ [Create Suite]                           │
└─────────────────────────────────────────┘
```

**Tab 2: Filter-Based Creation** (new)
```
┌─ Create Suite from Filters ─────────────┐
│                                           │
│ Step 1: Select Filters                   │
│ ──────────────────────────────            │
│ Modules:   [Help] [Billing]               │
│ Test Type: [☑ Manual] [☐ Automated]       │
│ Priority:  [☑ Critical] [☑ High]          │
│ Tags:      [☑ Happy Path] [☑ Smoke]       │
│                                           │
│ Step 2: Preview                          │
│ ──────────────────────────────            │
│ [Preview Tests] (shows 18 matching)      │
│                                           │
│ Step 3: Create Suite                     │
│ ──────────────────────────────            │
│ Suite Name: [Help Happy Path Smoke]      │
│ Description: [________________________________]
│                                           │
│ [Cancel] [Create Suite]                  │
└─────────────────────────────────────────┘
```

**Features:**
- Multi-select for each filter type
- Live preview of matching tests
- Clear step-by-step workflow
- Confirmation before creation
- Show test count at each step

### 4.3 Repository Module - Keep As-Is

No UI changes needed. Repository remains administrative/hierarchy view.

---

## 5. MIGRATION IMPACT

### 5.1 Data Migration Required

**Step 1: Populate TestCase fields**
```sql
-- Denormalize module from hierarchy path
UPDATE TestCase
SET module = (
  SELECT n.name FROM RepositoryNode n
  WHERE n.id IN (
    SELECT nodeId FROM TestCaseNode WHERE testCaseId = TestCase.id
  ) AND n.type = 'MODULE'
  LIMIT 1
)

-- Denormalize feature from hierarchy path
UPDATE TestCase
SET feature = (
  SELECT n.name FROM RepositoryNode n
  WHERE n.id IN (
    SELECT nodeId FROM TestCaseNode WHERE testCaseId = TestCase.id
  ) AND n.type = 'FEATURE'
  LIMIT 1
)

-- Extract test type from tags or default
UPDATE TestCase
SET testType = CASE
  WHEN EXISTS (SELECT 1 FROM RoamTestCase rtc 
               WHERE rtc.repositoryNodeId IN (
                 SELECT nodeId FROM TestCaseNode 
                 WHERE testCaseId = TestCase.id
               ) AND 'Automated' = ANY(rtc.tags))
  THEN 'AUTOMATED'
  ELSE 'MANUAL'
END
```

**Step 2: Create Tag records from RoamTestCase.tags**
```sql
-- Insert unique tags from all RoamTestCase records
INSERT INTO Tag (projectId, name, color)
SELECT DISTINCT p.id, unnest(rtc.tags), '#6366f1'
FROM RoamTestCase rtc
JOIN TestCase tc ON tc.projectId = rtc.projectId
JOIN Project p ON p.id = tc.projectId
WHERE unnest(rtc.tags) NOT IN (SELECT name FROM Tag)
```

**Step 3: Create TagTestCase relationships**
```sql
-- Link test cases to their tags
INSERT INTO TagTestCase (tagId, testCaseId)
SELECT t.id, tc.id
FROM RoamTestCase rtc
JOIN TestCase tc ON tc.projectId = rtc.projectId
JOIN Tag t ON t.projectId = rtc.projectId
WHERE t.name = ANY(rtc.tags)
AND NOT EXISTS (
  SELECT 1 FROM TagTestCase 
  WHERE tagId = t.id AND testCaseId = tc.id
)
```

### 5.2 No Breaking Changes

- ✅ Repository module unchanged
- ✅ Execution Cycles still created from Test Suites
- ✅ Existing suites continue to work
- ✅ TestCase creation still works
- ✅ TestRun/ExecutionCycle unaffected

---

## 6. RISKS & MITIGATION

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Tag sync from Roam inconsistent | Tags may be incomplete/wrong | Add validation in sync process; audit tag imports |
| Large test case sets slow filtering | Performance degradation | Add database indexes; implement pagination/lazy loading |
| Denormalized data gets out of sync | Stale module/feature info | Add background sync job; update on save |
| Users create duplicate suites | Confusion with naming | Add name validation; suggest existing names |
| Filter combinations return 0 tests | User confusion | Show "no matches" clearly; suggest adjusting filters |
| Existing suites can't be recreated with filters | Loss of reproducibility | Store selectionConfig for all suites; allow "recreate" |

---

## 7. IMPLEMENTATION PLAN - PHASED APPROACH

### PHASE 1: Database & API Foundation (Week 1)
**Goal:** Set up infrastructure for new features without UI changes yet

**Tasks:**
1. ✅ Add TestCase fields: priority, testType, module, feature, lastUpdatedAt
2. ✅ Add TestSuite field: creationMethod (default "HIERARCHY")
3. ✅ Create database migration
4. ✅ Add indexes for filtering (projectId+priority, projectId+testType, etc.)
5. ✅ Data migration: denormalize module/feature
6. ✅ Data migration: create Tag records from RoamTestCase.tags
7. ✅ Data migration: create TagTestCase relationships
8. ✅ Create new API endpoints:
   - GET /api/test-cases/search (with filters)
   - GET /api/test-cases/filters (available options)
   - GET /api/test-cases/counts (summary)
9. ✅ Enhance POST /api/test-suites to support both creation methods
10. ✅ Create new suite endpoints:
    - POST /api/test-suites/from-filters
    - POST /api/test-suites/preview

**Deliverable:** New APIs working, old functionality still works
**Testing:** API tests for all endpoints
**Risk:** Low (API changes only, UI unchanged)

---

### PHASE 2: Test Cases UI Redesign (Week 2)
**Goal:** Replace hierarchical tree view with QA working table view

**Tasks:**
1. ✅ Create new TestCaseTable component
2. ✅ Add sortable/filterable columns
3. ✅ Implement sidebar filters:
   - Module filter with counts
   - Test Type filter with counts
   - Priority filter with counts
   - Tags filter with counts
   - Search box
4. ✅ Create summary cards component
5. ✅ Wire up to new APIs
6. ✅ Add pagination/lazy loading
7. ✅ Update app/test-cases/page.tsx to use new layout
8. ✅ Remove HierarchicalTestCaseTree usage
9. ✅ Add test case selection (checkbox)
10. ✅ Add "Create Suite from Selected" action

**Deliverable:** New Test Cases UI, working filters, summary cards
**Testing:** E2E tests for filter combinations, sorting, search
**Risk:** Medium (UI changes, but no data model changes)

---

### PHASE 3: Test Suites Filter-Based Creation (Week 3)
**Goal:** Add METHOD 2 (filter-based suite creation)

**Tasks:**
1. ✅ Create FilterBasedSuiteCreation component
2. ✅ Implement step-by-step workflow
   - Step 1: Select filters
   - Step 2: Preview matching tests
   - Step 3: Enter suite details
   - Step 4: Create suite
3. ✅ Add tab to test-suites page:
   - Tab 1: Hierarchy-Based (existing)
   - Tab 2: Filter-Based (new)
4. ✅ Wire up to POST /api/test-suites/from-filters
5. ✅ Implement preview functionality
6. ✅ Add validation (suite name, at least 1 filter)
7. ✅ Success confirmation with created suite details
8. ✅ Handle errors gracefully

**Deliverable:** Complete filter-based suite creation workflow
**Testing:** E2E tests for suite creation with various filter combinations
**Risk:** Medium (workflow new, but APIs proven in Phase 1)

---

### PHASE 4: Enhancement & Optimization (Week 4)
**Goal:** Polish, optimize, add quality-of-life features

**Tasks:**
1. ✅ Add suite duplication from existing suites
2. ✅ Add "Create Suite from Selected Tests" from Test Cases table
3. ✅ Add bulk tagging from Test Cases module
4. ✅ Implement keyboard shortcuts (Ctrl+F for search, etc.)
5. ✅ Add export test cases to CSV
6. ✅ Performance optimization:
   - Lazy load filter options
   - Cache frequently accessed filters
   - Optimize slow queries
7. ✅ Add admin features:
   - Bulk update priority/testType
   - Reconcile tags with Roam
   - View test case sync status
8. ✅ Documentation:
   - User guide for filters
   - API documentation
   - Admin guide

**Deliverable:** Polished, optimized, feature-complete solution
**Testing:** Load testing with large test case sets
**Risk:** Low (enhancements, not core functionality changes)

---

## 8. SUCCESS CRITERIA

### Phase 1 ✅
- [ ] All new API endpoints respond correctly
- [ ] Migration scripts complete without errors
- [ ] Existing test suite creation still works
- [ ] No data loss or corruption
- [ ] API tests pass (100% of endpoints)

### Phase 2 ✅
- [ ] Test Cases page loads without hierarchy tree
- [ ] All filters work independently and in combination
- [ ] Summary cards show correct counts
- [ ] Search finds tests by ID, name, tag
- [ ] Table sorting works on all columns
- [ ] Pagination works correctly
- [ ] UI responsive on mobile

### Phase 3 ✅
- [ ] Filter-based suite creation works end-to-end
- [ ] Preview shows correct test count
- [ ] Suite created with correct test case associations
- [ ] Both creation methods work side-by-side
- [ ] Error handling for invalid filters
- [ ] Execution cycles can be created from filter-based suites

### Phase 4 ✅
- [ ] Performance acceptable with 1000+ test cases
- [ ] All enhancement features working
- [ ] Documentation complete
- [ ] User satisfaction feedback positive

---

## 9. ROLLBACK PLAN

If issues arise:

**Phase 1:** 
- Rollback migration
- Keep old APIs available
- Test Suites continue using hierarchy method

**Phase 2:**
- Revert Test Cases page to HierarchicalTestCaseTree component
- Keep new APIs available (no harm)

**Phase 3:**
- Hide filter-based creation tab
- Keep hierarchy-based creation only

**Phase 4:**
- Disable new features one-by-one
- Keep core functionality

---

## 10. NEXT STEPS

### Approval Required For:
1. ✅ Database schema changes (TestCase fields, TestSuite creationMethod)
2. ✅ Data migration approach
3. ✅ API design (endpoint paths, response formats)
4. ✅ UI/UX design (table layout, filter sidebar placement)
5. ✅ Phase timeline (can phases be concurrent?)

### Questions for Clarification:
1. Should tag hierarchy be preserved? (e.g., "Happy Path > Login Path", "Happy Path > Checkout Path")
2. Should suites support "dynamic" filtering? (i.e., filter changes update suite automatically)
3. Should there be preset filter combinations? (e.g., "Common Smoke Suite")
4. Performance target: How many tests expected? (current: 98, future: 1000+?)
5. Should Roam tag structure be automatically mirrored?

---

## Appendix: Current vs Target Comparison

### Test Cases Module

| Aspect | Current | Target |
|--------|---------|--------|
| View | Hierarchy tree | Table with filters |
| Primary Action | Browse structure | Find/filter tests |
| Added Value | None (duplicates Repository) | Significant (QA working view) |
| Filters | None | 5+ filter types |
| Search | Global search only | Multi-field search |
| Bulk Actions | None | Selection, bulk tag, create suite |
| Performance | Slow with large hierarchies | Fast with indexes & pagination |

### Test Suites Module

| Aspect | Current | Target |
|--------|---------|--------|
| Creation Method 1 | Hierarchy selection | ✅ Keep (improved) |
| Creation Method 2 | None | ✅ Add (filter-based) |
| Quick Suites | Difficult | ✅ Easy (Happy Path, Smoke, etc.) |
| Multi-Tag Support | Manual (complex) | ✅ Automatic (multi-select) |
| Suite Flexibility | Limited | High |

---

## Document Status

**Status:** Ready for Review & Approval
**Created:** 2026-06-23
**Next Action:** Stakeholder approval to proceed with Phase 1

