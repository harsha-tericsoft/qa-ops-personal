# RoamTestCase ↔ TestCase Mapping Investigation

**Date:** 2026-06-23
**Status:** CRITICAL FINDINGS - Two Separate Datasets

---

## CRITICAL DISCOVERY

### The Database Contains TWO COMPLETELY SEPARATE Test Datasets

#### Dataset 1: RoamTestCase (2982 records)
- **Source:** Imported from Roam Research via sync process
- **IDs:** Randomly generated (e.g., `cmqorfa8702vk7kgcdd5okaiz`)
- **Linking:** Via `repositoryNodeId` → `RepositoryNode` (one-to-one)
- **Titles:** Real test cases from Roam
  - "Test:: When I enter a valid email address in the email field, it must be accepted. #Manual"
  - "Test:: When I enter an invalid email format in the email field, an error message must be displayed. #Manual"
  - etc.
- **Tags:** Stored in `RoamTestCase.tags` array (String[])
  - Examples: ["Manual"], ["Automated"], etc.
- **TestCaseNode Links:** NOT USED (0 TestCaseNode records exist)

#### Dataset 2: TestCase (141 records)
- **Source:** Manually created or imported from unknown source
- **IDs:** Randomly generated (e.g., `cmqos71nj00037kggz296atk9`)
- **Linking:** Via `TestCaseNode` → `RepositoryNode` (many-to-many)
- **TestCaseNode Records:** **ZERO** - No links exist!
- **Titles:** Generic/abbreviated test cases
  - "Test: Test::"
  - "Test: Admin Portal"
  - "Test: Customer Portal"
  - "Test: When I use the "Forgot Password" flow with a valid OTP, the system must allow me to reset the password. #Manual"
- **Tags:** Linked via `TagTestCase` table (currently empty)
  - No Tag records exist (0)
  - No TagTestCase records exist (0)
- **Usage:** In suites (136/141) and test runs (102/141)

### The Broken Migration

**Commit:** `39a9754` - "feat: Add tag synchronization migration for Phase 1"

**The Problem Query:**
```sql
INSERT INTO "TagTestCase" ("tagId", "testCaseId")
SELECT
  t.id,
  tc.id
FROM "RoamTestCase" rtc
CROSS JOIN LATERAL UNNEST(rtc.tags) WITH ORDINALITY AS tag_name
JOIN "Tag" t ON t.name = tag_name AND t."projectId" = rtc."projectId"
JOIN "TestCase" tc ON tc.id = rtc.id  ← ❌ BROKEN!
WHERE rtc.tags IS NOT NULL AND array_length(rtc.tags, 1) > 0
```

**Why It Fails:**
1. Assumes `RoamTestCase.id = TestCase.id`
2. RoamTestCase has 2982 records
3. TestCase has 141 records
4. IDs are completely different UUIDs
5. JOIN returns 0 rows

---

## Investigation Results

### Data Mapping Status

**Query Result:**
```sql
SELECT COUNT(*) FROM "RoamTestCase" rtc
JOIN "TestCase" tc ON tc.id = rtc.id
```

**Result:** 0 rows (confirmed earlier)

### RepositoryNode Relationships

#### RoamTestCase → RepositoryNode
- **Status:** ✅ DIRECT ONE-TO-ONE LINK EXISTS
- **Via:** `RoamTestCase.repositoryNodeId` (unique foreign key)
- **Count:** 2982 valid mappings
- **Example:**
  ```
  RoamTestCase (cmqorfa8702vk7kgcdd5okaiz)
    └─ repositoryNodeId: cmqoreqj3000g7kgcoxbb130z
       └─ RepositoryNode (FILE type, name: "Test::")
  ```

#### TestCase → RepositoryNode
- **Status:** ❌ NO LINKS EXIST
- **Via:** `TestCaseNode` junction table (should link via testCaseId → nodeId)
- **Count:** 0 records in TestCaseNode
- **Implication:** TestCases are NOT linked to RepositoryNode hierarchy
- **Implication:** TestCases exist independently of Roam import tree

### Tags Status

| Table | Count | Status |
|-------|-------|--------|
| `Tag` | 0 | ❌ Empty - no tags created yet |
| `TagTestCase` | 0 | ❌ Empty - no links created yet |
| `RoamTestCase.tags` | 2982 with tags | ✅ Contains actual tag data (String array) |

**Tag Examples from RoamTestCase:**
- "Manual"
- "Automated"
- (stored as String[] in RoamTestCase.tags)

---

## Key Questions Answered

### Q1: Where does TestCase data come from?
**Answer:** Unknown. They exist in database but:
- Not created via API endpoints (only one POST endpoint exists)
- Created in batch on 2026-06-22 (132 records) and 2026-06-23 (9 records)
- Not linked to RepositoryNode (0 TestCaseNode records)
- Titles suggest test data/fixtures (Admin Portal, Customer Portal)

### Q2: What is the intended relationship between RoamTestCase and TestCase?
**Answer:** Currently **NO RELATIONSHIP** - they're independent:
- RoamTestCase is imported from Roam (2982 records)
- TestCase is manually maintained or seeded (141 records)
- No foreign key relationship exists
- No shared IDs or common reference

### Q3: Which should be the source of truth for tags?
**Answer:** Currently **RoamTestCase.tags** is the only actual tag data:
- RoamTestCase.tags contains real tag values (array of strings)
- TestCase has no tags (TagTestCase is empty)
- If filtering is needed, RoamTestCase should be the source

### Q4: Why is the migration broken?
**Answer:** Incorrect assumption about data structure:
- Migration assumes `TestCase` records were created from `RoamTestCase` records
- Migration assumes `TestCase.id = RoamTestCase.id`
- Actually, `TestCase` and `RoamTestCase` are separate datasets with different IDs
- Migration should have linked tags to `RoamTestCase`, not `TestCase`

### Q5: What should the tag migration actually do?
**Answer:** Depends on use case:

**Option A: If filtering tags from Roam imports**
```sql
-- Create tags from RoamTestCase
INSERT INTO "Tag" SELECT unique tags from RoamTestCase
INSERT INTO "TagTestCase" 
  WHERE testCaseId points to RoamTestCase (need new relationship)
```
**Problem:** TagTestCase.testCaseId is foreign key to TestCase, not RoamTestCase

**Option B: If filtering tags from manual test cases**
```sql
-- TestCase should have tags populated somehow
-- But currently 0 tags exist in TestCase
-- Need to understand where TestCase.tags should come from
```
**Problem:** TestCase has no tags and no link to tags

**Option C: Create link between RoamTestCase and TestCase**
```sql
-- Add field to TestCase: roamTestCaseId
-- Link TestCase → RoamTestCase
-- Then migrate tags
```
**Problem:** Would require schema change, and relationship unclear

---

## Current System Status

### What Works
- ✅ Roam import creates RoamTestCase records correctly (2982 records)
- ✅ RepositoryNode hierarchy captures Roam tree structure
- ✅ TestCase table exists and is used in suites/runs (141 records)
- ✅ ExecutionCycle → TestCase → TestRun pipeline works
- ✅ All existing test runs and cycles are operational

### What's Broken
- ❌ Tag synchronization migration (wrong JOIN assumption)
- ❌ No tags in Tag table (migration never ran successfully)
- ❌ No link between RoamTestCase and TestCase
- ❌ No link between TestCase and RepositoryNode (0 TestCaseNode records)

### What's Unclear
- ❓ Which dataset should be used for new "filter-based suite creation"?
- ❓ Should filtering work on RoamTestCase (Roam imports) or TestCase (manual)?
- ❓ How do manually-created TestCases relate to the Roam hierarchy?
- ❓ Where did the 141 TestCase records come from?

---

## Recommendations

### BEFORE implementing filter-based suite creation:

1. **Clarify Business Logic**
   - Should users filter from Roam-imported tests (2982 records)? → Use RoamTestCase
   - Should users filter from manually-maintained tests (141 records)? → Use TestCase
   - Or should they create a relationship between them?

2. **Fix Tag Migration**
   - If using RoamTestCase: Need to add schema to support tags on TestCase or link RoamTestCase to TestCase
   - If using TestCase: Need to populate TestCase.tags from somewhere (Roam? Manual entry?)
   - Decision needed on source of truth

3. **Investigate TestCase Origin**
   - Query database for creation method of the 141 TestCase records
   - Determine if they should remain separate or be merged with RoamTestCase
   - Understand intended role (fixture data? manual tests? hybrid?)

4. **Plan Next Steps**
   - Do NOT deploy tag migration until relationship is clear
   - Do NOT assume TestCase and RoamTestCase are linked
   - Do NOT assume TagTestCase.testCaseId should come from RoamTestCase
   - Interview stakeholders on intended filtering behavior

---

## Schema Analysis

### Current Relationships

```
RoamTestCase
  ├─ projectId → Project
  ├─ repositoryNodeId → RepositoryNode (ONE-TO-ONE, actual link)
  └─ tags: String[] (source of truth)

RepositoryNode
  ├─ projectId → Project
  ├─ repositoryId → Repository
  ├─ parentId → RepositoryNode (self-referential tree)
  ├─ testCases → TestCaseNode[] (should have links, but empty!)
  └─ testCase → RoamTestCase? (only relates to Roam, not TestCase!)

TestCase
  ├─ projectId → Project
  ├─ nodes → TestCaseNode[] (EMPTY - no links!)
  ├─ testRuns → TestRun[] (used - 102 runs)
  ├─ suites → SuiteTestCase[] (used - 136 in suites)
  └─ tags → TagTestCase[] (EMPTY - 0 tags)

Tag
  ├─ projectId → Project
  ├─ testCases → TagTestCase[] (EMPTY)
  └─ status: NEVER POPULATED

TagTestCase
  ├─ tagId → Tag (would be used here)
  └─ testCaseId → TestCase (0 records)
```

### Missing Link Analysis

**What exists:**
- RoamTestCase → RepositoryNode (direct, working)
- TestCase → TestRun (working)
- TestCase → SuiteTestCase (working)

**What's missing:**
- TestCase → RepositoryNode (TestCaseNode is empty)
- TestCase → RoamTestCase (no foreign key exists)
- Tag ← TagTestCase (empty, needs population)
- RoamTestCase → Tag (no direct relationship)

---

## Next Investigation Steps

1. **Find where TestCase records were created**
   - Check API logs or seed scripts
   - Look for batch creation pattern
   - Determine if intentional or accidental duplication

2. **Verify if TestCase should use RoamTestCase as source**
   - Run: `SELECT * FROM "TestCase" WHERE title ILIKE '%Test::%'`
   - Compare with RoamTestCase titles
   - Determine if correlation exists

3. **Check if TestCaseNode should be populated**
   - Query: Are TestCase records supposed to map to RepositoryNodes?
   - Why is TestCaseNode table completely empty?
   - Should hierarchy navigation use TestCase or RoamTestCase?

4. **Interview stakeholders**
   - "Which dataset should filter-based suite creation use?"
   - "Why do we have two test case tables?"
   - "Are TestCase records automatically created from RoamTestCase?"
   - "How should tags flow from Roam imports to filtering?"

---

## Conclusion

**The RoamTestCase ↔ TestCase relationship is NOT what the migration assumed.**

Current facts:
- ❌ They are NOT the same records with same IDs
- ❌ They do NOT have a direct link via foreign key
- ❌ They are TWO COMPLETELY SEPARATE DATASETS
- ✅ RoamTestCase has valid tags (in String[] format)
- ✅ RoamTestCase has valid RepositoryNode links
- ❓ TestCase purpose and origin unclear

**Do not proceed with tag migration or filter-based suite creation until the actual relationship is defined.**
