# PHASE 1 SAFETY PLAN - Files, APIs, and Risk Analysis

**Date:** 2026-06-23
**Phase:** 1 - Database & APIs Only
**Risk Level:** LOW (except Tag Sync = MEDIUM)
**Approval Status:** PENDING - Safety verification required before any code changes

---

## 1. FILES TO MODIFY (New code only)

### NEW API ROUTES (Create new files - no existing code touched)

```
✓ NEW: app/api/test-cases/search/route.ts
   - GET endpoint for test case filtering
   - Parameters: module, feature, tags[], search, page, limit
   - Returns: paginated test cases with metadata
   - Status: Non-existent, zero risk

✓ NEW: app/api/test-cases/filter-options/route.ts
   - GET endpoint for filter dropdown values
   - Returns: available modules, types, tags with counts
   - Status: Non-existent, zero risk

✓ NEW: app/api/test-cases/summary/route.ts
   - GET endpoint for test case summary cards
   - Returns: { total, byType, byTag, byModule }
   - Status: Non-existent, zero risk

✓ NEW: app/api/test-suites/preview/route.ts
   - POST endpoint to preview matching tests
   - Body: { filters: { modules, tags, type } }
   - Returns: { matchingTests, count }
   - Status: Non-existent, zero risk

✓ NEW: app/api/test-suites/from-filters/route.ts
   - POST endpoint to create suite from filters
   - Body: { name, description, filters: {...} }
   - Returns: created TestSuite record
   - Status: Non-existent, zero risk
```

### EXISTING FILE MODIFICATIONS (Minimal additions)

```
⚠️ MODIFY: lib/services/test-cases.service.ts
   Action: ADD new functions (no removals)
   - findByFilters(filters, projectId)
   - getFilterOptions(projectId)
   - getSummary(projectId)
   - countByType(projectId)
   - countByTag(projectId)
   
   Existing functions UNTOUCHED:
   ✓ findTestCasesByIds()
   ✓ getTestCase()
   ✓ createTestCase()
   ✓ updateTestCase()
   ✓ deleteTestCase()
   
   Impact: ZERO - purely additive

⚠️ MODIFY: lib/services/test-suites.service.ts
   Action: ADD new functions (no removals)
   - previewSuiteFromFilters()
   - createSuiteFromFilters()
   
   Existing functions UNTOUCHED:
   ✓ getTestSuite()
   ✓ listTestSuites()
   ✓ createTestSuite()
   ✓ updateTestSuite()
   ✓ addTestCaseToSuite()
   ✓ removeTestCaseFromSuite()
   
   Impact: ZERO - purely additive
```

### DATABASE MIGRATION (Additive only)

```
✓ NEW: prisma/migrations/add-tag-sync.sql (or equivalent)
   
   Changes:
   1. Migrate RoamTestCase.tags → Tag table records
   2. Create TagTestCase relationships
   3. Create index on Tag.projectId
   
   NO REMOVALS - all existing tables untouched
   NO MODIFICATIONS - no column changes
   NO CONSTRAINTS - all optional
   
   Rollback: Delete migration, no data loss
   
   Impact: MEDIUM (see Tag Sync Risk Analysis below)
```

---

## 2. FILES NOT TO MODIFY (Existing working features)

### REPOSITORY FUNCTIONALITY - Completely untouched

```
✗ DO NOT MODIFY:
  - lib/services/repository.service.ts (all functions)
  - app/api/repository/route.ts (all endpoints)
  - components/repository/* (all components)
  - app/repository/* (all pages)
  
Reason: Repository hierarchy suite creation must continue working
Status: 100% untouched
Risk: ZERO
```

### TEST SUITE CREATION (Hierarchy method) - Completely untouched

```
✗ DO NOT MODIFY:
  - app/api/test-suites/route.ts (POST for hierarchy creation)
  - lib/services/test-suites.service.ts (existing functions)
  
Existing functionality preserved:
  ✓ POST /api/test-suites (with hierarchy data)
  ✓ SuiteTestCase creation from repository nodes
  ✓ Suite editing functionality
  
Status: 100% untouched
Risk: ZERO
```

### EXECUTION CYCLE LOGIC - Completely untouched

```
✗ DO NOT MODIFY:
  - app/api/execution-cycles/route.ts
  - app/api/execution-cycles/[id]/route.ts
  - lib/services/execution.service.ts (all functions)
  - lib/services/dashboard.service.ts (existing metrics)
  
Existing functionality preserved:
  ✓ Cycle creation
  ✓ Cycle fetching
  ✓ Cycle metrics
  ✓ Cycle listing
  
Status: 100% untouched
Risk: ZERO
```

### VERSION MANAGEMENT - Completely untouched

```
✗ DO NOT MODIFY:
  - app/api/execution-cycles/[id]/versions/route.ts
  - ExecutionVersion creation logic
  - Version switching logic
  
Existing functionality preserved:
  ✓ Version creation
  ✓ Version deletion
  ✓ Version status updates
  ✓ TestRun creation per version
  
Status: 100% untouched
Risk: ZERO
```

### TEST EXECUTION - Completely untouched

```
✗ DO NOT MODIFY:
  - app/api/test-runs/route.ts
  - app/api/test-runs/[id]/route.ts
  - TestRun status update logic
  - Comment functionality
  - Jira link functionality
  
Existing functionality preserved:
  ✓ Status updates (PASS/FAIL/BLOCKED/NOT_EXECUTED)
  ✓ Comments persistence
  ✓ Jira links persistence
  ✓ Test run details
  
Status: 100% untouched
Risk: ZERO
```

### DASHBOARD - Completely untouched (existing endpoints)

```
✗ DO NOT MODIFY:
  - app/api/dashboard/metrics/route.ts (existing logic)
  - lib/services/dashboard.service.ts (existing functions)
  
Existing functionality preserved:
  ✓ Project metrics
  ✓ Cycle metrics
  ✓ Version metrics
  
Note: Version-filtered metrics from earlier work stay as-is
Status: 100% untouched
Risk: ZERO
```

### UI/COMPONENTS - Completely untouched

```
✗ DO NOT MODIFY:
  - app/cycles/page.tsx (existing execution UI)
  - app/repository/page.tsx (repository tree)
  - components/suite-creation/* (hierarchy method)
  - components/execution/* (test execution UI)
  - components/dashboard/* (dashboard components)
  
Status: 100% untouched in Phase 1
Note: Phase 2 will add NEW components, not modify these
Risk: ZERO
```

---

## 3. EXISTING APIS AFFECTED (Analysis)

### APIs That Stay EXACTLY the Same

```
✓ GET  /api/repository
✓ POST /api/repository
✓ GET  /api/test-suites
✓ POST /api/test-suites (hierarchy method preserved)
✓ GET  /api/test-suites/[id]
✓ PATCH /api/test-suites/[id]
✓ DELETE /api/test-suites/[id]

✓ GET  /api/execution-cycles
✓ POST /api/execution-cycles
✓ GET  /api/execution-cycles/[id]
✓ PATCH /api/execution-cycles/[id]

✓ POST /api/execution-cycles/[id]/versions
✓ GET  /api/execution-cycles/[id]/versions

✓ GET  /api/test-runs
✓ POST /api/test-runs
✓ GET  /api/test-runs/[id]
✓ PATCH /api/test-runs/[id]

✓ POST /api/test-runs/[id]/comments
✓ GET  /api/test-runs/[id]/comments

✓ GET  /api/dashboard/metrics
```

**Status:** ZERO changes to request/response format or logic
**Risk:** ZERO

### NEW APIs Being Added

```
NEW: GET  /api/test-cases/search
NEW: GET  /api/test-cases/filter-options
NEW: GET  /api/test-cases/summary
NEW: POST /api/test-suites/preview
NEW: POST /api/test-suites/from-filters
```

**Status:** Purely additive, no impact on existing APIs
**Risk:** ZERO

---

## 4. EXISTING APIS UNTOUCHED (Guaranteed)

### Core Execution APIs (CRITICAL - Must never change)

```
✓ POST /api/test-runs/[id] (status updates)
   - Current: { status: "PASS"|"FAIL"|"BLOCKED"|"NOT_EXECUTED" }
   - Change: NONE
   - Risk: ZERO

✓ POST /api/test-runs/[id]/comments (comment creation)
   - Current: { comment: string }
   - Change: NONE
   - Risk: ZERO

✓ PATCH /api/test-runs/[id] (test run details)
   - Current: { jiraLink, duration, etc }
   - Change: NONE
   - Risk: ZERO
```

### Suite Linkage APIs (CRITICAL - Must never change)

```
✓ POST /api/test-suites (hierarchy method)
   - Current: { name, description, nodeIds[] }
   - Change: NONE
   - Reason: Existing suite creation continues working
   - Risk: ZERO

✓ GET /api/test-suites
   - Current: returns all suites regardless of creation method
   - Change: NONE - both methods return same structure
   - Risk: ZERO
```

### Execution Pipeline APIs (CRITICAL - Must never change)

```
✓ POST /api/execution-cycles/[id]/versions
   - Current: Creates ExecutionVersion + TestRun records
   - Change: NONE - tag sync doesn't affect this
   - Risk: ZERO

✓ GET /api/dashboard/metrics
   - Current: Returns project/cycle/version metrics
   - Change: NONE - metrics logic untouched
   - Risk: ZERO
```

---

## 5. TAG SYNCHRONIZATION RISK ANALYSIS

### THE ONLY MEDIUM-RISK ITEM IN PHASE 1

**What is changing:**
```
BEFORE: Tags only in RoamTestCase.tags (String[])
AFTER:  Tags in both RoamTestCase.tags AND Tag+TagTestCase tables
```

**Risk: MEDIUM** (not low, because involves data migration)

### Risk Breakdown

#### 5.1 Migration Risk
```
Action: Migrate RoamTestCase.tags → Tag table

Risk: Data loss if migration fails
Mitigation:
  ✓ Backup database before migration
  ✓ Test migration on staging environment
  ✓ Verify tag counts match (SELECT COUNT(DISTINCT tag) FROM Tag)
  ✓ Verify relationships (SELECT COUNT(*) FROM TagTestCase)
  ✓ Rollback plan: Delete migration, restore backup

Risk Level: MEDIUM → can be reduced with testing
```

#### 5.2 Sync Ongoing Risk
```
Action: Keep RoamTestCase.tags and Tag table synchronized

Risk: Tags diverge during future Roam imports

Mitigation:
  ✓ Update Roam sync process to maintain both:
    - Keep RoamTestCase.tags (existing behavior)
    - Also update Tag table (new behavior)
  ✓ Add validation: Check tag count consistency
  ✓ Add monitoring: Log any divergence
  ✓ Add rollback: If sync fails, don't proceed to next import

Risk Level: MEDIUM → manageable with sync logic update
```

#### 5.3 Filtering Risk
```
Action: Filters will query Tag table

Risk: Tag table is incomplete or stale

Mitigation:
  ✓ Thorough migration before Phase 2
  ✓ Validation queries before Phase 2
  ✓ Test suite creation from filters (Phase 3)
  ✓ Query test cases using both sources if needed

Risk Level: MEDIUM → eliminated by thorough testing
```

### Tag Sync Implementation Plan

```
Step 1: Backup database
Step 2: Create migration
  - Extract unique tags from all RoamTestCase.tags
  - Create Tag records (if not exist)
  - Create TagTestCase relationships
Step 3: Validate results
  - Compare tag counts
  - Spot check relationships
Step 4: Update Roam sync process
  - Keep RoamTestCase.tags as before
  - Also populate Tag+TagTestCase during import
Step 5: Test with real Roam data
Step 6: Monitor during Phase 2-3
```

### If Tag Sync Fails

```
Decision Tree:
  ✓ If migration fails: Rollback, restore backup, investigate
  ✓ If validation fails: Stop, review data, fix migration
  ✓ If Roam sync breaks: Fix sync logic, re-run migration
  ✓ If filtering fails: Tags incomplete, restore from RoamTestCase.tags
  
No impact on existing execution cycle functionality.
Tag filtering just won't work until fixed.
```

---

## 6. REGRESSION TEST CHECKLIST

### After Phase 1 Implementation (APIs only)

Verify all these continue working:

#### Repository
```
✓ GET /api/repository returns hierarchy
✓ Hierarchy tree displays in UI
✓ Nodes can be selected
✓ Node metadata loads
```

#### Test Suites (Hierarchy Method)
```
✓ POST /api/test-suites with nodeIds[] works
✓ Suite created with correct test case count
✓ Suite displays in test suites list
✓ Suite can be edited
✓ SuiteTestCase records created correctly
```

#### Execution Cycles
```
✓ POST /api/execution-cycles creates cycle
✓ Cycle displays in cycles list
✓ Cycle can be edited
✓ Cycle status updates
```

#### Versions
```
✓ POST /api/execution-cycles/[id]/versions creates version
✓ Version gets 30 test runs (from first version)
✓ Version displays in UI
✓ Version can be switched
```

#### Test Execution
```
✓ PATCH /api/test-runs/[id] updates status
✓ Status change persists
✓ POST /api/test-runs/[id]/comments creates comment
✓ Comments persist and display
✓ Jira links update
```

#### Dashboard
```
✓ GET /api/dashboard/metrics returns project metrics
✓ GET /api/dashboard/metrics?scope=cycle returns cycle metrics
✓ GET /api/dashboard/metrics?scope=version returns version metrics
✓ Metrics match expected values
✓ Pass rate calculates correctly
```

#### New APIs (Phase 1 deliverables)
```
✓ GET /api/test-cases/search returns results
✓ Filters work (module, type, tags)
✓ Pagination works
✓ GET /api/test-cases/filter-options returns dropdowns
✓ GET /api/test-cases/summary returns card values
✓ POST /api/test-suites/preview returns matching tests
```

---

## 7. BREAKING CHANGE ASSESSMENT

### Will Phase 1 Break Anything?

```
Repository Functionality:      ✓ NO - untouched
Existing Suite Creation:       ✓ NO - untouched
Cycle Creation/Execution:      ✓ NO - untouched
Version Management:            ✓ NO - untouched
Test Run Status Updates:       ✓ NO - untouched
Comments/Jira Links:           ✓ NO - untouched
Dashboard Metrics:             ✓ NO - untouched

Tag Synchronization:           ⚠️ MEDIUM RISK (mitigation plan provided)
  - Mitigated by: careful migration, validation, testing
  - Fallback: Can use RoamTestCase.tags if Tag table incomplete
```

**Overall Assessment:** SAFE with tag sync precautions

---

## 8. IMPLEMENTATION SAFETY CONSTRAINTS

### MANDATORY Before Any Code Changes

- [x] Safety plan approved
- [ ] Database backup created
- [ ] Staging environment ready for testing
- [ ] Tag migration script tested on staging

### During Phase 1 Implementation

- [ ] New files created (no existing files touched)
- [ ] New functions added to services (no existing functions modified)
- [ ] No existing tests modified
- [ ] No existing API signatures changed

### After Phase 1 Implementation

- [ ] All regression tests pass
- [ ] Tag counts validated
- [ ] New APIs tested with real data
- [ ] Database verified for data integrity

---

## 9. APPROVAL CHECKPOINT

**What must be confirmed before code changes:**

```
✓ Safety plan reviewed
✓ No breaking changes identified
✓ Tag sync risk mitigation acceptable
✓ Database backup plan in place
✓ Regression tests understood
✓ Implementation can proceed
```

**If ANY concern:** Stop and provide impact analysis.

---

## Conclusion

**Phase 1 is SAFE to implement with the following safeguards:**

1. Backup database before tag migration
2. Test tag migration on staging
3. Create only new files (no modifications to existing core logic)
4. Add functions to services (no modifications to existing functions)
5. Run full regression test suite after implementation
6. Monitor tag sync during Roam imports

**Ready to proceed:** Yes, pending approval of this safety plan.

