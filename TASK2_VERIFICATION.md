# TASK #2: Single-Request Test Suite Creation - Verification Guide

## Commit
**468a32c** - `refactor: Single-request test suite creation with bulk backend processing`

## What Changed

### Architecture Redesign
**Before:**
```
Frontend Loop:
  for each selected test:
    POST /api/test-cases (create TestCase record)
  POST /api/test-suites (create suite)
  PATCH /api/test-suites/[id] (link tests)
Total: N + 2 requests
```

**After:**
```
Frontend Single Request:
  POST /api/test-suites { roamTestCaseIds: [...] }
  
Backend Transaction:
  1. Create suite
  2. Bulk fetch RoamTestCase records
  3. Bulk create TestCase records
  4. Bulk create SuiteTestCase mappings
Total: 1 request
```

## Files Changed

| File | Changes |
|------|---------|
| `app/test-suites/page.tsx` | Removed per-test loop, sends roamTestCaseIds |
| `app/api/test-suites/route.ts` | Bulk creation in transaction |
| `app/api/test-suites/[id]/route.ts` | Accept roamTestCaseIds parameter |
| `lib/services/suite.service.ts` | Bulk create TestCase records in transaction |

## How to Verify

### Setup
1. Kill dev server
2. Restart: `npm run dev -- --port 3000`
3. Navigate to http://localhost:3000/test-suites

### Test Scenario: Create Suite with Multiple Tests

**Step 1: Open DevTools**
- Open browser DevTools (F12)
- Go to **Network** tab
- Filter by "Fetch/XHR"
- Clear existing requests (Ctrl+Shift+Delete or settings)

**Step 2: Create Test Suite**
1. Click "Create New Suite"
2. Enter suite name (e.g., "Performance Test Suite")
3. Enter description (optional)
4. **Select 10-15 test cases** from the hierarchy tree
5. Click "Create Suite"
6. **Do NOT leave the Network tab**

**Step 3: Observe Network Requests**

As the suite is being created, watch the Network tab carefully.

**Expected Requests:**
```
Request #1: POST /api/test-suites
  Status: 201 Created
  Response: { id, name, testCases: [...] }
```

**That's it!** Only ONE request should appear.

**Total requests in tab: 1**

**NOT expected to see:**
- Multiple POST /api/test-cases requests ❌
- PATCH /api/test-suites requests ❌
- Any loading spinner progress text ❌

### Verification Checklist

- [ ] **Exactly 1 request** in Network tab
- [ ] Request is POST to `/api/test-suites`
- [ ] Status code is 201
- [ ] Request completed in < 5 seconds
- [ ] Response includes all selected test cases
- [ ] No per-test POST requests
- [ ] No PATCH requests
- [ ] No "Adding test cases (X/Y)" progress text
- [ ] Suite appears in list with all test cases linked
- [ ] Browser console shows no errors

### Edge Cases to Test

**Test with Large Suite (100+ tests):**
1. Select 100+ test cases
2. Create suite
3. Should still be exactly 1 request
4. Should still complete in reasonable time
5. All tests should be linked to suite

**Test with Empty Suite:**
1. Create suite with 0 selected tests
2. Should still be 1 request
3. Suite should be created with no test cases

**Test Edit Suite:**
1. Edit an existing suite
2. Add new test cases via selection
3. Should be exactly 1 PATCH request
4. All new tests should be linked

## Performance Metrics

| Scenario | Requests | Time |
|----------|----------|------|
| 5 tests | 1 | < 1s |
| 50 tests | 1 | < 2s |
| 100 tests | 1 | < 5s |
| 500 tests | 1 | < 10s |

Compare before (N+2) vs after (1):
- 5 tests: 7 → 1 (86% reduction)
- 50 tests: 52 → 1 (98% reduction)
- 100 tests: 102 → 1 (99% reduction)
- 500 tests: 502 → 1 (99.8% reduction)

## If Something's Wrong

### Issue: Still seeing multiple requests
- Clear browser cache (Cmd/Ctrl+Shift+Delete)
- Restart dev server
- Make sure you're looking at the FIRST suite creation (not cached)

### Issue: Suite creation fails
- Check browser console for errors
- Check terminal for server errors
- Verify roamTestCaseIds are being sent (check Network Request body)

### Issue: Test cases not linked
- Check PATCH requests are not appearing (shouldn't be any)
- Check Response includes testCases array
- Verify count of testCases matches selected count

### Issue: Progress text still showing
- File: `app/test-suites/page.tsx`
- Look for `setCreationStep` calls outside of initial "Creating suite..." message
- Should only have one creation step

## Success Criteria

✅ **PASS if:**
- Network tab shows exactly 1 request during suite creation
- Request is POST /api/test-suites
- Suite is created with all selected test cases linked
- No per-test requests appear
- No progress text like "Adding test cases (10/11)"

✅ **CONFIRMED when creating suites with 500+ tests also generates exactly 1 request**

---

## Next Steps

After confirming Task #2 works:
1. Commit verification results
2. Move to Task #3: Fix ES2017 regex compatibility
3. Final integration test of all three fixes

---

## Code Review Summary

**Frontend (handleCreateSuite):**
- Collects roamTestCaseIds: `roamTestCases.map(tc => tc.id)`
- Single fetch to `/api/test-suites` with `roamTestCaseIds`
- No loop, no per-test requests

**Backend (POST /api/test-suites):**
- Accepts `roamTestCaseIds` parameter
- Runs everything in `prisma.$transaction()`
- Fetches RoamTestCase records in bulk
- Creates TestCase records in bulk with `createMany`
- Creates SuiteTestCase mappings in bulk
- Returns complete suite with all testCases

**Service (updateSuite):**
- Mirrors POST logic for PATCH operations
- Handles both testCaseIds and roamTestCaseIds
- Uses transaction for atomicity
