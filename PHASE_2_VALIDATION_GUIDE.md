# PHASE 2 VALIDATION GUIDE

**Purpose:** Validate all Phase 1 functionality before Phase 2 (UI) approval
**Status:** Ready for execution
**Required:** Dev environment with database access

---

## VALIDATION CHECKLIST A: TAG VALIDATION

### Step 1: Count unique tags in RoamTestCase
```bash
# Open your database client (Supabase, pgAdmin, etc.)
# Run this SQL query:

SELECT 
  COUNT(DISTINCT unnest(tags)) as unique_tags_total,
  (ARRAY_AGG(DISTINCT unnest(tags)))[1:20] as top_20_tags
FROM "RoamTestCase"
WHERE tags IS NOT NULL AND array_length(tags, 1) > 0;
```

**Expected output:**
```
unique_tags_total | top_20_tags
─────────────────┼──────────────
        XX       | {tag1, tag2, tag3, ...}
```

### Step 2: Count tests per tag
```bash
# Run this SQL query:

SELECT 
  name,
  COUNT(*) as test_count
FROM "Tag" t
JOIN "TagTestCase" ttc ON t.id = ttc."tagId"
GROUP BY t.id, t.name
ORDER BY test_count DESC
LIMIT 20;
```

**Expected output (example):**
```
name          | test_count
──────────────┼───────────
HappyPath     | 45
Smoke         | 30
Regression    | 120
Manual        | 95
...
```

### Step 3: Verify migration success
```bash
# Run this SQL query:

SELECT 
  (SELECT COUNT(*) FROM "Tag") as tag_records,
  (SELECT COUNT(*) FROM "TagTestCase") as tag_relationships,
  (SELECT COUNT(DISTINCT unnest(tags)) FROM "RoamTestCase") as roam_tags
FROM (SELECT 1);
```

**Expected output:**
```
tag_records | tag_relationships | roam_tags
────────────┼───────────────────┼──────────
    XX      |        XXX        |    XX
```

**✅ PASS if:** tag_records > 0 AND tag_relationships > 0

---

## VALIDATION CHECKLIST B: FILTER API VALIDATION

### Step 1: Start dev server
```bash
npm run dev
```

### Step 2: Get filter options
```bash
# Open terminal or Postman/Insomnia

curl "http://localhost:3000/api/test-cases/filter-options?projectId=YOUR_PROJECT_ID"
```

**Expected response:**
```json
{
  "tags": [
    { "name": "HappyPath", "count": 45 },
    { "name": "Smoke", "count": 30 },
    { "name": "Regression", "count": 120 },
    ...
  ],
  "types": [
    { "name": "Manual", "count": 0 },
    { "name": "Automated", "count": 0 }
  ],
  "modules": [
    { "name": "ModuleName", "count": 0 }
  ]
}
```

**✅ PASS if:** tags array has items with counts > 0

### Step 3: Get test case summary
```bash
curl "http://localhost:3000/api/test-cases/summary?projectId=YOUR_PROJECT_ID"
```

**Expected response:**
```json
{
  "total": 98,
  "byType": {
    "Manual": 0,
    "Automated": 0
  },
  "byTag": {
    "HappyPath": 45,
    "Smoke": 30,
    "Regression": 120,
    ...
  },
  "byModule": {}
}
```

**✅ PASS if:** total > 0 AND byTag has entries

---

## VALIDATION CHECKLIST C: SEARCH VALIDATION

### Test: Search for "Login"
```bash
curl "http://localhost:3000/api/test-cases/search?projectId=YOUR_PROJECT_ID&search=Login&page=1&limit=20"
```

**Expected response:**
```json
{
  "testCases": [
    {
      "id": "xxx",
      "title": "When I Login with valid credentials",
      "description": "...",
      "tags": ["Manual", "HappyPath", "Smoke"],
      "testRuns": 2
    },
    {
      "id": "yyy",
      "title": "Login button should be disabled when fields empty",
      "description": "...",
      "tags": ["Manual"],
      "testRuns": 1
    },
    ...
  ],
  "total": 5,
  "page": 1,
  "limit": 20,
  "pages": 1
}
```

**✅ PASS if:**
- Only tests with "Login" in title/description returned
- testCases array not empty
- total matches count of returned items

---

## VALIDATION CHECKLIST D: TAG FILTER VALIDATION

### Test: Filter by HappyPath tag
```bash
curl "http://localhost:3000/api/test-cases/search?projectId=YOUR_PROJECT_ID&tags=HappyPath&page=1&limit=20"
```

**Expected response:**
```json
{
  "testCases": [
    {
      "id": "xxx",
      "title": "Happy path test 1",
      "tags": ["HappyPath", "Smoke"],
      ...
    },
    {
      "id": "yyy",
      "title": "Happy path test 2",
      "tags": ["HappyPath", "Manual"],
      ...
    },
    ...
  ],
  "total": 45,
  "page": 1,
  "limit": 20,
  "pages": 3
}
```

**✅ PASS if:**
- All returned tests have HappyPath tag
- total = 45 (or matches expected count)
- All records include tags array

---

## VALIDATION CHECKLIST E: MULTI-TAG FILTER VALIDATION

### Test: Filter by HappyPath AND Smoke
```bash
curl "http://localhost:3000/api/test-cases/search?projectId=YOUR_PROJECT_ID&tags=HappyPath,Smoke&page=1&limit=20"
```

**Expected response:**
```json
{
  "testCases": [
    {
      "id": "xxx",
      "title": "Happy path smoke test 1",
      "tags": ["HappyPath", "Smoke", "Manual"],
      ...
    },
    {
      "id": "yyy",
      "title": "Happy path smoke test 2",
      "tags": ["HappyPath", "Smoke"],
      ...
    },
    ...
  ],
  "total": 15,
  "page": 1,
  "limit": 20,
  "pages": 1
}
```

**✅ PASS if:**
- All returned tests have BOTH HappyPath AND Smoke tags
- total < 45 (fewer than single tag filter)
- Results correctly filtered

---

## VALIDATION CHECKLIST F: SUITE PREVIEW VALIDATION

### Test: Preview suite with Smoke tag
```bash
curl -X POST http://localhost:3000/api/test-suites/preview \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "YOUR_PROJECT_ID",
    "filters": {
      "tags": ["Smoke"]
    }
  }'
```

**Expected response:**
```json
{
  "matchingTests": [
    { "id": "xxx", "title": "Smoke test 1" },
    { "id": "yyy", "title": "Smoke test 2" },
    { "id": "zzz", "title": "Smoke test 3" },
    ...
  ],
  "count": 30
}
```

**✅ PASS if:**
- matchingTests array populated
- count = 30 (or expected Smoke test count)
- Test IDs and titles present

### Test: Preview with search + tag
```bash
curl -X POST http://localhost:3000/api/test-suites/preview \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "YOUR_PROJECT_ID",
    "filters": {
      "tags": ["Manual"],
      "search": "login"
    }
  }'
```

**Expected response:**
```json
{
  "matchingTests": [
    { "id": "xxx", "title": "Manual login test" },
    ...
  ],
  "count": 5
}
```

**✅ PASS if:**
- All tests have Manual tag
- All tests have "login" in title
- count < 95 (fewer than Manual alone)

---

## VALIDATION CHECKLIST G: SUITE CREATION VALIDATION

### Test: Create suite from Smoke tag filter
```bash
curl -X POST http://localhost:3000/api/test-suites/from-filters \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "YOUR_PROJECT_ID",
    "name": "Smoke Test Suite",
    "description": "Tests for smoke testing",
    "filters": {
      "tags": ["Smoke"]
    }
  }'
```

**Expected response:**
```json
{
  "id": "new-suite-id",
  "projectId": "YOUR_PROJECT_ID",
  "name": "Smoke Test Suite",
  "description": "Tests for smoke testing",
  "selectionMethod": "FILTER",
  "selectionConfig": {
    "tags": ["Smoke"]
  },
  "testCases": [
    {
      "id": "stc-1",
      "testCase": {
        "id": "tc-1",
        "title": "Smoke test 1"
      }
    },
    ...
  ]
}
```

**Record the suite ID:** `new-suite-id` (for regression test below)

**✅ PASS if:**
- id generated
- selectionMethod = "FILTER"
- testCases.length = 30 (or expected count)
- testCases populated with correct tests

### Test: Verify suite visible and working
```bash
# 1. Get suite details
curl "http://localhost:3000/api/test-suites/new-suite-id"

# Expected: Suite with 30 test cases
```

**✅ PASS if:** Suite exists and has correct test count

---

## VALIDATION CHECKLIST H: REGRESSION VALIDATION

### Test 1: Repository Tree Suite Creation Still Works
```bash
# In UI or via API:
# 1. Navigate to Repository page
# 2. Select some nodes
# 3. Create suite from hierarchy

# Expected: Suite created with hierarchy-based selection
```

**✅ PASS if:**
- Suite created successfully
- Suite has selectionMethod = "HIERARCHY"
- Test count matches selected nodes

### Test 2: Execution Cycle Creation Still Works
```bash
# In UI:
# 1. Navigate to Cycles page
# 2. Create new cycle with existing suite
# 3. Create versions

# Expected: Cycle and versions created successfully
```

**✅ PASS if:**
- Cycle created
- Versions created with correct test runs
- Can switch between versions

### Test 3: Version Creation Works
```bash
# Verify version creation (from Test 2)

# SQL Query:
SELECT 
  id,
  "versionNumber",
  "buildVersion",
  (SELECT COUNT(*) FROM "TestRun" WHERE "versionId" = ev.id) as test_count
FROM "ExecutionVersion" ev
ORDER BY "createdAt" DESC
LIMIT 3;
```

**Expected:**
```
id  | versionNumber | buildVersion | test_count
────┼───────────────┼──────────────┼───────────
xxx |       1       | v1.0.0       |    30
yyy |       2       | v2.0.0       |    30
```

**✅ PASS if:** Each version has correct test count

### Test 4: Save Draft Still Works
```bash
# In UI:
# 1. Mark a test as PASS
# 2. Click Save Draft
# 3. Verify status saved

# SQL Query:
SELECT 
  status,
  COUNT(*) 
FROM "TestRun"
WHERE "versionId" = 'VERSION_ID'
GROUP BY status;
```

**Expected:**
```
status      | count
────────────┼──────
PASS        |  1
NOT_EXECUTED| 29
```

**✅ PASS if:** Status updates persist

### Test 5: Comments Still Work
```bash
# In UI:
# 1. Add comment to test run
# 2. Verify comment saved and displays

# SQL Query:
SELECT COUNT(*) as comment_count FROM "TestRunComment";
```

**✅ PASS if:** Comments exist and are retrievable

### Test 6: Jira Links Still Work
```bash
# In UI:
# 1. Add Jira link to test run
# 2. Verify link saved

# SQL Query:
SELECT COUNT(*) as jira_link_count 
FROM "TestRun" 
WHERE "jiraLink" IS NOT NULL;
```

**✅ PASS if:** Jira links exist

### Test 7: Dashboard Still Loads
```bash
# In UI:
# 1. Navigate to Dashboard page
# 2. Verify metrics load

# API test:
curl "http://localhost:3000/api/dashboard/metrics?projectId=YOUR_PROJECT_ID"
```

**Expected:**
```json
{
  "totalTests": 98,
  "totalSuites": 9,
  "totalCycles": 30,
  "draftCycles": 30,
  "inProgressCycles": 0,
  "completedCycles": 0
}
```

**✅ PASS if:** Metrics load and match expectations

---

## VALIDATION CHECKLIST I: PERFORMANCE VALIDATION

### Measure: Search Performance
```bash
# Install time measurement tool if needed
# Time the search API call

time curl "http://localhost:3000/api/test-cases/search?projectId=YOUR_PROJECT_ID&page=1&limit=20"

# Expected: < 500ms
```

Record time: ________ ms

### Measure: Tag Filter Performance
```bash
time curl "http://localhost:3000/api/test-cases/search?projectId=YOUR_PROJECT_ID&tags=Smoke&page=1&limit=20"

# Expected: < 500ms
```

Record time: ________ ms

### Measure: Suite Preview Performance
```bash
time curl -X POST http://localhost:3000/api/test-suites/preview \
  -H "Content-Type: application/json" \
  -d '{"projectId":"YOUR_PROJECT_ID","filters":{"tags":["Smoke"]}}'

# Expected: < 1000ms
```

Record time: ________ ms

### Measure: Suite Creation Performance
```bash
time curl -X POST http://localhost:3000/api/test-suites/from-filters \
  -H "Content-Type: application/json" \
  -d '{"projectId":"YOUR_PROJECT_ID","name":"Perf Test","filters":{"tags":["Smoke"]}}'

# Expected: < 2000ms
```

Record time: ________ ms

---

## VALIDATION RESULTS SUMMARY

After running all validations above, fill in:

### A. Tag Validation
- [ ] Total unique tags: ______
- [ ] Top tags with counts: ________
- [ ] Migration successful: ✅/❌

### B. Filter API Validation
- [ ] GET /api/test-cases/filter-options: ✅/❌
- [ ] GET /api/test-cases/search: ✅/❌
- [ ] GET /api/test-cases/summary: ✅/❌

### C. Search Validation
- [ ] "Login" search returns only Login tests: ✅/❌
- [ ] Count: ______

### D. Tag Filter Validation
- [ ] HappyPath filter returns only HappyPath tests: ✅/❌
- [ ] Count: ______

### E. Multi-Tag Filter Validation
- [ ] HappyPath + Smoke filter correct: ✅/❌
- [ ] Count: ______

### F. Suite Preview Validation
- [ ] Preview returns correct count: ✅/❌
- [ ] Matching tests shown: ______

### G. Suite Creation Validation
- [ ] Suite created: ✅/❌
- [ ] Suite ID: ________________
- [ ] Test count: ______
- [ ] Suite visible in list: ✅/❌

### H. Regression Validation
- [ ] Repository tree suites: ✅/❌
- [ ] Execution cycles: ✅/❌
- [ ] Versions: ✅/❌
- [ ] Save Draft: ✅/❌
- [ ] Comments: ✅/❌
- [ ] Jira Links: ✅/❌
- [ ] Dashboard: ✅/❌

### I. Performance Validation
- [ ] Search: _______ ms (target: < 500ms)
- [ ] Filter: _______ ms (target: < 500ms)
- [ ] Preview: _______ ms (target: < 1000ms)
- [ ] Create: _______ ms (target: < 2000ms)

---

## APPROVAL DECISION

**Phase 2 (UI) is APPROVED only if:**
- ✅ All checks in A-H are passing (✅)
- ✅ Performance metrics acceptable (< targets)
- ✅ No regression failures

**If any validation fails:**
1. Document the failure
2. Identify root cause
3. Fix in Phase 1
4. Re-run validation
5. Then proceed to Phase 2

---

## NEXT STEPS

After running all validations:

1. **Copy validation results above**
2. **Provide results in response**
3. **I will review and approve Phase 2**
4. **Then Phase 2 UI implementation begins**

DO NOT proceed to Phase 2 without passing all validations.

