# FUNCTIONAL VALIDATION PLAN

**Goal**: Verify platform is production-ready for demo  
**Date**: 2026-06-24  
**Focus**: Demo-critical functionality only

---

## A. ROAM SYNC

- [ ] **New content imports correctly**
  - Add test case to Roam
  - Trigger sync via `/api/roam/scheduled-sync`
  - Verify in dashboard

- [ ] **No duplicate imports**
  - Sync same content twice
  - Verify count unchanged

- [ ] **Sync logs recorded**
  - Check SyncLog table
  - Verify timestamps

- [ ] **Automatic refresh works**
  - Verify scheduled-sync endpoint callable
  - Check Vercel cron configuration

---

## B. TEST CASES

- [ ] **Correct counts**
  - Dashboard total: 2,425
  - Manual: 1,484
  - Automated: 63
  - Match database counts

- [ ] **Filters work**
  - Filter by Manual
  - Filter by Automated
  - Results count correct

- [ ] **Search works**
  - Search by test title
  - Results accurate

- [ ] **Manual/Automated classification**
  - Tag detection accurate
  - Filter results correct

---

## C. TEST SUITES

- [ ] **Create suite from filters**
  - Filter tests
  - Create Suite button enabled
  - Suite created successfully

- [ ] **Create suite from selected tests**
  - Select multiple tests
  - Create Suite button enabled
  - Suite created with selected tests

- [ ] **Preview selected works**
  - Preview shows correct count
  - Preview shows test titles

- [ ] **Create Suite button works**
  - Button responsive
  - Form validation
  - Suite appears in list

---

## D. EXECUTION

- [ ] **Create cycle**
  - Fill form
  - Create button works
  - Cycle appears in list

- [ ] **Execute tests**
  - Open cycle
  - Update test status
  - Status changes saved

- [ ] **Update status**
  - Pass, Fail, Blocked, Skipped
  - Status persists

- [ ] **Add comments**
  - Comment on test
  - Comment appears
  - Persists on reload

---

## E. DASHBOARD

- [ ] **Metrics update correctly**
  - Total count matches DB
  - Passed/Failed/Blocked counts accurate
  - Pass rate calculation correct

- [ ] **Pass rate calculations**
  - Formula: (passed + skipped) / total
  - Displays as percentage
  - Updates on status change

- [ ] **Counts match database**
  - Dashboard counts = DB counts
  - No discrepancies

---

## TESTING PROTOCOL

1. **For each section**: Execute all checks in order
2. **Document**: Test result (PASS/FAIL/SKIP)
3. **If FAIL**: Note the bug with:
   - Expected behavior
   - Actual behavior
   - Steps to reproduce
   - Severity (Critical/High/Medium/Low)

4. **After all sections**: Compile bug list

---

## BUG SEVERITY SCALE

- **CRITICAL**: Blocks demo or causes data loss
- **HIGH**: Core feature broken but workaround exists
- **MEDIUM**: Feature partially broken or UX issue
- **LOW**: Minor issue, doesn't affect demo

---

## NEXT STEP

Execute validation and document all issues found.

