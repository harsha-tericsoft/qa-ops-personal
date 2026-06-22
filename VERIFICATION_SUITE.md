# Execution Versioning MVP - Verification Suite

## Overview

Complete verification suite for Phase 1 MVP implementation. Includes database, API, regression, and browser verification.

---

## Prerequisites

- Node.js 20+
- PostgreSQL database connected
- Next.js development server running (for API tests)
- Environment variables configured

---

## Quick Start

### Run All Verifications
```bash
npm run verify:execution-versioning
```

This runs in order:
1. Database verification
2. Regression verification  
3. API verification

---

## Individual Verification Scripts

### 1. Database Verification
```bash
npm run verify:execution-versioning:db
```

**Verifies:**
- ✓ ExecutionVersion table exists and has rows
- ✓ TestRun table has rows
- ✓ All TestRuns have versionId (not null)
- ✓ No TestRuns have null versionId
- ✓ ExecutionCycle linked to ExecutionVersion
- ✓ ExecutionVersion linked to TestRuns
- ✓ Unique constraint (cycleId, buildVersion) enforced
- ✓ ExecutionStatus enum values valid
- ✓ TestRunStatus enum values valid
- ✓ Version numbers sequential per cycle

**Output:** PASS/FAIL table with details

**Time:** ~5 seconds

---

### 2. Regression Verification
```bash
npm run verify:execution-versioning:regressions
```

**Verifies:**
- ✓ Existing cycles load successfully
- ✓ Existing test runs load successfully
- ✓ Existing comments load successfully
- ✓ Existing Jira links load successfully
- ✓ Dashboard metrics calculate correctly
- ✓ Test cases still accessible
- ✓ Test suites still accessible
- ✓ Cycle-Run relationships intact
- ✓ Comments-Run linkage maintained
- ✓ Jira links-Run linkage maintained

**Output:** PASS/FAIL results with metrics

**Time:** ~3 seconds

---

### 3. API Verification
```bash
npm run verify:execution-versioning:api
```

**Requirements:**
- Development server running: `npm run dev`
- Existing execution cycle in database

**Verifies:**
- ✓ Create Version API (POST) returns 201
- ✓ List Versions API (GET) returns array
- ✓ Save Draft updates status to IN_PROGRESS
- ✓ Complete Execution updates status to COMPLETED
- ✓ Duplicate build version returns 409 Conflict
- ✓ Get Version returns correct data
- ✓ Version History displays all versions

**Output:** Actual API responses with status codes

**Time:** ~10 seconds

---

## Browser Verification

### Manual Testing Checklist
```
VERIFY_BROWSER.md
```

Contains step-by-step verification for:
1. Create Version
2. Save Draft
3. Refresh Page
4. Verify Persistence
5. Complete Execution
6. Verify Read-Only
7. Create Version 2
8. Verify Version History
9. Try Duplicate
10. Dashboard Regression
11. Test Suites Regression
12. Repository Regression

**Time:** ~15 minutes

---

## Output Format

### Database Verification Table
```
┌────────────────────────────────────────┬────────┬──────────────────────┬──────────────────────┐
│ Test                                   │ Status │ Expected             │ Actual               │
├────────────────────────────────────────┼────────┼──────────────────────┼──────────────────────┤
│ ExecutionVersion table exists...       │ ✓ PASS │ > 0                  │ 15                   │
│ TestRun table has rows                 │ ✓ PASS │ > 0                  │ 250                  │
│ All TestRuns have versionId...         │ ✓ PASS │ 250                  │ 250                  │
│ No TestRuns have null versionId        │ ✓ PASS │ 0                    │ 0                    │
└────────────────────────────────────────┴────────┴──────────────────────┴──────────────────────┘

Result: 10/10 PASSED
```

### API Verification Output
```
✓ Create Version API returns 201
  Status: 201, ID: cmqzt5q1v0000...
  Response: { id: "...", versionNumber: 1, buildVersion: "2.5.0", ... }

✓ List Versions API returns array
  Found 3 versions
  Latest version: { versionNumber: 3, buildVersion: "2.5.2", status: "DRAFT", ... }

✓ Save Draft sets status to IN_PROGRESS
  Status: IN_PROGRESS

Result: 7/7 PASSED
```

### Regression Verification Output
```
✓ Existing cycles load successfully
  Loaded 5 cycles

✓ Existing test runs load successfully
  Loaded 250 test runs

✓ Dashboard metrics calculate correctly
  Total: 250, Pass: 100, Fail: 50, Blocked: 20, NotExecuted: 80, PassRate: 40%

Result: 10/10 PASSED
```

---

## Troubleshooting

### Database Connection Error
```
FAIL: Database connection
Error: Can't reach database server
```

**Solution:**
- Verify DATABASE_URL is set in .env.local
- Check Supabase connection is active
- Run: `npx prisma db push`

### API Connection Error
```
FAIL: API connection
Error: connect ECONNREFUSED 127.0.0.1:3000
```

**Solution:**
- Start dev server: `npm run dev`
- Wait for "Ready in X.XXs"
- Run API verification again

### No Execution Cycles Found
```
No execution cycles found. Cannot test API.
```

**Solution:**
- Create a test cycle: navigate to /cycles → "Create Execution Cycle"
- Wait for cycle to be created
- Run API verification again

### Migration Not Applied
```
TestRun without versionId found
```

**Solution:**
- Apply migration: `npx prisma migrate deploy`
- Verify migration succeeded
- Run database verification again

---

## Verification Workflow

### Before Deployment

```
1. Run all verifications
   npm run verify:execution-versioning
   
2. If all PASS:
   - Review API responses
   - Review database metrics
   - Review regression results
   
3. Browser testing
   - Follow VERIFY_BROWSER.md
   - Capture screenshots
   - Document any issues
   
4. Deploy
   - npx prisma migrate deploy
   - Deploy code
   - Monitor production
```

### If Any Verification Fails

```
1. Check error message
   - Does output show what failed?
   - Check details column
   
2. Investigate issue
   - Check database state
   - Check API logs
   - Check console for errors
   
3. Fix issue
   - Apply migration if needed
   - Fix code if needed
   - Restart services if needed
   
4. Re-run verification
   - Run specific verification that failed
   - If PASS, run full suite again
```

---

## Expected Results

### Database Verification
- **Expected**: 10/10 PASSED
- **Acceptable**: 9/10 PASSED (if no duplicates exist yet)
- **Failure**: Any FAILED test requires investigation

### Regression Verification
- **Expected**: 10/10 PASSED
- **Failure**: Any FAILED test indicates regression

### API Verification
- **Expected**: 7/7 PASSED
- **Acceptable**: 6/7 PASSED (if no duplicate exists yet)
- **Failure**: Any FAILED test requires investigation

### Browser Verification
- **Expected**: All 12 steps PASS
- **Failure**: Any FAILED step blocks deployment

---

## Files Created

```
scripts/
├── verify-execution-versioning-db.ts      # Database verification
├── verify-execution-versioning-api.ts     # API verification
├── verify-regressions.ts                  # Regression verification
└── verify-all.sh                          # Master runner

VERIFY_BROWSER.md                          # Browser checklist
VERIFICATION_SUITE.md                      # This file
```

---

## Next Steps After Verification

1. **All Tests Pass**
   ```bash
   npx prisma migrate deploy    # Apply migration
   npm run build                 # Build for production
   npm start                     # Start server
   ```

2. **Tests Fail**
   - Check troubleshooting section
   - Review error output
   - Fix issue
   - Re-run verification

3. **Deployment**
   - Deploy migration to production database
   - Deploy code changes
   - Run verification in production
   - Monitor for issues

---

## Support

For issues or questions:
1. Check troubleshooting section
2. Review error message details
3. Check PHASE1_MVP_IMPLEMENTATION_EVIDENCE.md
4. Check schema changes in prisma/schema.prisma
5. Check API implementation in app/api/execution-cycles/

