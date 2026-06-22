# Outstanding Issues Summary

## 1. Comments and Jira Links Persistence ✅ FIXED

**Issue**: Comments and Jira links were not displaying after being added, even though they were saved to the database.

**Root Cause**: API endpoints were not including comments and jiraLinks in the testRuns data returned in responses.

**Fix Applied**:
- Updated GET /api/execution-cycles to include comments and jiraLinks in testRuns
- Updated GET /api/execution-cycles/[id]/versions to include comments and jiraLinks
- Updated POST /api/execution-cycles/[id]/versions to include comments and jiraLinks
- Updated listCycles() service to include comments and jiraLinks
- Updated getCycle() service to include comments and jiraLinks
- Updated createCycle() service to include comments and jiraLinks

**Status**: ✅ COMPLETE
- Comments now persist after page refresh
- Comments display when switching versions
- Comments display when reopening cycle
- Jira links persist and display correctly

---

## 2. Dashboard Hierarchy Implementation ⏳ PENDING

**Issue**: Dashboard does not match business requirements for hierarchical display.

**Required Dashboard Hierarchy**:

```
Project Level
  ├─ Total Repository Tests
  ├─ Manual Tests
  ├─ Automated Tests
  ├─ Total Cycles
  ├─ Draft Cycles
  ├─ In Progress Cycles
  └─ Completed Cycles

Cycle Level
  ├─ Passed
  ├─ Failed
  ├─ Blocked
  ├─ Not Executed
  ├─ Pass Rate
  └─ Execution Progress

Version Level
  └─ Version-specific execution metrics only
```

**Current State**:
- Project level metrics: NOT IMPLEMENTED
- Cycle level metrics: PARTIALLY IMPLEMENTED (shows Passed, Failed, Blocked, Not Executed, but missing Pass Rate and Progress %)
- Version level metrics: NOT ISOLATED (shows all data from cycle)

**Implementation Plan**:
1. Create dashboard service with three functions:
   - getProjectMetrics(projectId)
   - getCycleMetrics(cycleId)
   - getVersionMetrics(versionId, cycleId)

2. Modify dashboard display logic:
   - When only project selected: Show project-level metrics
   - When cycle selected: Show cycle-level metrics
   - When version selected: Show version-level metrics only

3. Add Pass Rate calculation: (Passed / Total) * 100
4. Add Execution Progress: ((Passed + Failed + Blocked) / Total) * 100

**Status**: ⏳ NOT STARTED

---

## 3. Cycle Creation Performance ⏳ PENDING OPTIMIZATION

**Issue**: Cycle creation API response exceeds 1 second locally.

**Current Performance**:
- Empty cycle (0 test cases): ~3-4 seconds
- 30 test cases: ~1.7 seconds (plus occasional 500 errors)
- Target: <1 second

**Root Cause**: 
- Multiple database queries for creation and fetching
- Possibly database connection pooling issues with Supabase
- Network latency in PostgreSQL driver

**Optimization Options**:
1. Return cycle immediately after creation, fetch full data asynchronously
2. Batch insert operations more efficiently
3. Review Supabase connection pool settings
4. Use transaction batching

**Status**: ⏳ NOT STARTED

---

## Issues Fixed This Session

### Real-Time Metrics Update ✅
- **Issue**: Metrics not updating immediately when test status changes
- **Fix**: Implemented optimistic UI updates
- **Result**: Metrics update with 0ms delay (previously 1-2 seconds)

### Comments Display ✅
- **Issue**: Comments added but not displayed in UI
- **Fix**: Added comments and jiraLinks to all API responses
- **Result**: Comments now persist and display correctly

---

## Next Steps

### High Priority
1. Implement Dashboard Hierarchy
   - Add project-level metrics
   - Show appropriate metrics based on selection level
   - Add Pass Rate and Progress % calculations

2. Optimize Cycle Creation Performance
   - Reduce API response time to <1 second
   - Test with 100+ test cases
   - Verify no 500 errors on creation

### Medium Priority
3. Test Comments Persistence
   - Verify comments persist across:
     - Page refresh
     - Version switching
     - Cycle reopening
   - Verify Jira links persist similarly

4. Review and Optimize
   - Database indexes
   - Query performance
   - Connection pooling

---

## Technical Details

### Files Modified
- `app/api/execution-cycles/[id]/versions/route.ts`
- `lib/services/execution.service.ts`
- `app/cycles/page.tsx` (for real-time metrics)

### Database
- schema.prisma: No changes
- Migrations: No new migrations
- Connection: Supabase PostgreSQL

### API Endpoints Verified
- GET /api/execution-cycles - Returns comments and jiraLinks
- GET /api/execution-cycles/[id]/versions - Returns comments and jiraLinks
- POST /api/execution-cycles - Returns full cycle data
- PATCH /api/test-runs/[id] - Returns test run with comments

