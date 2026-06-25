# Critical Blocker: RoamTestCase ↔ TestCase Relationship - Evidence & Next Steps

**Investigation Date:** 2026-06-23
**Status:** 🔴 CRITICAL BLOCKER - Filter-based suite creation and tag sync cannot proceed
**Time to Resolution:** Requires stakeholder decision (same-day with meeting)

---

## The Problem in One Sentence

**The tag synchronization migration failed because it assumed RoamTestCase and TestCase have matching IDs, but they are completely separate datasets with 0 correlation.**

---

## Concrete Evidence

### Evidence #1: Broken Migration Query

**File:** `prisma/migrations/20260623_tag_synchronization/migration.sql` (line 34)

```sql
JOIN "TestCase" tc ON tc.id = rtc.id  ← ❌ WRONG ASSUMPTION
```

**Test to Verify Failure:**
```bash
node check-join.js
# Output: { count: 0 } ← Confirms 0 matches
```

**Expected:** Should join 2,982+ rows (all RoamTestCases)
**Actual:** Joins 0 rows (proves IDs don't match)

---

### Evidence #2: Separate ID Sets (No Correlation)

**RoamTestCase IDs (sample):**
```
cmqorfa8702vk7kgcdd5okaiz
cmqorfbe402vm7kgcbf81vgqy
cmqorfchk02vo7kgcx2hmlwh8
cmqorfdky02vs7kgc7zymb54p
...2,978 more unique IDs...
```

**TestCase IDs (sample):**
```
cmqos71nj00037kggz296atk9
cmqos727o00057kggay36dimf
cmqos72ru00077kgg34jjfizk
cmqos72ud00097kgg7ry2mhz0
...137 more unique IDs...
```

**Result:** Zero ID overlap detected

---

### Evidence #3: Broken Chain - TestCaseNode Query

**Query:** 
```sql
SELECT * FROM "RoamTestCase" rtc
LEFT JOIN "TestCaseNode" tcn ON tcn."nodeId" = rtc."repositoryNodeId"
LEFT JOIN "TestCase" tc ON tc.id = tcn."testCaseId"
LIMIT 20
```

**Test to Run:**
```bash
node investigate-mapping.js
```

**Result:** All 20 rows show:
```
roam_test_case_id: (value)
repositoryNodeId: (value)
testCaseId: NULL ← Every row!
title: NULL ← Every row!
```

**Why This Matters:**
- testCaseId is NULL → No TestCaseNode records exist
- title is NULL → No TestCase linked to any RepositoryNode
- This proves TestCase is NOT linked to the Roam hierarchy

---

### Evidence #4: Data Count Mismatch

**Actual Database Counts:**
```
RoamTestCase:     2,982 records
TestCase:         141 records
TestCaseNode:     0 records
Tag:              0 records
TagTestCase:      0 records
```

**Ratios That Prove Separation:**
- If TestCase were a subset of RoamTestCase → 141 should have links to Roam
- Actual: 141 TestCases have 0 links to RepositoryNode (TestCaseNode.count = 0)
- Conclusion: 141 TestCases are completely independent

---

### Evidence #5: Different Data Contents

**RoamTestCase Titles:**
```
"Test:: When I enter a valid email address in the email field, it must be accepted. #Manual"
"Test:: When I enter an invalid email format in the email field, an error message must be displayed. #Manual"
"Test:: When I enter a valid password in the password field, it must be accepted. #Manual"
```
(Real imported test cases from Roam)

**TestCase Titles:**
```
"Test: Test::"
"Test: Admin Portal"
"Test: Customer Portal"
"Test: " (generic)
```
(Generic/fixture test data)

**Analysis:**
- Different naming conventions
- Different granularity (detailed vs. generic)
- Different purposes (Roam vs. fixtures)

---

### Evidence #6: Tags Only Exist in RoamTestCase

**RoamTestCase Tags (working):**
```javascript
{
  id: "cmqorfchk02vo7kgcx2hmlwh8",
  title: "Test:: When I enter a valid email...",
  tags: ["Manual"]  ← TAGS HERE (working)
}
```

**TestCase Tags (missing):**
```javascript
{
  id: "cmqos71nj00037kggz296atk9",
  title: "Test: Test::",
  tags: undefined  ← NO TAGS
}
```

**Tag Table Status:**
```
SELECT COUNT(*) FROM "Tag" → 0
SELECT COUNT(*) FROM "TagTestCase" → 0
```

**Conclusion:** If we try to sync TestCase tags, there's nothing to sync. Only RoamTestCase has tags.

---

## Why The Migration Failed

### The Flawed Assumption Chain

```
❌ Assumption 1: "TestCase records come from RoamTestCase"
   └─ No evidence, contradicted by data

❌ Assumption 2: "TestCase.id = RoamTestCase.id"
   └─ Proven false: 2,982 vs 141, different UUIDs

❌ Assumption 3: "We can JOIN on ID"
   └─ JOIN returns 0 rows

❌ Assumption 4: "TagTestCase.testCaseId can be populated from RoamTestCase.tags"
   └─ Can't populate with wrong data
```

### What Actually Happened

1. Migration started
2. Tried to extract tags from RoamTestCase (this part works)
3. Tried to create Tag records (this part works if no duplicates)
4. **Tried to JOIN RoamTestCase.id = TestCase.id** ← Failed here
5. TagTestCase insert failed because JOIN returned 0 rows
6. Migration likely rolled back or left database inconsistent
7. Tag table remains empty (0 records)

---

## The Three Critical Questions

### Question 1: Which Dataset Should Filtering Use?

**Option A:** RoamTestCase (2,982 records)
```
Pros: Complete dataset, has tags, from Roam (authoritative)
Cons: Need to verify Roam hierarchy is correct
```

**Option B:** TestCase (141 records)
```
Pros: Simpler, already in use for execution cycles
Cons: No tags, unclear origin, seems like fixtures
```

**Option C:** Both (somehow)
```
Pros: Use real tests + fixtures
Cons: Complex, need to define relationship, merge logic
```

**Status:** ❓ NO DECISION YET

---

### Question 2: What Is TestCase's Intended Purpose?

**Possibility A:** Separate test fixtures/seed data
```
Role: Independent from Roam, for manual testing/fixtures
Creation: Manually added or seeded during setup
Link to Roam: None (intentional separation)
Implication: Filter from RoamTestCase, use TestCase for separate workflows
```

**Possibility B:** Incomplete mirror/copy of RoamTestCase
```
Role: Backup or filtered copy of RoamTestCase
Creation: Automated process that should have created all 2,982
Current: Only 132 created on 2026-06-22 (incomplete)
Implication: Need to complete migration and sync tags to this copy
```

**Possibility C:** Legacy/deprecated table
```
Role: Old system, being phased out
Creation: Pre-existing from old design
Current: Gradually being replaced by RoamTestCase
Implication: Stop using TestCase, move everything to RoamTestCase
```

**Status:** ❓ NO DECISION YET

---

### Question 3: What Relationship Should Exist?

**Option A:** No relationship (coexist independently)
```
RoamTestCase ─── (separate) ─── TestCase
   Use Roam                      Use manual/fixtures
```

**Option B:** Parent-child link (one-to-many)
```
RoamTestCase ──→ TestCase (add foreign key)
   "Source"        "Derived"
```

**Option C:** Merge datasets (consolidate)
```
TestCase removed, use RoamTestCase for everything
Or: RoamTestCase removed, use TestCase for everything
```

**Status:** ❓ NO DECISION YET

---

## Immediate Action Items

### ✋ STOP: Do NOT Do These

- [ ] ❌ Do not deploy any tag migration
- [ ] ❌ Do not run the broken SQL migration
- [ ] ❌ Do not build filtering on empty Tag table
- [ ] ❌ Do not assume TestCase.id = RoamTestCase.id
- [ ] ❌ Do not create UI expecting tags in TestCase

### 🎯 DO: Schedule Stakeholder Decision Meeting

**Meeting Agenda:**
1. Show Evidence #1-6 (above)
2. Ask Question 1: Which dataset for filtering? (A, B, or C)
3. Ask Question 2: TestCase's purpose? (A, B, or C)
4. Ask Question 3: What relationship? (A, B, or C)
5. Identify owner for each decision
6. Set implementation timeline

**Meeting Duration:** 30-60 minutes
**Required Attendees:** Product, Architecture, whoever understands TestCase origin

**Success Criteria:** 
- ✅ Decision documented for each question
- ✅ Recorded in architecture decision record
- ✅ Owner identified for implementation

---

## After Decision: Implementation Path

### If Decision = "Use RoamTestCase for Filtering"
```
1. Update migration to use RoamTestCase
   JOIN "Tag" t ON t.name = tag_name AND t."projectId" = rtc."projectId"
   -- Do NOT join TestCase

2. Build APIs pointing to RoamTestCase
   GET /api/test-cases/search → query RoamTestCase
   GET /api/test-cases/filter-options → aggregate RoamTestCase.tags

3. Test tag sync
   SELECT COUNT(*) FROM "Tag" WHERE "projectId" = ? → should be > 0

4. Test filtering
   GET /api/test-cases/search?tags=Manual → returns RoamTestCases with tag
```

### If Decision = "Use TestCase for Filtering"
```
1. Understand where 141 TestCases come from
   Query git history, API logs, database scripts

2. Decide: Complete to 2,982 or stay at 141?
   If complete: Need process to create missing 2,841
   If stay: Keep as separate fixture dataset

3. Populate tags into TestCase
   Need source: Roam imports? Manual? Somewhere else?

4. Create TestCaseNode links (currently 0)
   Link TestCase to RepositoryNode via TestCaseNode
```

### If Decision = "Use Both"
```
1. Define relationship
   Foreign key? Views? Application-layer merge?

2. Decide which is "primary"
   Where does filtering start? Where do tags come from?

3. Create join logic
   Application-level or database-level?

4. Test both paths
   Ensure filtering works from either dataset
```

---

## Risk Summary

| Risk | If Proceed Without Decision | Severity |
|------|---------------------------|----------|
| **Wrong data in filters** | Users filter from wrong dataset | 🔴 HIGH |
| **Another migration failure** | Database corruption, rollback needed | 🔴 HIGH |
| **Broken execution cycles** | Tests don't run, versioning fails | 🔴 HIGH |
| **Incomplete solution** | Feature works for one dataset, not other | 🟠 MEDIUM |
| **Tech debt** | Hard to refactor later if wrong | 🟠 MEDIUM |

---

## Reference Materials

**Investigation Documents:**
- `ROAM_TESTCASE_MAPPING_INVESTIGATION.md` - Detailed schema analysis
- `INVESTIGATION_SUMMARY_AND_BLOCKERS.md` - Full analysis with 4 decisions
- `CRITICAL_SCHEMA_ANALYSIS.md` - Earlier schema findings

**Test Scripts:**
- `check-join.js` - Confirms JOIN returns 0 rows
- `investigate-mapping.js` - Confirms TestCaseNode is empty
- `verify-schema3.js` - Shows data counts and relationships

**Git Evidence:**
- Commit `39a9754`: Tag synchronization migration (the broken one)
- Files: `prisma/migrations/20260623_tag_synchronization/migration.sql`

---

## Timeline

| Phase | Timeline | Owner |
|-------|----------|-------|
| **Decision Meeting** | Today (2026-06-23) | Product/Architecture |
| **Document Decision** | Same day | Architecture |
| **Fix Migration SQL** | Day 2 | Engineering |
| **Test Migration** | Day 2-3 | QA |
| **Deploy to Staging** | Day 3 | DevOps |
| **Validate & Approve** | Day 4 | Product |
| **Deploy to Production** | Day 4-5 | DevOps |

**Blocker:** Cannot move past "Decision Meeting" until questions are answered.

---

## Conclusion

**The core issue is resolvable but requires a conscious decision about data model.**

This is not a technical failure — the schema is sound, the code is fine. It's a **requirements clarification issue**: we have two test datasets and haven't decided which to use for filtering.

**Once the stakeholder meeting answers the three questions, implementation becomes straightforward and low-risk.**

**Schedule the meeting today. Implementation can begin tomorrow.**
