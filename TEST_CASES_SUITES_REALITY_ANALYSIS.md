# Test Cases & Test Suites Redesign - REALITY ANALYSIS

Based on actual Roam data structure and current implementation.

**Analysis Date:** 2026-06-23
**Status:** Analysis Complete - Awaiting Approval Before Implementation

---

## 1. CURRENT ARCHITECTURE ASSESSMENT

### 1.1 Data Structure Reality

**What Roam Actually Provides:**
```
Simple one-liner test cases with inline tags:

"When I enter a valid email address in the email field, it must be accepted. #Manual"

"When I enter valid login credentials, I should be able to log in successfully. #Manual #HappyPath #Smoke"

"Test for billing calculation with two items. #Billing #Regression"
```

**What We Have in Database:**

```
RoamTestCase (model - imported from Roam)
├── title (String) - Simple one-liner text
├── tags (String[]) - Inline tags from Roam (e.g., ["Manual", "HappyPath", "Smoke"])
├── repositoryNodeId - Link to hierarchy (Module → Feature → Screen)
├── status, priority - EXIST but are defaults, not meaningful
└── No structured fields: ID, steps, expected results, etc.

TestCase (model - QA Ops record)
├── id (UUID) - Not a semantic "Test Case ID"
├── title (String)
├── description (String?)
├── projectId
├── nodes (TestCaseNode[]) - Links to RepositoryNode (hierarchy)
├── tags (TagTestCase[]) - Many-to-many relationship
├── testRuns (TestRun[]) - Execution history
├── suites (SuiteTestCase[]) - Suite membership
└── NO priority, type, module, feature fields

RepositoryNode (hierarchy)
├── name (String) - Module, Feature, Screen name
├── type (NodeType) - FOLDER, FILE, MODULE, FEATURE, etc.
├── path (String) - "/moduleId/featureId/screenId"
├── parent/children - Tree structure
└── tags (String[]) - Optional tags

Tag (global tags)
├── id, projectId, name, color
├── testCases (TagTestCase[]) - Many-to-many
└── ONE tag can apply to many test cases

TestSuite (already supports both methods!)
├── id, projectId, name, description
├── category (SMOKE, REGRESSION, SPRINT, RELEASE, CUSTOM)
├── selectionMethod (String) - "HIERARCHY" or "FILTER"
├── selectionConfig (Json?) - Configuration for creation method
├── testCases (SuiteTestCase[]) - Suite members (SNAPSHOT)
└── Already has infrastructure for both creation methods!
```

### 1.2 Current Module Reality

**Repository Module:**
- ✅ Shows RepositoryNode hierarchy
- ✅ Can filter by tags, node type
- ✅ Shows test counts
- ✅ Displays hierarchy tree
- ✅ Admin/verification view

**Test Cases Module:**
- ⚠️ Currently uses HierarchicalTestCaseTree (duplicates Repository)
- ❌ Same hierarchy view as Repository
- ❌ Minimal added value
- ❌ Not optimized for QA workflow
- ❌ Can't filter by tags effectively
- ❌ Can't preview test matches

**Test Suites Module:**
- ✅ Can create from hierarchy
- ⚠️ Already has selectionMethod + selectionConfig fields
- ❌ Filter-based creation UI doesn't exist
- ❌ Can't preview matching tests before creation

### 1.3 Key Discovery: What Already Works

The database ALREADY supports both suite creation methods:

```typescript
TestSuite {
  selectionMethod: "HIERARCHY" | "FILTER" | "MANUAL"
  selectionConfig: {
    // For HIERARCHY:
    nodeIds: ["node1", "node2"]
    
    // For FILTER:
    modules: ["Login", "Help"]
    tags: ["HappyPath", "Smoke"]
    type: ["Manual"]
  }
}
```

**This means:** We just need to build the UI and APIs - the database is ready!

---

## 2. GAP ANALYSIS

### 2.1 Test Cases Module Gaps

| Requirement | Current | Gap | Impact |
|-------------|---------|-----|--------|
| QA working view | Hierarchy tree | ❌ Doesn't exist | Can't find tests efficiently |
| Summary cards | None | ❌ Doesn't exist | Can't see test counts |
| Filter by Module | ❌ No | ❌ Doesn't exist | Can't narrow by location |
| Filter by Type | ❌ No | ❌ Doesn't exist | Can't distinguish Manual/Automated |
| Filter by Tags | ❌ No | ❌ Doesn't exist | Can't find tests by trait |
| Search tests | Global search only | ❌ Weak | Can't find specific tests |
| Bulk select | ❌ No | ❌ Doesn't exist | Can't create suite from selected |
| Grid layout | ❌ Tree only | ❌ Missing | Not QA-friendly |

### 2.2 Test Suites Module Gaps

| Requirement | Current | Gap | Impact |
|-------------|---------|-----|--------|
| Hierarchy creation | ✅ Yes | ✓ Works | Can create from tree |
| Filter creation UI | ❌ No | ❌ Missing | Can't preview/create from filters |
| Tag combinations | Manual (complex) | ❌ Hard | Multi-tag suites difficult |
| Preview matching | ❌ No | ❌ Missing | Can't verify before creating |
| Preset suites | ❌ No | ❌ Missing | Can't quick-create common suites |

### 2.3 Data Gaps

| Data | Current | Gap | Impact |
|------|---------|-----|--------|
| Module name | In RepositoryNode | Need denormalized | Fast filtering |
| Feature name | In RepositoryNode | Need denormalized | Fast filtering |
| Test statement | In TestCase.title | ✓ Ready | Grid display |
| Tags | In RoamTestCase.tags | Need sync to Tag records | Centralized filtering |
| Type (Manual/Auto) | In RoamTestCase.tags | Need extraction | Filter by type |

---

## 3. DATABASE IMPACT

### 3.1 Schema Changes Required

**MINIMAL changes needed** - schema is mostly ready!

```typescript
// TestCase - ADD denormalized fields for fast filtering
model TestCase {
  // Existing
  id, title, description, projectId
  nodes, testRuns, suites, tags
  createdAt, updatedAt
  
  // NEW - Denormalized for performance
  module           String?     // e.g., "Login", "Help", "Billing"
  feature          String?     // e.g., "Email Validation", "Password Reset"
  type             String?     // "MANUAL" | "AUTOMATED" (from tags)
  
  // Indexes for filtering
  @@index([projectId, module])
  @@index([projectId, feature])
  @@index([projectId, type])
}

// Tag - NO CHANGES (already perfect)
model Tag {
  id, projectId, name, color, testCases
  @@unique([projectId, name])
  @@index([projectId])
}

// TestSuite - VERIFY selectionMethod/selectionConfig are used
model TestSuite {
  // Already has what we need
  selectionMethod   String  // "HIERARCHY" | "FILTER"
  selectionConfig   Json?   // { nodeIds: [...] } or { modules: [...], tags: [...] }
  
  // Already has the rest
  id, projectId, name, description, category
  testCases, usedInCycles, createdAt, updatedAt
}
```

### 3.2 Data Migration

**What needs to happen:**

```sql
1. Extract Module from RepositoryNode hierarchy
   UPDATE TestCase
   SET module = (
     SELECT rn.name FROM RepositoryNode rn
     WHERE rn.id IN (
       SELECT nodeId FROM TestCaseNode WHERE testCaseId = TestCase.id
     ) AND rn.type = 'MODULE'
     LIMIT 1
   )

2. Extract Feature from RepositoryNode hierarchy
   UPDATE TestCase
   SET feature = (
     SELECT rn.name FROM RepositoryNode rn
     WHERE rn.id IN (
       SELECT nodeId FROM TestCaseNode WHERE testCaseId = TestCase.id
     ) AND rn.type = 'FEATURE'
     LIMIT 1
   )

3. Sync tags from RoamTestCase to Tag records
   INSERT INTO Tag (projectId, name, color)
   SELECT DISTINCT p.id, unnest(rtc.tags), '#6366f1'
   FROM RoamTestCase rtc
   JOIN Project p ON p.id = rtc.projectId
   WHERE unnest(rtc.tags) NOT IN (
     SELECT name FROM Tag WHERE projectId = p.id
   )

4. Create TagTestCase relationships
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

5. Extract type from tags
   UPDATE TestCase
   SET type = CASE
     WHEN EXISTS (
       SELECT 1 FROM TagTestCase tt
       JOIN Tag t ON t.id = tt.tagId
       WHERE tt.testCaseId = TestCase.id
       AND t.name = 'Automated'
     ) THEN 'AUTOMATED'
     ELSE 'MANUAL'
   END
```

### 3.3 No Breaking Changes

✅ No existing models are removed
✅ No relationships are changed
✅ TestCase relationships remain intact
✅ TestRun/ExecutionCycle unaffected
✅ Backward compatible

---

## 4. API IMPACT

### 4.1 NEW APIs Required

**Test Cases Filtering API:**
```
GET /api/test-cases/search
Parameters:
  projectId (required)
  module (optional) - filter by module name
  feature (optional) - filter by feature name
  type (optional) - "MANUAL" | "AUTOMATED"
  tags (optional) - comma-separated tag names (AND logic)
  search (optional) - search text in title
  limit (optional) - default 50, max 200
  offset (optional) - default 0

Response:
{
  testCases: [
    {
      id,
      title,
      module,
      feature,
      type,
      tags: [{ id, name }]
    }
  ],
  total,
  limit,
  offset
}
```

**Test Cases Filter Options API:**
```
GET /api/test-cases/filter-options
Parameters:
  projectId (required)

Response:
{
  modules: [
    { name: "Login", count: 45 },
    { name: "Help", count: 32 },
    ...
  ],
  features: [
    { name: "Email Validation", count: 12 },
    ...
  ],
  types: [
    { type: "MANUAL", count: 98 },
    { type: "AUTOMATED", count: 52 }
  ],
  tags: [
    { name: "HappyPath", count: 45 },
    { name: "Smoke", count: 32 },
    ...
  ]
}
```

**Test Cases Summary API:**
```
GET /api/test-cases/summary
Parameters:
  projectId (required)
  filters (optional) - applied filters

Response:
{
  total: 98,
  byType: {
    MANUAL: 98,
    AUTOMATED: 52
  },
  byTag: {
    HappyPath: 45,
    Smoke: 32,
    Regression: 150,
    ...
  },
  byModule: {
    Login: 45,
    Help: 32,
    ...
  }
}
```

**Suite Preview API:**
```
POST /api/test-suites/preview
Body:
{
  projectId,
  filters: {
    module: ["Login"],
    tags: ["HappyPath", "Smoke"],
    type: ["MANUAL"]
  }
}

Response:
{
  matchingTests: [
    { id, title, module, feature, type }
  ],
  count: 12
}
```

**Create Suite from Filters API:**
```
POST /api/test-suites/from-filters
Body:
{
  projectId,
  name: "Login Happy Path Smoke Suite",
  description: "Optional description",
  filters: {
    module: ["Login"],
    tags: ["HappyPath", "Smoke"],
    type: ["MANUAL"]
  }
}

Response:
{
  id,
  name,
  testCases: [...],
  count: 12,
  createdAt
}

Internally:
- Creates TestSuite with selectionMethod = "FILTER"
- Stores filters in selectionConfig = { ... }
- Creates SuiteTestCase records for all matched tests (SNAPSHOT)
```

### 4.2 MODIFIED APIs

**POST /api/test-suites** - Already supports both methods, just needs UI
```
Body (existing - HIERARCHY method):
{
  projectId,
  name,
  description,
  nodeIds: [...] // hierarchy nodes
}

Body (new - FILTER method):
{
  projectId,
  name,
  description,
  selectionMethod: "FILTER",
  selectionConfig: {
    module: [...],
    tags: [...],
    type: [...]
  }
}
```

### 4.3 Roam Sync Enhancement

**RoamSync → Tag Creation** 
When Roam imports new test cases:
```
1. Extract tags from RoamTestCase.tags
2. Create Tag records (if not exist)
3. Link via TagTestCase
4. Update TestCase.type based on tags
```

---

## 5. UI IMPACT

### 5.1 Test Cases Module - Complete Redesign

**Current:** Hierarchy tree (same as Repository)
**Target:** QA working view with filters and grid

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────┐
│  Test Cases                                              │
│  QA working area for finding and creating suites        │
└─────────────────────────────────────────────────────────┘

┌─ SUMMARY CARDS ─────────────────────────────────────────┐
│ Total: 98 │ Manual: 98 │ Automated: 52                  │
│ HappyPath: 45 │ Smoke: 32 │ Regression: 150             │
└─────────────────────────────────────────────────────────┘

┌──────────────────┐  ┌────────────────────────────────┐
│ FILTERS          │  │ TEST CASES GRID                │
│ (Sidebar)        │  │                                │
│ ─────────────────│  │ Title     │ Module  │ Type  ... │
│ Module:          │  │─────────────────────────────────│
│  □ Login (45)    │  │ When I    │ Login   │ Manual    │
│  □ Help (32)     │  │ enter...  │         │           │
│  □ Billing (20)  │  │           │         │           │
│  ...             │  │ Test for  │ Billing │ Manual    │
│ ─────────────────│  │ billing...│         │           │
│ Type:            │  │           │         │           │
│  ☑ Manual (98)   │  │ ... (pagination)                │
│  ☐ Automated (52)│  │                                │
│ ─────────────────│  │ Page 1 of 5                    │
│ Tags:            │  │ [< Prev] [1] [2] [3] [Next >] │
│  □ HappyPath (45)│  └────────────────────────────────┘
│  □ Smoke (32)    │
│  □ Regression... │
│ ─────────────────│
│ Search: [____]   │
│ (title, tag...)  │
└──────────────────┘
```

**Key Features:**
- ✅ Multi-select filters
- ✅ Live count updates as filters change
- ✅ Grid display (not tree)
- ✅ Responsive design
- ✅ Search across test titles
- ✅ Quick preview of matching tests
- ✅ Bulk select for suite creation

### 5.2 Test Suites Module - Add Filter Tab

**Current:** Hierarchy-based creation tab
**Target:** Add new filter-based creation tab (keep hierarchy tab)

**Tab 1: Hierarchy-Based** (existing - keep as-is)
```
┌─ Create Suite - Hierarchy Method ────────────────────┐
│                                                       │
│ Select from Repository Tree:                         │
│                                                       │
│ ├ Module: Help                                        │
│ │ ├ Feature: FAQ                                      │
│ │ │ ├ [✓] When I search...                            │
│ │ │ ├ [✓] When I click...                             │
│ │ │ └ [✗] When no results...                          │
│ │ └ Feature: Search                                   │
│ │   └ [✓] Test for search...                          │
│ ...                                                   │
│                                                       │
│ Selected: 18 tests                                    │
│ Suite Name: [________________]                        │
│ Description: [____________________]                   │
│ [Create Suite]                                        │
└───────────────────────────────────────────────────────┘
```

**Tab 2: Filter-Based** (new)
```
┌─ Create Suite - Filter Method ──────────────────────┐
│                                                      │
│ Step 1: Select Filters                              │
│ ─────────────────────────────                        │
│ Module: [Help] [Billing]                            │
│ Tags: [HappyPath] [Smoke]                           │
│ Type: [☑ Manual] [☐ Automated]                      │
│                                                      │
│ Matching Tests: 12                                   │
│                                                      │
│ [Preview Tests] [Clear Filters]                     │
│                                                      │
│ Step 2: Suite Details                               │
│ ─────────────────────────────                        │
│ Suite Name: [Help Happy Path Smoke]                 │
│ Description: [_________________________]             │
│                                                      │
│ [Cancel] [Create Suite]                             │
└──────────────────────────────────────────────────────┘
```

**Features:**
- ✅ Multi-select for each filter type
- ✅ Live count of matching tests
- ✅ Preview before creation
- ✅ Shows matching test details
- ✅ Simple two-step workflow
- ✅ Clear feedback

### 5.3 Repository Module - NO CHANGES

Keep existing hierarchy view for admin/verification purposes.

---

## 6. MIGRATION IMPACT

### 6.1 Data Migration Plan

**Phase 0: Preparation (Pre-coding)**
1. Create database migration script
2. Create backups
3. Prepare rollback plan

**Phase 1: Schema Changes**
1. Add module, feature, type columns to TestCase
2. Add indexes for filtering
3. Verify no existing data conflicts

**Phase 2: Data Sync**
1. Denormalize module from RepositoryNode
2. Denormalize feature from RepositoryNode
3. Extract type from tags
4. Create Tag records from RoamTestCase.tags
5. Create TagTestCase relationships
6. Verify data integrity

**Phase 3: Verification**
1. Check all test cases have module/feature
2. Check all unique tags are in Tag table
3. Check TagTestCase relationships count
4. Run performance tests

### 6.2 Rollback Strategy

If migration fails:
1. Revert schema changes
2. Keep old Test Cases UI (hierarchy tree)
3. No data loss
4. Retry migration after fixes

### 6.3 Zero Downtime

- Migration can run on live database
- Columns are nullable initially
- Old code still works with NULL values
- Gradual data backfill possible

---

## 7. IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Week 1)
**Database & APIs**
- [ ] Add TestCase columns (module, feature, type)
- [ ] Create migration script
- [ ] Migrate data (denormalize + tag sync)
- [ ] Create Tag records from Roam tags
- [ ] Create TagTestCase relationships
- [ ] Add database indexes
- [ ] Create new APIs (search, filters, summary, preview)
- [ ] Test API performance with 10,000 test cases

**Effort:** 3 days
**Deliverable:** Database ready, APIs working

---

### Phase 2: Test Cases UI (Week 1-2)
**New QA Working View**
- [ ] Create TestCaseGrid component
- [ ] Create FilterSidebar component
- [ ] Create SummaryCards component
- [ ] Implement module filter
- [ ] Implement type filter
- [ ] Implement tags filter
- [ ] Implement search
- [ ] Add pagination
- [ ] Add bulk selection
- [ ] Wire up to APIs
- [ ] Test performance (< 1s page load)

**Effort:** 4 days
**Deliverable:** Test Cases module redesigned

---

### Phase 3: Suite Creation - Filter Method (Week 2)
**New Filter-Based Suite Creation**
- [ ] Create filter selection component
- [ ] Add preview matching tests feature
- [ ] Create suite from filters API integration
- [ ] Add "Filter Method" tab in Test Suites
- [ ] Keep "Hierarchy Method" tab working
- [ ] Test suite creation workflow
- [ ] Verify suites are snapshots (not dynamic)

**Effort:** 3 days
**Deliverable:** Both suite creation methods working

---

### Phase 4: Enhancement & Polish (Week 3)
**Performance & Refinement**
- [ ] Performance optimization (lazy load, caching)
- [ ] Add preset suites (Smoke, HappyPath, Regression, etc.)
- [ ] Add "Create suite from selected tests" feature
- [ ] Add bulk tag/untag from Test Cases
- [ ] Test with 10,000+ test cases
- [ ] Documentation
- [ ] User testing

**Effort:** 2 days
**Deliverable:** Production-ready, polished

---

### Phase 5: Roam Integration (Continuous)
**Automated Tag Sync**
- [ ] Enhance Roam sync to create Tag records
- [ ] Auto-link TagTestCase on sync
- [ ] Update TestCase.type on sync
- [ ] Handle tag renames gracefully
- [ ] Keep Tag counts up to date

**Effort:** Integrated during other phases

---

## 8. RISK ASSESSMENT

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Migration loses tag data | Low | High | Test migration on copy first |
| Denormalized data gets stale | Low | Medium | Background job to resync |
| Large test case set (10k+) slow | Medium | Medium | Indexes + pagination |
| Suite filters return 0 tests | Low | Low | Clear UI messaging |
| Roam sync breaks tag mapping | Low | Medium | Validate tag format |

---

## 9. EFFORT ESTIMATION

```
Phase 1 (Database & APIs):     3 days
Phase 2 (Test Cases UI):       4 days
Phase 3 (Suite Filters):       3 days
Phase 4 (Polish & Presets):    2 days
Phase 5 (Roam Integration):    1 day (integrated)

Total: ~13 days = 2.6 weeks
```

**Includes:**
- Design & planning
- Development
- Testing
- Documentation
- Buffer for issues

---

## 10. SUCCESS CRITERIA

### Functional
- [ ] Filter by Module works
- [ ] Filter by Type works
- [ ] Filter by Tags works (multi-select)
- [ ] Search finds tests
- [ ] Suite creation from filters works
- [ ] Suite creation from hierarchy works
- [ ] Suites are snapshots (not dynamic)
- [ ] Execution cycles from suites still work

### Performance
- [ ] Test Cases page loads in < 1 second
- [ ] Search < 500ms
- [ ] Filtering < 500ms
- [ ] Suite creation < 2 seconds
- [ ] Works with 10,000+ test cases

### Quality
- [ ] No data loss in migration
- [ ] No breaking changes
- [ ] Backward compatible
- [ ] All existing functionality intact

---

## 11. DEPENDENCIES

**External:**
- Roam sync working (already is)
- Repository tree working (already is)
- Execution cycles working (already is)

**Internal:**
- Tag sync from Roam (needs enhancement)
- TestCase denormalization (needs migration)

**No blocking dependencies** - can start immediately!

---

## 12. ARCHITECTURAL SUMMARY

```
CURRENT (Hierarchical):
Repository → Test Cases (hierarchy tree) → Test Suites → Execution Cycles

TARGET (Dual View):
Repository (admin view - unchanged)
    ↓
Test Cases (QA working view - NEW grid + filters)
    ├─ Filter by Module
    ├─ Filter by Type
    ├─ Filter by Tags
    └─ Search
    ↓
Test Suites (both methods)
    ├─ Method 1: Hierarchy selection (existing)
    └─ Method 2: Filter-based (new)
    ↓
Execution Cycles (unchanged)
```

**Key Insight:** This is primarily a UI redesign with minimal database changes. The schema is already ready!

---

## 13. DELIVERABLES CHECKLIST

### Documentation
- [ ] Detailed implementation plan (this document ✅)
- [ ] API specification
- [ ] UI wireframes
- [ ] Database migration scripts
- [ ] User guide
- [ ] Admin guide

### Code
- [ ] Database migration
- [ ] New/modified models
- [ ] New API endpoints
- [ ] New UI components
- [ ] Updated existing components
- [ ] Tests

### Testing
- [ ] Unit tests
- [ ] Integration tests
- [ ] Performance tests
- [ ] End-to-end tests
- [ ] Migration validation

### Validation
- [ ] All existing functionality works
- [ ] No data loss
- [ ] Performance targets met
- [ ] Backward compatible

---

## STATUS: READY FOR APPROVAL

✅ Analysis complete
✅ All gaps identified
✅ Database impact minimal
✅ APIs designed
✅ UI planned
✅ Migration strategy clear
✅ Risks identified
✅ Timeline reasonable

**AWAITING APPROVAL TO PROCEED WITH IMPLEMENTATION**

