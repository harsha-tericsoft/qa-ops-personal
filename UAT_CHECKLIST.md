# User Acceptance Testing (UAT) Checklist
## Roam QC Dashboard - Production Verification

**Project**: Kinergy QA  
**Environment**: Staging (pre-production)  
**Date**: ________________  
**Tester**: ________________  

---

## Pre-UAT Prerequisites

Before starting UAT, verify:

- [ ] Application deployed to staging environment
- [ ] Database migrated with clean data (orphaned nodes removed)
- [ ] Roam API credentials configured in environment
- [ ] Test Roam repository available with known test structure
- [ ] Network connectivity to Roam API verified
- [ ] Database connection pool healthy
- [ ] Application logs accessible for debugging

**Sign-off**: All prerequisites met ☐

---

## UAT Test Case 1: Initial Repository Sync

**Objective**: Verify that a fresh Roam repository can be imported with 100% accuracy.

**Precondition**: Database has no existing nodes for test repository

**Steps**:
1. [ ] Open dashboard Settings → Roam Configuration
2. [ ] Enter test Roam repository details:
   - Graph Name: `Project_Kinergy`
   - Root Page: `TestSuite : Kinergy`
   - API Token: [configured]
3. [ ] Click "Test Connection"
4. [ ] Verify message: "✓ Connected to Roam"
5. [ ] Click "Sync Now" to start initial sync
6. [ ] Monitor progress:
   - [ ] "Connecting to Roam..." appears
   - [ ] "Fetching repository..." shows progress
   - [ ] "Importing nodes..." shows count increasing
   - [ ] "Extracting test cases..." appears
   - [ ] Final message: "Sync complete: X nodes imported, Y test cases created"
7. [ ] Wait for completion (expected: 2-5 minutes)

**Verification**:
- [ ] No errors in sync log
- [ ] Node count matches expected (should match Roam structure)
- [ ] Test case count > 0 (at least 100+)
- [ ] Dashboard automatically refreshes with metrics
- [ ] All nodes visible in Repository tree view

**Expected Result**: ✅ PASS  
**Actual Result**: ☐ PASS ☐ FAIL  
**Issues**: _______________________________________________

**Sign-off**: Tester initials _______ Date _______

---

## UAT Test Case 2: Dashboard Metrics Accuracy

**Objective**: Verify all dashboard metrics are accurate and derived from database.

**Precondition**: Repository successfully imported (Test Case 1 passed)

**Steps**:
1. [ ] Open Dashboard tab
2. [ ] View metrics display:
   - [ ] Total Tests count visible
   - [ ] Status breakdown visible (PASSED/FAILED/BLOCKED/NOT_RUN)
   - [ ] Pass Rate visible
   - [ ] Execution Rate visible
3. [ ] Manually verify counts against database:
   ```sql
   SELECT COUNT(*) FROM "RoamTestCase" 
   WHERE projectId = '[project-id]';
   ```
4. [ ] Compare displayed vs. database counts
5. [ ] Check each status metric:
   - [ ] Passed count: Database matches displayed
   - [ ] Failed count: Database matches displayed
   - [ ] Blocked count: Database matches displayed
   - [ ] Not Run count: Database matches displayed
6. [ ] Verify percentages:
   - [ ] Pass Rate = (Passed / Executed) * 100
   - [ ] Execution Rate = (Executed / Total) * 100
7. [ ] Refresh page and confirm metrics persist

**Expected Result**: ✅ All metrics accurate to database  
**Actual Result**: ☐ PASS ☐ FAIL  
**Discrepancies**: _______________________________________________

**Sign-off**: Tester initials _______ Date _______

---

## UAT Test Case 3: Repository Tree Rendering

**Objective**: Verify complete repository hierarchy renders correctly with no orphaned nodes.

**Precondition**: Repository imported (Test Case 1 passed)

**Steps**:
1. [ ] Open Repository tab
2. [ ] Expand root node
   - [ ] Root node visible and named correctly
   - [ ] No error messages
3. [ ] Expand depth-1 children
   - [ ] All children visible under root
   - [ ] Parent-child relationship clear
   - [ ] Indentation shows hierarchy
4. [ ] Expand depth-2, depth-3... up to depth-5
   - [ ] All nodes at each level visible
   - [ ] No "orphaned" nodes outside hierarchy
   - [ ] No duplicate nodes
5. [ ] Click on random test node
   - [ ] Node details display
   - [ ] Parent link clickable
   - [ ] Status and priority visible (if applicable)
6. [ ] Search for specific test (if search available)
   - [ ] Test found in tree
   - [ ] Tree scrolls to show it
7. [ ] Verify no console errors in browser DevTools

**Performance Check**:
- [ ] Tree renders in < 2 seconds
- [ ] Expanding nodes is responsive (< 500ms)
- [ ] No lag when scrolling

**Expected Result**: ✅ Complete tree with no orphans  
**Actual Result**: ☐ PASS ☐ FAIL  
**Issues**: _______________________________________________

**Sign-off**: Tester initials _______ Date _______

---

## UAT Test Case 4: Refresh Sync (With Roam Access)

**Objective**: Verify refresh sync detects and updates changed content.

**Precondition**: Repository imported + Roam repository accessible

**Steps**:
1. [ ] In Roam: Modify a known test node
   - [ ] Change title to something distinctive
   - [ ] OR add a new tag
   - [ ] Note the change for verification
2. [ ] Return to Dashboard
3. [ ] Click "Refresh Sync"
4. [ ] Monitor sync progress:
   - [ ] "Fetching repository..." appears
   - [ ] "Comparing with existing..." shows
   - [ ] "Updating changed nodes..." appears
5. [ ] Wait for completion (expected: 30-60 seconds)
6. [ ] Dashboard refreshes with updated data

**Verification**:
- [ ] Modified node name reflects change in Repository tree
- [ ] If tag was added: Test case status reflects new tag (if applicable)
- [ ] Dashboard metrics update if status changed
- [ ] No duplicate nodes created
- [ ] Original nodes not deleted unless removed in Roam

**Expected Result**: ✅ Changes from Roam reflected in dashboard  
**Actual Result**: ☐ PASS ☐ FAIL  
**Issues**: _______________________________________________

**Sign-off**: Tester initials _______ Date _______

---

## UAT Test Case 5: Scheduled Sync Operations

**Objective**: Verify automatic sync runs every 5 minutes without manual intervention.

**Precondition**: Application deployed + Roam configured

**Steps**:
1. [ ] View System Status → Sync History
2. [ ] Note current timestamp
3. [ ] Wait 6 minutes (to ensure sync window)
4. [ ] Refresh page
5. [ ] Verify new sync entry in history:
   - [ ] Timestamp: Current time (within 1 minute)
   - [ ] Action: REFRESH_SYNC
   - [ ] Status: SUCCESS or PARTIAL
   - [ ] Duration: < 10 seconds
6. [ ] Wait 10 more minutes
7. [ ] Refresh and verify additional sync entries:
   - [ ] New entry at 6-minute mark
   - [ ] New entry at 12-minute mark
8. [ ] Monitor for errors:
   - [ ] No "FAILED" entries
   - [ ] No error messages in log

**Performance Check**:
- [ ] Sync completes within 10 seconds
- [ ] Dashboard remains responsive during sync
- [ ] Metrics update automatically post-sync
- [ ] No notification spam to users

**Expected Result**: ✅ Sync runs every 5 minutes automatically  
**Actual Result**: ☐ PASS ☐ FAIL  
**Issues**: _______________________________________________

**Sign-off**: Tester initials _______ Date _______

---

## UAT Test Case 6: Performance Under Load

**Objective**: Verify dashboard remains responsive with multiple users.

**Precondition**: Dashboard with test data loaded

**Steps**:
1. [ ] Simulate 5 concurrent users:
   - [ ] Open dashboard in 5 browser windows
   - [ ] Stagger page loads (2 seconds apart)
2. [ ] Measure load time:
   - [ ] First user: _____ ms
   - [ ] Second user: _____ ms
   - [ ] Third user: _____ ms
   - [ ] Fourth user: _____ ms
   - [ ] Fifth user: _____ ms
   - [ ] Average: _____ ms
3. [ ] Measure API response times:
   ```
   Dashboard Summary: _____ ms (target: < 500ms)
   Repository Tree: _____ ms (target: < 500ms)
   Sync Status: _____ ms (target: < 200ms)
   ```
4. [ ] Verify all pages loaded correctly
   - [ ] No 502/503 errors
   - [ ] All metrics visible
   - [ ] Tree fully rendered

**Expected Result**: ✅ Average load time < 2 seconds  
**Actual Result**: ☐ PASS ☐ FAIL  
**Performance Issues**: _______________________________________________

**Sign-off**: Tester initials _______ Date _______

---

## UAT Test Case 7: Error Handling

**Objective**: Verify application handles errors gracefully.

**Precondition**: Application deployed

**Steps**:

### 7a: Invalid Roam Credentials
1. [ ] Configure with wrong API token
2. [ ] Click "Test Connection"
3. [ ] Verify message: Error explaining invalid token
4. [ ] No crash or 500 error
5. [ ] User can correct and retry

### 7b: Network Unavailable
1. [ ] Disable network (or simulate with DevTools)
2. [ ] Try to sync
3. [ ] Verify message: "Network unavailable" or similar
4. [ ] Application remains responsive
5. [ ] User can retry when network returns

### 7c: Database Offline
1. [ ] Stop database connection (if testable)
2. [ ] Try to load dashboard
3. [ ] Verify message: "Database unavailable"
4. [ ] No 500 error stack trace exposed
5. [ ] Clear instructions for retry

### 7d: Roam API Rate Limited
1. [ ] Perform multiple rapid syncs (5 in a row)
2. [ ] Observe handling:
   - [ ] Error message if rate limited
   - [ ] Graceful fallback
   - [ ] Suggestion to retry after delay

**Expected Result**: ✅ Graceful error handling in all scenarios  
**Actual Result**: ☐ PASS ☐ FAIL  
**Error Cases Failed**: _______________________________________________

**Sign-off**: Tester initials _______ Date _______

---

## UAT Test Case 8: Multi-Tenant Support (If applicable)

**Objective**: Verify dashboard supports multiple projects independently.

**Precondition**: Multiple projects configured in database

**Steps**:
1. [ ] Login with user assigned to 2+ projects
2. [ ] Project Selector visible and populated
3. [ ] Switch to Project A:
   - [ ] Metrics reflect Project A data only
   - [ ] Tree shows Project A nodes only
4. [ ] Switch to Project B:
   - [ ] Metrics refresh immediately
   - [ ] Different data from Project A
   - [ ] No data crossover
5. [ ] Switch back to Project A:
   - [ ] Original data restored (from cache)
6. [ ] Verify no data leakage:
   - [ ] No Project B nodes in Project A tree
   - [ ] No Project B metrics in Project A dashboard

**Expected Result**: ✅ Each project isolated and independent  
**Actual Result**: ☐ PASS ☐ FAIL  
**Data Crossover Issues**: _______________________________________________

**Sign-off**: Tester initials _______ Date _______

---

## UAT Test Case 9: Data Consistency

**Objective**: Verify all data remains consistent across syncs.

**Precondition**: Repository imported and synchronized

**Steps**:
1. [ ] Record current metrics:
   ```
   Total Tests: _____
   Passed: _____
   Failed: _____
   Database: _____ nodes
   ```
2. [ ] Trigger refresh sync
3. [ ] Wait for completion
4. [ ] Record metrics again:
   ```
   Total Tests: _____
   Passed: _____
   Failed: _____
   Database: _____ nodes
   ```
5. [ ] Compare before/after:
   - [ ] Counts should not decrease (only increase if new tests added)
   - [ ] No disappearing tests
   - [ ] No duplicate test creation
6. [ ] Check database constraints:
   ```sql
   SELECT COUNT(*) FROM "RepositoryNode" WHERE parentId IS NULL AND depth > 0;
   -- Result should be: 0
   ```

**Expected Result**: ✅ Data consistent, no losses  
**Actual Result**: ☐ PASS ☐ FAIL  
**Data Inconsistencies**: _______________________________________________

**Sign-off**: Tester initials _______ Date _______

---

## SUMMARY

| Test Case | Result | Issues | Sign-off |
|-----------|--------|--------|----------|
| 1. Initial Sync | ☐ PASS ☐ FAIL | __________ | __________ |
| 2. Metrics Accuracy | ☐ PASS ☐ FAIL | __________ | __________ |
| 3. Tree Rendering | ☐ PASS ☐ FAIL | __________ | __________ |
| 4. Refresh Sync | ☐ PASS ☐ FAIL | __________ | __________ |
| 5. Scheduled Sync | ☐ PASS ☐ FAIL | __________ | __________ |
| 6. Performance | ☐ PASS ☐ FAIL | __________ | __________ |
| 7. Error Handling | ☐ PASS ☐ FAIL | __________ | __________ |
| 8. Multi-Tenant | ☐ PASS ☐ FAIL | __________ | __________ |
| 9. Data Consistency | ☐ PASS ☐ FAIL | __________ | __________ |

---

## OVERALL UAT RESULT

### Total Passed: ______ / 9
### Total Failed: ______ / 9

**Critical Issues Found**: 
- ☐ None (Ready for production)
- ☐ Yes (See details below)

**Critical Issues List**:
```
[List any blocking issues found during testing]
```

**Tester Recommendation**:
- [ ] Ready for Production Deployment
- [ ] Ready with Mitigation Plan
- [ ] Not Ready - Requires Fixes

---

## SIGN-OFF

**QA Lead Name**: ________________  
**QA Lead Signature**: ________________  
**Date**: ________________  

**Project Manager Name**: ________________  
**Project Manager Signature**: ________________  
**Date**: ________________  

---

**Version**: 1.0  
**Last Updated**: 2026-06-17  
**Next Review**: Post-deployment (48 hours)
