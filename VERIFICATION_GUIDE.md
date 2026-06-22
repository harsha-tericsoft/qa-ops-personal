# Execution Versioning MVP - Complete Verification Guide

## Quick Start

Run complete verification suite:
```bash
npm run verify:execution-versioning
```

This executes all verifications and generates a final report.

---

## Individual Verification Commands

### Database Verification
```bash
npm run verify:execution-versioning:db
```

**Checks:**
- ExecutionVersion table exists
- TestRun table exists and has rows
- All TestRuns have versionId (not null)
- No TestRuns have null versionId
- ExecutionCycle-Version relationships
- Version-TestRun relationships
- Unique constraint enforcement
- Enum value validity
- Sequential version numbering

**Output:** PASS/FAIL table with row counts

**Example Output:**
```
ExecutionVersion table exists and has rows
  Expected: > 0, Actual: 15, Status: PASS

All TestRuns have versionId (not null)
  Expected: 250, Actual: 250, Status: PASS

Result: 10/10 PASSED
Status: PASS
```

---

### Regression Verification
```bash
npm run verify:execution-versioning:regression
```

**Checks:**
- Existing cycles load
- Existing test runs load
- Existing comments load
- Existing Jira links load
- Dashboard metrics calculate
- Test cases accessible
- Test suites accessible
- All relationships intact

**Output:** PASS/FAIL results with actual counts

**Example Output:**
```
✓ Existing cycles load successfully
  Loaded 5 cycles

✓ Dashboard metrics calculate correctly
  Total: 250, Pass: 100, Fail: 50, Blocked: 20, NotExecuted: 80, PassRate: 40%

Result: 10/10 PASSED
Status: PASS
```

---

### API Verification
```bash
npm run verify:execution-versioning:api
```

**Requires:** Development server running (`npm run dev`)

**Checks:**
- Create Version (POST 201)
- List Versions (GET array)
- Save Draft (status to IN_PROGRESS)
- Complete Execution (status to COMPLETED)
- Duplicate prevention (409 Conflict)
- Get Version details
- Version History display

**Output:** Actual API responses and HTTP status codes

**Example Output:**
```
✓ Create Version API returns 201
  Status: 201, ID: cmqzt5q1v0000...

✓ Duplicate build version returns 409 Conflict
  Error: Build version already exists for this cycle.

Result: 7/7 PASSED
Status: PASS
```

---

## Complete Verification Suite

### Run Master Verification
```bash
npm run verify:execution-versioning
```

**Executes in sequence:**
1. Database Verification
2. Regression Verification
3. API Verification (if dev server running)

**Output:** Final report with summary table

**Example Final Report:**
```
═══════════════════════════════════════════════════════════════════
FINAL VERIFICATION REPORT
═══════════════════════════════════════════════════════════════════

VERIFICATION SUITE SUMMARY
───────────────────────────────────────────────────────────────────
Database Verification             │ ✓ PASS     │ 10/10
Regression Verification           │ ✓ PASS     │ 10/10
API Verification                  │ ✓ PASS     │ 7/7
───────────────────────────────────────────────────────────────────

OVERALL RESULTS
───────────────────────────────────────────────────────────────────
Total Tests:    27
Passed:         27
Failed:         0
Warnings:       0
Pass Rate:      100%
───────────────────────────────────────────────────────────────────

Elapsed Time: 15.42s

✓ ALL VERIFICATIONS PASSED

✓ Ready for deployment

Detailed report saved to: verification-report.json
```

---

## Output Formats

### Summary Table
```
Suite Name                        │ Status   │ Results
──────────────────────────────────┼──────────┼─────────
Database Verification             │ ✓ PASS   │ 10/10
Regression Verification           │ ✓ PASS   │ 10/10
API Verification                  │ ✓ PASS   │ 7/7
```

### Status Indicators
- `✓ PASS` - All checks passed (0 failures, 0 warnings)
- `✗ FAIL` - One or more checks failed
- `⚠ WARNING` - All checks passed but warnings exist

### Results File
Master verification creates `verification-report.json` with:
- Timestamp
- Duration
- Individual suite results
- Summary statistics
- Pass rate

---

## Verification States

### PASS (All Checks Pass)
```
✓ ALL VERIFICATIONS PASSED
✓ Ready for deployment
Exit Code: 0
```

**Next Steps:**
1. Deploy migration: `npx prisma migrate deploy`
2. Deploy code
3. Monitor production

---

### FAIL (Checks Failed)
```
✗ 1 verification(s) failed
✗ Fix failures before deployment
Exit Code: 1
```

**Next Steps:**
1. Review failed check details
2. Check troubleshooting section
3. Fix issue
4. Re-run verification

---

### WARNING (Checks Pass with Warnings)
```
⚠ 2 warning(s) found
⚠ Review warnings before deployment
Exit Code: 1
```

**Next Steps:**
1. Review warning details
2. Decide if deployment should proceed
3. Re-run after fixes (if needed)

---

## Verification Workflow

### Before Deployment

```
1. Start development server
   npm run dev
   
2. Run complete verification
   npm run verify:execution-versioning
   
3. Check final report
   - All tests PASS?
   - Any warnings?
   - Exit code 0?
   
4. Review report file
   cat verification-report.json
   
5. If all PASS, proceed to deployment
```

### If Any Check Fails

```
1. Note which suite failed
2. Run that verification individually
   npm run verify:execution-versioning:db
   npm run verify:execution-versioning:regression
   npm run verify:execution-versioning:api
   
3. Review error details
4. Check troubleshooting section
5. Fix issue
6. Re-run that verification
7. Once fixed, re-run complete suite
```

---

## Troubleshooting

### Database Connection Error
```
FAIL: Database connection
Error: Can't reach database server
```

**Solution:**
1. Check DATABASE_URL in .env.local
2. Verify Supabase is accessible
3. Run: `npx prisma db push`
4. Re-run verification

---

### Dev Server Not Running
```
FAIL: API connection
Error: connect ECONNREFUSED 127.0.0.1:3000
```

**Solution:**
1. Start dev server: `npm run dev`
2. Wait for "Ready in X.XXs"
3. Run API verification again

---

### No Execution Cycles Found
```
No execution cycles found. Cannot test API.
```

**Solution:**
1. Create a cycle: navigate to /cycles
2. Click "Create Execution Cycle"
3. Fill in details and create
4. Wait for cycle creation
5. Re-run API verification

---

### Migration Not Applied
```
All TestRuns have versionId
  Expected: 250, Actual: 0, Status: FAIL
```

**Solution:**
1. Apply migration: `npx prisma migrate deploy`
2. Wait for "Database has been successfully migrated"
3. Re-run verification

---

## Expected Results

### Database Verification
- **Expected:** 10/10 PASSED
- **Acceptable:** 9/10 (if no duplicates exist yet)
- **Failure:** Any FAILED requires fix

### Regression Verification
- **Expected:** 10/10 PASSED
- **Failure:** Any FAILED indicates regression

### API Verification
- **Expected:** 7/7 PASSED
- **Acceptable:** 6/7 (if no duplicate exists yet)
- **Failure:** Any FAILED requires investigation

---

## Reports

### Console Output
- Real-time verification progress
- Detailed PASS/FAIL for each check
- Summary table
- Exit code indication

### JSON Report (verification-report.json)
```json
{
  "timestamp": "2026-06-22T10:30:00.000Z",
  "duration": 15420,
  "results": [
    {
      "suite": "Database Verification",
      "status": "PASS",
      "tests": {
        "passed": 10,
        "failed": 0,
        "warnings": 0,
        "total": 10
      }
    },
    ...
  ],
  "summary": {
    "total": 27,
    "passed": 27,
    "failed": 0,
    "warnings": 0
  }
}
```

---

## After Verification Passes

### Deployment Checklist
- [ ] All verification tests PASS
- [ ] JSON report reviewed
- [ ] No critical warnings
- [ ] Migration tested in staging
- [ ] Backup database created
- [ ] Deployment plan reviewed

### Deployment Steps
```bash
# 1. Apply migration to production
npx prisma migrate deploy

# 2. Deploy code
npm run build
npm start

# 3. Verify in production
npm run verify:execution-versioning

# 4. Monitor
```

---

## Files

```
scripts/
├── verify-execution-versioning-db.ts
├── verify-execution-versioning-api.ts
├── verify-regressions.ts
└── verify-master.ts

Documentation/
├── VERIFICATION_GUIDE.md (this file)
├── VERIFICATION_SUITE.md
└── VERIFY_BROWSER.md

Generated/
└── verification-report.json (after running master verification)
```

---

## Exit Codes

| Code | Status | Meaning |
|------|--------|---------|
| 0 | PASS | All verifications passed, ready to deploy |
| 1 | FAIL | One or more verifications failed, do not deploy |
| 2 | ERROR | Verification suite encountered fatal error |

---

**Do not deploy until: `npm run verify:execution-versioning` returns exit code 0**

