# Tag Synchronization & Filter-Based Suite Creation: Investigation Summary & Blockers

**Date:** 2026-06-23
**Status:** CRITICAL BLOCKER - Cannot Proceed Until Relationship Is Defined
**Severity:** 🔴 HIGH

---

## Executive Summary

The proposed tag synchronization migration and filter-based suite creation feature **cannot proceed** because the fundamental data model relationship is undefined:

- **RoamTestCase** (2,982 records) - Roam-imported test cases
- **TestCase** (141 records) - Manually-created or seeded test cases
- **Relationship:** ❌ NONE - They are completely separate datasets with no link

The broken migration attempted to assume `TestCase.id = RoamTestCase.id`, which is incorrect and returns 0 results.

---

## Critical Findings

### Finding #1: Two Completely Separate Datasets

#### RoamTestCase Table (2,982 records)
```
Linking: RoamTestCase.repositoryNodeId → RepositoryNode (1:1, working)
Example: "Test:: When I enter a valid email address in the email field..."
Tags: Stored in RoamTestCase.tags (String array)
Origin: Imported from Roam Research sync
Status: ✅ COMPLETE - Ready for use
```

#### TestCase Table (141 records)
```
Linking: TestCase (?) → TestCaseNode (?) → RepositoryNode
Actual: TestCaseNode.count = 0 (NO LINKS EXIST)
Example: "Test: Admin Portal", "Test: Customer Portal"
Tags: None (Tag table is empty: 0 records)
Origin: Unknown (possibly seed data or manual test fixtures)
Status: ❌ DISCONNECTED - Not linked to Roam hierarchy
```

### Finding #2: The Broken Chain

**Expected Chain:**
```
RoamTestCase
  └─ repositoryNodeId (✅ exists)
    └─ RepositoryNode
      └─ TestCaseNode (❌ empty - 0 records)
        └─ TestCase
```

**Actual Query Result:**
```sql
SELECT COUNT(*) FROM "RoamTestCase" rtc
LEFT JOIN "TestCaseNode" tcn ON tcn."nodeId" = rtc."repositoryNodeId"
LEFT JOIN "TestCase" tc ON tc.id = tcn."testCaseId"
```

**Result:** 20 rows tested, ALL have:
- testCaseId = NULL
- title = NULL

**Implication:** TestCase records exist independently and are NOT linked to the Roam hierarchy.

### Finding #3: The Broken Migration

**Migration:** commit `39a9754` - "Tag synchronization migration for Phase 1"

**The Failing SQL:**
```sql
JOIN "TestCase" tc ON tc.id = rtc.id
```

**Why It Fails:**
- RoamTestCase has 2,982 UUIDs (e.g., `cmqorfa8702vk7kgcdd5okaiz`)
- TestCase has 141 different UUIDs (e.g., `cmqos71nj00037kggz296atk9`)
- Assumption is wrong: `RoamTestCase.id ≠ TestCase.id`
- Query returns 0 rows

**Consequences:**
- No Tag records created (0 tags in Tag table)
- No TagTestCase relationships created (0 in TagTestCase table)
- RoamTestCase.tags never synchronized to Tag table
- Filtering cannot be built on empty Tag table

---

## The Core Problem: Unknown Data Model Intent

Three possible interpretations of the current system:

### Option A: Separate Datasets (Coexistence)
```
RoamTestCase (Roam imports) ── exist separately ── TestCase (manual/fixtures)
     2,982 records                                     141 records
        ↓                                                 ↓
     Use for Roam           Use for manual testing/fixtures
     hierarchy filtering
```

**If this is correct:**
- Filter suite creation should work on RoamTestCase (2,982 records)
- TestCase is for separate purposes (seed data? manual tests?)
- Tag sync should target RoamTestCase.tags

### Option B: TestCase Should Mirror RoamTestCase
```
RoamTestCase → (should create) → TestCase
   2,982 records                 141 records
   
Problem: Only 141 of 2,982 exist in TestCase
```

**If this is correct:**
- TestCase is incomplete (missing 2,841 records)
- Need import/sync process to create missing TestCases
- Tag sync should wait for TestCase to be complete
- Must clarify why only 141 exist

### Option C: Link Should Be Created
```
RoamTestCase ──────→ (new relationship) ──────→ TestCase
     2,982                                          141
     
Problem: Relationship would be 2,982 → 141 (many-to-one?)
```

**If this is correct:**
- Need to define: multiple RoamTestCases per TestCase?
- Must clarify mapping logic
- Schema change required
- Requires careful migration plan

---

## Data Timestamp Analysis

### TestCase Creation Timeline
- **2026-06-22:** 132 records created
- **2026-06-23:** 9 records created

**Insight:** These were batch-created, suggesting:
- Seed data or test fixtures
- Manual bulk import
- API script or database script

**Finding:** No matching timestamps in RoamTestCase or RepositoryNode logs to correlate creation.

---

## Current System State

### What's Working
✅ Roam sync → RoamTestCase (2,982 records)
✅ RoamTestCase → RepositoryNode (working links)
✅ TestCase → ExecutionCycle → TestRun (execution pipeline works)
✅ TestCase → SuiteTestCase (suite creation works)

### What's Broken
❌ Tag synchronization (migration failed)
❌ Tag table empty (0 records, should have tags)
❌ TagTestCase empty (0 records, should have links)
❌ TestCase → RepositoryNode (0 TestCaseNode records)
❌ RoamTestCase → TestCase (no relationship defined)

### What's Unclear
❓ Which dataset should filtering use?
❓ Why are there two test case tables?
❓ What is TestCase's intended purpose?
❓ Where did 141 TestCase records come from?
❓ Should they be linked or remain separate?

---

## Blocker Details

### Blocker #1: Cannot Create Tag Table Without Source Clarity

**The Question:** Which test cases should have tags?
- RoamTestCase (2,982 with actual tags in array)? ← Seems like this
- TestCase (141 with no tags)? ← Unclear

**The Implication:** 
```sql
INSERT INTO "TagTestCase" ("tagId", "testCaseId")
  -- Which table should testCaseId reference?
  -- TagTestCase.testCaseId is FK to TestCase table
  -- But RoamTestCase has the actual tags!
```

**The Problem:** 
- If we use RoamTestCase.tags, we can't insert to TagTestCase (wrong table)
- If we use TestCase tags, there are no tags to sync (0 tags)
- If we create a new TagRoamTestCase table, it's a schema change

### Blocker #2: Cannot Build Filter-Based Suite Creation Without Knowing Source

**Requirement:** "Filter test cases by tags, modules, features"

**Question:** Filter which table?
```
POST /api/test-suites/from-filters
  filters: { tags: ["Manual", "Smoke"], module: "Authentication" }
  
  --> Search RoamTestCase (2,982 available)?
  --> Search TestCase (141 available)?
  --> Join them somehow?
```

**The Implication:**
- If RoamTestCase: Need to add module/feature fields to RoamTestCase
- If TestCase: Need to understand where TestCase data should come from
- If both: Need to define how they relate

### Blocker #3: Cannot Guarantee Data Consistency

**Concern:** If we proceed without clarity:
- Migration might fail again (wrong assumption)
- Filters might return wrong data
- Users might see duplicates or missing tests
- Versioning/execution cycles might break

---

## Required Decisions (Before Implementation)

**DECISION 1:** Source of Truth
- [ ] Decision: Filter-based suite creation should use **RoamTestCase** OR **TestCase** OR **both**
- Owner: Product/Requirements
- Impact: Determines entire implementation approach

**DECISION 2:** TestCase Purpose
- [ ] Decision: TestCase table should be:
  - [ ] A: Separate fixtures/seed data (independent of RoamTestCase)
  - [ ] B: Automatically synced mirror of RoamTestCase (for backward compat)
  - [ ] C: Deprecated (remove and use RoamTestCase directly)
  - [ ] D: Something else (specify)
- Owner: Architecture
- Impact: Determines data model and migration strategy

**DECISION 3:** Relationship Definition
- [ ] Decision: Relationship between RoamTestCase and TestCase:
  - [ ] A: No relationship (separate datasets)
  - [ ] B: Foreign key link (TestCase.roamTestCaseId)
  - [ ] C: ID alignment (TestCase should have RoamTestCase IDs)
  - [ ] D: Something else (specify)
- Owner: Architecture
- Impact: Determines schema and join queries

**DECISION 4:** Schema Changes
- [ ] Decision: Are schema changes allowed?
  - [ ] A: Only additive (no breaking changes)
  - [ ] B: Can modify TestCase/TestCaseNode
  - [ ] C: Can create new relationships
- Owner: Architecture
- Impact: Determines migration feasibility

---

## Recommended Investigation Steps

### Step 1: Historical Analysis (1-2 hours)
```bash
# Find where 132 TestCases from 2026-06-22 came from
- Check git history for seed data or database scripts
- Check API logs for POST /api/test-cases calls
- Check if there was a migration that created them
- Look for any documentation about TestCase purpose
```

### Step 2: Correlation Analysis (1 hour)
```bash
# Check if TestCase titles correlate with RoamTestCase titles
SELECT tc.title, COUNT(rtc.id) as matching_roams
FROM "TestCase" tc
LEFT JOIN "RoamTestCase" rtc 
  ON rtc.title ILIKE CONCAT('%', tc.title, '%')
GROUP BY tc.title

# If matches exist: TestCase might be a summary/rollup
# If no matches: TestCase are truly separate
```

### Step 3: Feature Requirements Clarification (1-2 hours)
```
Interview stakeholders:
- "Should users filter tests from Roam imports or manual tests?"
- "Why do we have 141 TestCases if we have 2,982 RoamTestCases?"
- "Is TestCase meant to be a filtered/curated subset of RoamTestCase?"
- "Should new test cases be created in TestCase or RoamTestCase?"
```

### Step 4: Architecture Decision (1 hour)
```
Based on findings above:
- Define which dataset is source of truth
- Define how to handle tags
- Define whether relationship needs to be created
- Plan migration/implementation strategy
```

---

## Proposed Remediation Path

### Phase 1: Decision & Analysis (Day 1)
1. Get stakeholder decisions on DECISION 1-4 above
2. Run correlation analysis to understand TestCase origin
3. Document findings in architecture decision record

### Phase 2: Clarify Schema (Day 2)
Based on decisions:
- **If Option A (Separate):** No schema changes, use RoamTestCase for filtering
- **If Option B (Mirror):** Complete TestCase, then sync tags
- **If Option C (Link):** Add relationship, then tag sync becomes clear

### Phase 3: Implement (Days 3+)
Once schema is clear:
1. Fix tag migration (new SQL based on correct join)
2. Build filter APIs (pointing to correct table)
3. Build filter-based suite creation UI
4. Test with both datasets (if both exist)

### Phase 4: Validate (Day N-1)
- Run tag migration on staging
- Verify Tag table populates correctly
- Verify filter queries return correct results
- Run full regression on execution cycles/versioning

---

## Risks of Proceeding Without Clarity

### Risk 1: Migration Failure (Again)
- Migration could fail with wrong assumption
- Database could be in inconsistent state
- Would need rollback and retry

### Risk 2: Wrong Data in Filters
- If filtering RoamTestCase, users might not find suites created from TestCase
- If filtering TestCase, users might not find real Roam-imported tests
- Users confused by missing or unexpected results

### Risk 3: Execution Pipeline Breaking
- If we modify TestCase/TestCaseNode without understanding impact
- Existing test runs might fail
- Versioning might break
- Dashboard metrics might become incorrect

### Risk 4: Scalability Issues
- If we create artificial joins between 2,982 + 141 records
- If we duplicate tags between two sources
- Maintenance and sync becomes complex

---

## Conclusion

**The fundamental question must be answered first:**

> **Which dataset should filter-based suite creation use: RoamTestCase or TestCase?**

Once this is known:
- ✅ Tag synchronization strategy becomes clear
- ✅ Filter API design becomes clear
- ✅ Schema changes (if any) become clear
- ✅ Migration can be built correctly
- ✅ Implementation can proceed safely

**Do not deploy any code or migrations until this decision is made and documented.**

---

## Artifacts for Review

- **ROAM_TESTCASE_MAPPING_INVESTIGATION.md** - Detailed schema analysis
- **check-join.js** - Confirms broken JOIN returns 0 rows
- **investigate-mapping.js** - Confirms TestCaseNode chain is empty
- **verify-schema3.js** - Confirms data counts and relationships

---

## Next Action

Schedule decision meeting with stakeholders to answer:
1. Which dataset for filtering? (RoamTestCase vs TestCase)
2. What is TestCase's intended purpose?
3. Can schema be modified?
4. Should relationship be created?

Once decisions are documented, implementation can proceed confidently.
