# Test Cases & Test Suites Redesign - FINAL IMPLEMENTATION PLAN (APPROVED)

**Status:** ✅ APPROVED FOR IMPLEMENTATION
**Date:** 2026-06-23
**Stakeholder Decisions:** All questions answered

---

## CONFIRMED REQUIREMENTS

### 1. Tags - FLAT (NO HIERARCHY)

**Decision:** NO hierarchical tags

**Tag Examples:**
```
#HappyPath
#Smoke
#Regression
#Sanity
#API
#Billing
#Scheduling
#Critical
```

**Rationale:**
- Simpler filtering UI
- Easier suite creation
- Better automation integration
- Less database complexity

**If Hierarchical Structure Needed Later:**
- Use Module and Feature fields instead
- Keep tags flat for now

### 2. Suites - SNAPSHOTS (NOT DYNAMIC)

**Decision:** Suites are point-in-time snapshots

**Example:**
```
Today: Create "Release 2.4 Happy Path Suite"
  → Contains 50 tests matching filters

Tomorrow: 10 new Happy Path tests added
  → Existing suite still contains 50 tests (unchanged)
  → New tests NOT automatically added

If Users Want Latest:
  → Create new suite: "Release 2.5 Happy Path Suite"
```

**Rationale:**
- Release suites must match exact execution scope
- Reproducibility for audits
- No surprises with changing test counts

### 3. Preset Filter Combinations - YES

**Decision:** Provide built-in presets

**Preset Suites:**
```
1. Smoke Suite
   - Auto-configured common smoke tests
   - Save time for common use cases

2. Happy Path Suite
   - Auto-configured golden path tests

3. Regression Suite
   - Auto-configured regression tests

4. Sanity Suite
   - Auto-configured sanity tests

5. Critical Regression Suite
   - Critical + Regression combined
```

**User Customization:**
- Users can save custom filter combinations
- Example: "Billing Regression", "Scheduling Smoke", "API Critical"

**Benefits:**
- Faster suite creation
- Consistency across team
- Reduced clicks for common scenarios

### 4. Performance Targets - CONFIRMED

**Scale Design:**
- Current: ~1,000 test cases
- Target: 10,000+ test cases

**Performance SLAs:**
```
Search Tests         < 500ms
Apply Filters        < 500ms
Create Suite         < 2 seconds
Load Test Cases Page < 1 second
Repository Tree Expand < 500ms
```

**Implementation Strategy:**
- Database indexes on all filter columns
- Pagination (50/100 per page)
- Lazy loading for filters
- Connection pooling
- Query optimization

### 5. Auto-Mirror Roam Tags - YES

**Decision:** Roam is source of truth for tags

**Sync Behavior:**
```
Roam Research
    ↓
Sync Process (every 15 min or on-demand)
    ↓
QA Ops Platform
    - Add new tags
    - Update renamed tags
    - Update test-to-tag mappings
    - Maintain counts
```

**Example:**
```
Roam Tags After Sync:
#HappyPath (45 tests)
#Smoke (32 tests)
#Regression (150 tests)
#API (40 tests)

QA Ops - Immediately Available:
Filter by #HappyPath (45)
Filter by #Smoke (32)
... etc
```

**No Manual Tag Creation:**
- ❌ QA Ops users CANNOT create tags
- ✅ Tags only come from Roam
- ✅ Automated sync keeps in sync

---

## BOTH SUITE CREATION METHODS - REQUIRED

**Method 1: Repository Hierarchy** (Keep Existing)
```
Repository Module
  ├ Select Hierarchy
  │ └ Module → Feature → Test Cases
  ├ Checkbox selection
  └ Create Suite
```

**Method 2: Filter-Based** (Add New)
```
Test Cases Module
  ├ Apply Filters
  │ ├ Module
  │ ├ Tags
  │ ├ Priority
  │ └ Type
  ├ Preview matching tests
  └ Create Suite
```

**Coexistence:**
- ✅ Both tabs in Test Suites page
- ✅ Both methods create identical TestSuite records
- ✅ No removal of existing functionality
- ✅ User chooses best method for their workflow

---

## UPDATED IMPLEMENTATION PLAN

### PHASE 1: Foundation (Week 1)

**Database:**
- ✅ Add TestCase fields: priority, testType, module, feature, lastUpdatedAt
- ✅ Add TestSuite.creationMethod field
- ✅ Create indexes: (projectId, priority), (projectId, testType), (projectId, tags)
- ✅ Database migration script

**Tags & Data Sync:**
- ✅ Data migration: Denormalize module/feature from RepositoryNode
- ✅ Data migration: Create Tag records from RoamTestCase.tags (flat, no hierarchy)
- ✅ Data migration: Create TagTestCase relationships
- ✅ Enhance Roam sync: Automatically create/update Tag records
- ✅ Ensure tag counts updated on every sync

**APIs - Test Cases Filtering:**
- ✅ GET /api/test-cases/search (filters: modules, testTypes, priorities, tags, search)
- ✅ GET /api/test-cases/filters (returns available options with counts)
- ✅ GET /api/test-cases/counts (returns summary counts)

**APIs - Suite Creation:**
- ✅ POST /api/test-suites/preview (preview matching tests before creation)
- ✅ POST /api/test-suites/from-filters (create suite from filters, snapshot)
- ✅ Enhance POST /api/test-suites (support both methods)

**Preset Suites:**
- ✅ Create API endpoint: GET /api/test-suites/presets
- ✅ Return preset definitions (Smoke, Happy Path, Regression, Sanity, Critical Regression)

**Testing:**
- ✅ API tests for all endpoints
- ✅ Data migration validation
- ✅ Tag sync verification
- ✅ Performance tests with 10,000 test cases

---

### PHASE 2: Test Cases UI (Week 2)

**Components:**
- ✅ TestCaseTable (columns: ID, Title, Module, Feature, Type, Priority, Tags, Last Updated)
- ✅ TestCaseFilters (sidebar: Module, Type, Priority, Tags, Search)
- ✅ TestCaseSummaryCards (Total, Manual, Automated, + counts by tag)
- ✅ Pagination component

**Features:**
- ✅ Multi-select filters with live count updates
- ✅ Search by ID, Title, Tag, Module
- ✅ Sortable columns
- ✅ Checkbox selection for bulk actions
- ✅ "Create Suite from Selected" action
- ✅ Responsive design (mobile-friendly)

**UI Layout:**
```
┌─ Summary Cards ────────────────────┐
│ Total: 98 | Manual: 98 | Auto: 52  │
│ HappyPath: 45 | Smoke: 32 | Reg... │
└────────────────────────────────────┘

┌─ Filters ────────────┐ ┌─ Table ──────────┐
│ Module               │ │ ID  Title Module │
│ □ Help (45)         │ │ TC-1 Login Help  │
│ □ Billing (32)      │ │ TC-2 Pay Billing │
│ □ Scheduling (21)   │ │ ...              │
│                     │ │ Page 1 of 5      │
│ Type               │ │                  │
│ ☑ Manual (98)      │ │                  │
│ ☐ Auto (52)        │ │                  │
│                     │ │                  │
│ Priority           │ │                  │
│ □ Critical (15)    │ │                  │
│ □ High (25)        │ │                  │
│ ☑ Medium (40)      │ │                  │
│ □ Low (18)         │ │                  │
│                     │ │                  │
│ Tags               │ │                  │
│ □ #HappyPath (45)  │ │                  │
│ □ #Smoke (32)      │ │                  │
│ □ #Regression (150)│ │                  │
│ □ #API (40)        │ │                  │
│                     │ │                  │
│ Search: [_______]   │ │                  │
└─────────────────────┘ └──────────────────┘
```

**User Interactions:**
- Click filter checkbox → table updates
- Adjust multiple filters → live count updates
- Type in search → highlights results
- Select tests with checkboxes → bulk actions appear
- Click column header → sort
- Pagination controls → load next page

---

### PHASE 3: Suite Creation - Filter Method (Week 3)

**Tab 1: Hierarchy-Based** (Keep Existing)
- Repository tree selection
- Works exactly as current implementation

**Tab 2: Filter-Based** (NEW)
```
Step 1: Select Filters
─────────────────────
Module:   [Help] [Billing]
Type:     [☑Manual] [☐Auto]
Priority: [☑Critical] [☑High]
Tags:     [☑#HappyPath] [☑#Smoke]

[Preview Tests] (shows matching count)

Step 2: Preview
──────────────
Matching Tests: 18
[View List]

Step 3: Enter Details
────────────────────
Suite Name:    [Help Happy Path Smoke Suite]
Description:   [Optional notes about suite]

Step 4: Create
──────────────
[Cancel] [Create Suite]

Success:
Suite created with 18 tests
View Suite Details
```

**Features:**
- ✅ Step-by-step workflow (clear UX)
- ✅ Live preview of matching tests
- ✅ Test count at each step
- ✅ Validation (suite name required, at least 1 filter)
- ✅ Preview shows full list of matching tests
- ✅ Success confirmation

**Preset Suites:**
- ✅ "Use Preset" button → Load preset filters
- ✅ Example: Click "Smoke Suite" → Presets filters
- ✅ User can modify preset before creating
- ✅ Save custom combinations as presets (future)

---

### PHASE 4: Enhancement & Optimization (Week 4)

**Quality of Life:**
- ✅ Copy existing suite with new filters
- ✅ Duplicate suite (same filters, new name)
- ✅ Export test cases to CSV
- ✅ Bulk tag tests from Test Cases
- ✅ Keyboard shortcuts (Ctrl+F search, etc.)

**Performance Optimization:**
- ✅ Lazy load filter options (only when filter clicked)
- ✅ Cache filter counts (refresh on sync)
- ✅ Optimize slow queries
- ✅ Load testing with 10,000+ tests
- ✅ CDN caching for static assets

**Admin Features:**
- ✅ Bulk update priority/testType
- ✅ Tag reconciliation with Roam
- ✅ View test case sync status
- ✅ Test case health check

**Documentation:**
- ✅ User guide: How to filter tests
- ✅ User guide: Create suites (both methods)
- ✅ API documentation
- ✅ Admin guide: Tag management
- ✅ FAQ: Common filter combinations

---

## ARCHITECTURE - FINALIZED

### Tag Strategy
```
Roam Source:
  #HappyPath
  #Smoke
  #Regression
  #API
  #Billing
  #Scheduling
  #Critical

Sync Process:
  Every 15 minutes OR on-demand
  → Create/update Tag records
  → Link TestCase → Tag (TagTestCase)
  → Update counts

QA Ops Usage:
  Filter by tag (multi-select)
  Create suites with tag filters
  Save tag combinations as presets
```

### Suite Creation Process

**Method 1 (Hierarchy):**
```
Repository Module
  ↓ Select hierarchy nodes
  ↓ Click "Create Suite"
  ↓ Enter name/description
  → Suite created (snapshot of selected tests)
```

**Method 2 (Filters):**
```
Test Cases Module
  ↓ Select filters (module, tags, priority, type)
  ↓ Preview matching tests
  ↓ Enter name/description
  → Suite created (snapshot of filtered tests)
```

**Result:** Both create identical TestSuite records
- creationMethod = "HIERARCHY" or "FILTER"
- selectionConfig = {nodeIds: [...]} or {modules: [...], tags: [...], ...}
- testCases = snapshot of matched tests at creation time

### Performance Architecture

**Database Indexes:**
```sql
TestCase:
  @@index([projectId, priority])
  @@index([projectId, testType])
  @@index([projectId, module])
  @@index([projectId, feature])
  @@index([projectId, lastUpdatedAt])

TagTestCase:
  @@index([tagId, projectId])
  @@index([testCaseId, projectId])

Tag:
  @@index([projectId, name])
```

**API Optimization:**
- Paginated responses (50/100 tests per page)
- Lazy load filter options (only on demand)
- Cache filter counts (update on sync)
- Connection pooling (Prisma)
- Query timeouts (2 seconds max)

**Frontend Optimization:**
- Virtual scrolling for large lists
- Lazy load filter lists
- Debounced search (300ms)
- Memoized filter components

---

## MIGRATION PLAN - DETAILED

### Step 1: Add Database Fields
```sql
ALTER TABLE TestCase ADD priority TestCasePriority DEFAULT 'MEDIUM';
ALTER TABLE TestCase ADD testType VARCHAR(255) DEFAULT 'MANUAL';
ALTER TABLE TestCase ADD module VARCHAR(255);
ALTER TABLE TestCase ADD feature VARCHAR(255);
ALTER TABLE TestCase ADD lastUpdatedAt TIMESTAMP DEFAULT NOW();

ALTER TABLE TestSuite ADD creationMethod VARCHAR(255) DEFAULT 'HIERARCHY';

-- Indexes for performance
CREATE INDEX idx_testcase_priority ON TestCase(projectId, priority);
CREATE INDEX idx_testcase_type ON TestCase(projectId, testType);
CREATE INDEX idx_testcase_module ON TestCase(projectId, module);
CREATE INDEX idx_testcase_feature ON TestCase(projectId, feature);
CREATE INDEX idx_tag_testcase ON TagTestCase(projectId);
```

### Step 2: Denormalize Module & Feature
```sql
-- Extract module from hierarchy
UPDATE TestCase t
SET module = (
  SELECT rn.name FROM RepositoryNode rn
  INNER JOIN TestCaseNode tcn ON rn.id = tcn.nodeId
  WHERE tcn.testCaseId = t.id
  AND rn.type = 'MODULE'
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM TestCaseNode tcn
  WHERE tcn.testCaseId = t.id
);

-- Extract feature similarly
UPDATE TestCase t
SET feature = (
  SELECT rn.name FROM RepositoryNode rn
  INNER JOIN TestCaseNode tcn ON rn.id = tcn.nodeId
  WHERE tcn.testCaseId = t.id
  AND rn.type = 'FEATURE'
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM TestCaseNode tcn
  WHERE tcn.testCaseId = t.id
);
```

### Step 3: Extract Test Type & Priority
```sql
-- Extract test type from tags (automated if contains "Automated")
UPDATE TestCase t
SET testType = CASE
  WHEN EXISTS (
    SELECT 1 FROM RoamTestCase rtc
    WHERE rtc.projectId = t.projectId
    AND 'Automated' = ANY(rtc.tags)
  )
  THEN 'AUTOMATED'
  ELSE 'MANUAL'
END;

-- Priority remains default (MEDIUM) unless customized later
```

### Step 4: Create Tag Records
```sql
-- Create unique tags from all RoamTestCase records (FLAT - no hierarchy)
INSERT INTO Tag (projectId, name, color)
SELECT DISTINCT p.id, unnest(rtc.tags), '#6366f1'
FROM RoamTestCase rtc
JOIN Project p ON p.id = rtc.projectId
WHERE unnest(rtc.tags) IS NOT NULL
  AND unnest(rtc.tags) NOT IN (SELECT name FROM Tag WHERE projectId = p.id)
ON CONFLICT (projectId, name) DO NOTHING;
```

### Step 5: Create TagTestCase Relationships
```sql
-- Link test cases to tags
INSERT INTO TagTestCase (tagId, testCaseId)
SELECT t.id, tc.id
FROM RoamTestCase rtc
JOIN TestCase tc ON tc.projectId = rtc.projectId
JOIN Tag t ON t.projectId = rtc.projectId
WHERE t.name = ANY(rtc.tags)
  AND NOT EXISTS (
    SELECT 1 FROM TagTestCase
    WHERE tagId = t.id AND testCaseId = tc.id
  );
```

### Step 6: Verification
```sql
-- Verify migrations
SELECT COUNT(*) as total, 
       COUNT(CASE WHEN priority IS NOT NULL THEN 1 END) as with_priority,
       COUNT(CASE WHEN testType IS NOT NULL THEN 1 END) as with_type,
       COUNT(CASE WHEN module IS NOT NULL THEN 1 END) as with_module
FROM TestCase;

-- Verify tags created
SELECT COUNT(*) as tag_count FROM Tag;

-- Verify relationships
SELECT COUNT(*) as tag_relationship_count FROM TagTestCase;
```

---

## SUCCESS CRITERIA - DETAILED

### Phase 1 Completion ✅
- [ ] All database migrations complete without errors
- [ ] 100% data integrity (no lost records)
- [ ] All 6 new API endpoints tested and working
- [ ] Tag sync working (Roam → QA Ops)
- [ ] Indexes created and optimized
- [ ] Performance testing passed (10,000 tests < 500ms)
- [ ] Zero breaking changes to existing functionality

### Phase 2 Completion ✅
- [ ] Test Cases page loads in < 1 second
- [ ] All 4 filter types working independently
- [ ] Multi-filter combinations work correctly
- [ ] Search finds tests by ID, title, tag, module
- [ ] Summary cards show correct counts
- [ ] Pagination works (50/100 tests per page)
- [ ] Checkbox selection enables bulk actions
- [ ] Sort works on all columns
- [ ] Mobile-responsive design verified

### Phase 3 Completion ✅
- [ ] Both suite creation methods work
- [ ] Hierarchy method: existing functionality preserved
- [ ] Filter method: end-to-end workflow complete
- [ ] Preview shows correct test count
- [ ] Created suite has correct test associations
- [ ] Preset suites load correctly
- [ ] Suite name validation working
- [ ] No duplicate suite creation allowed

### Phase 4 Completion ✅
- [ ] Performance targets met (< 500ms filters)
- [ ] Load test with 10,000+ tests passed
- [ ] Bulk operations working (tag, update)
- [ ] Export to CSV working
- [ ] Admin features complete
- [ ] Documentation complete and accurate
- [ ] User guide reviewed and approved

---

## ROLLBACK PLAN

If critical issues arise:

**Phase 1:**
- Rollback migration
- Keep old APIs available during transition
- Test Suites continue with hierarchy method only

**Phase 2:**
- Revert Test Cases to old tree view (HierarchicalTestCaseTree)
- Keep new search APIs available
- No data loss

**Phase 3:**
- Hide filter-based suite tab
- Keep hierarchy tab active
- No suite data loss

**Phase 4:**
- Disable new features one by one
- Keep core functionality stable

---

## TIMELINE

```
Week 1 (Jun 23-29):    Phase 1 - Database & APIs
Week 2 (Jun 30-Jul 6): Phase 2 - Test Cases UI
Week 3 (Jul 7-13):     Phase 3 - Filter Suite Creation
Week 4 (Jul 14-20):    Phase 4 - Optimization & Polish

Parallel:
- Testing after each phase
- Documentation updates
- Performance monitoring
```

---

## STAKEHOLDER SIGN-OFF

✅ **QA Ops Stakeholder:** Approved
✅ **Data Architecture:** Approved (flat tags, snapshot suites)
✅ **UI/UX:** Approved (both methods coexist)
✅ **Performance:** Targets confirmed (< 500ms, 10,000+ tests)
✅ **Roam Integration:** Auto-mirror tags approved

---

## APPROVAL TO PROCEED

**Status:** ✅ READY TO IMPLEMENT PHASE 1

**Next Step:** Execute Phase 1 (Database & APIs)
- Database migration scripts
- New API endpoints
- Roam tag sync enhancement
- Performance baseline testing

**Approval Date:** 2026-06-23
**Implementation Start:** 2026-06-23

