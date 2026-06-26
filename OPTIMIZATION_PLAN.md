# QA-Ops Portal Optimization & Bug Fix Plan

## CRITICAL ISSUES IDENTIFIED

### 1. **Test Cases Count Becoming 0 After Suite Creation**
**Symptom**: User selects 21 test cases, shows 21 while creating, becomes 0 after saving

**Root Cause**: 
- Test suite API returns suite with testCases correctly
- But when fetched later via GET, some suites have 0 testCases
- Indicates testCases relationship is not being persisted

**Solution**:
- Fix suite creation POST endpoint to properly link testCases
- Verify SuiteTestCase junction table entries are created
- Add logging to track testCase linkage throughout creation

### 2. **All APIs Returning 500 Errors & Taking 40+ Seconds**
**Symptom**: Repository API 42s, node-mapping 5s, test-suites 33s

**Root Cause**:
- `Invalid prisma.repositoryNode.findMany() invocation` error
- Prisma client not properly initialized in bundled code
- Turbopack bundler breaking Prisma imports
- Fetching all 3729 nodes at once causes timeout

**Solutions**:
a) Fix Prisma import consistency (all use `import { prisma }`)
b) Implement pagination for node fetching (1000 per page)
c) Add comprehensive error handling and logging
d) Add caching to frequently-used endpoints
e) Add loading indicators to UI

### 3. **Portal-Wide Performance Issues**
**Affected APIs**:
- Repository: 42 seconds
- Test Cases node-mapping: 5+ seconds
- Test Suites: 33 seconds
- Execution Cycles: 30+ seconds

**Solutions**:
- Implement progressive loading with loaders
- Add database indexing on frequently-queried columns
- Use HTTP caching headers
- Implement client-side caching
- Add pagination to large datasets

## IMPLEMENTATION PLAN

### Phase 1: Fix Critical Bugs
1. ✅ Fix repository API Prisma import
2. ✅ Implement pagination for node fetching
3. Fix test suite testCase linkage verification
4. Fix execution cycles API response consistency

### Phase 2: Implement Caching
1. Repository endpoint (60s TTL) - DONE
2. Node-mapping endpoint (5min TTL) - DONE
3. Test suites endpoint (2min TTL)
4. Execution cycles endpoint (1min TTL)

### Phase 3: Add Loading Indicators
1. Repository tree selector
2. Execution cycles list
3. Test suites dropdown
4. All form submissions

### Phase 4: Database Optimization
1. Add indexes on projectId columns
2. Add indexes on foreign key columns
3. Add indexes on frequently-filtered fields

## TESTING CHECKLIST

- [ ] Create test suite with 20+ test cases, verify count persists
- [ ] Check execution cycles loads in <2 seconds
- [ ] Verify repository tree loads progressively
- [ ] Test all API endpoints return proper responses
- [ ] Verify loading indicators appear during slow operations
- [ ] Test form submissions with error handling
- [ ] Verify data is properly cached and invalidated

## PERFORMANCE TARGETS

| API Endpoint | Current | Target | Status |
|---|---|---|---|
| Repository | 42s | <2s | In Progress |
| Node-mapping | 5s | <500ms | In Progress |
| Test Suites | 33s | <2s | In Progress |
| Execution Cycles | 30s | <1s | In Progress |
| All forms | N/A | Show loader | To Do |

