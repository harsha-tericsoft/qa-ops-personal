# Verification Checklist: Tasks #1 & #2

## TASK #1: Dirty-Check Normalization Fix

**What Changed:**
- Removed `orderEqual` from dirty-check comparison in `lib/roam/sync.ts`
- Order field is recalculated every sync (not a meaningful change indicator)
- Now only compares: name, tags, slug

**How to Verify:**

### Test Scenario A: No changes in Roam
1. Kill dev server and restart: `npm run dev -- --port 3000`
2. Navigate to Projects → [Your Project] → Repository Synchronization
3. Click **Refresh Sync** button
4. Watch browser Network tab and Next.js terminal logs
5. Look for output: `[importMarkdownNodes] Update reasons breakdown:`

**Expected Results:**
```
[importMarkdownNodes] Split results: 0 to create, 0 to update, ~3728 skipped
[importMarkdownNodes] Update reasons breakdown:
  nameChanged: 0
  tagsChanged: 0
  slugChanged: 0
```

**Success Criteria:** ✅ 0 updates (not 1617+), all nodes skipped

---

## TASK #2: Bulk Test Suite API

**What Changed:**
- `handleCreateSuite` now passes `testIds` array to POST request
- Eliminated separate PATCH request for adding test cases
- Backend already supported bulk testIds - frontend now uses it

**How to Verify:**

### Test Scenario: Create suite with multiple tests
1. Navigate to Test Suites page
2. Click "Create New Suite"
3. Enter suite name and description
4. Select 5-10 test cases from the hierarchy
5. Click "Create Suite"
6. Open browser **Network tab** and observe requests

**Expected Before Fix:**
```
POST /api/test-suites → 201 Created (empty suite)
POST /api/test-cases → 201 Created (test 1)
POST /api/test-cases → 201 Created (test 2)
... (N times for N tests)
PATCH /api/test-suites/[id] → 200 OK (link tests)
```
**Total: N+2 requests**

**Expected After Fix:**
```
POST /api/test-cases → 201 Created (test 1)
POST /api/test-cases → 201 Created (test 2)
... (N times for N tests)
POST /api/test-suites → 201 Created (with testIds in body)
```
**Total: N+1 requests (1 less request)**

**Success Criteria:** 
- ✅ Only 1 POST to /api/test-suites (in the last step)
- ✅ No PATCH requests to /api/test-suites
- ✅ Suite created successfully with all test cases linked
- ✅ Network requests reduced by 1

---

## Running Full Verification

### Step 1: Verify Task #1
```bash
npm run dev -- --port 3000
```
- Open browser to http://localhost:3000
- Go to Projects → [Project] → Repository Synchronization
- Click Refresh Sync
- Check terminal for `Update reasons breakdown` showing all zeros
- Check response time (should be quick, not hanging)

### Step 2: Verify Task #2
- Still in same dev server session
- Navigate to Test Suites
- Create a new suite with 5-10 selected tests
- Open DevTools Network tab
- Count POST and PATCH requests to /api/test-suites
- Expected: 1 POST, 0 PATCH

---

## Debugging if Something's Wrong

### Task #1 Issues

**If Update count > 0:**
- Check the update reasons breakdown - which fields changed?
- If only nameChanged or tagsChanged: nodes were edited in Roam (expected)
- If slugChanged: check for special characters that might differ

**If Sync hangs:**
- This was the original issue - if it still hangs, the update loop optimization is still needed
- But with 0 updates, the request should complete quickly

### Task #2 Issues

**If seeing PATCH requests:**
- Clear browser cache (Cmd/Ctrl+Shift+Delete)
- Restart dev server
- Check that `testIds` array is being passed to POST body

**If testIds not linked:**
- Check browser console for errors
- Verify backend POST endpoint accepts testIds parameter
- Check suite creation response includes testCases

---

## Commit Info

- **Commit:** 694f0f7
- **Message:** "fix: Remove order field from dirty-check and implement bulk test suite creation"
- **Files Changed:**
  - lib/roam/sync.ts (dirty-check)
  - app/test-suites/page.tsx (bulk API)

---

## Next Step (Task #3)

After verifying Tasks #1 and #2 work correctly:
- Fix ES2017 regex compatibility issue
- Remove `/s` flag from line 822 of sync.ts
- Remove `/s` flag from line 45 of scheduled-sync/route.ts

But only after Tasks #1 and #2 are confirmed working!
