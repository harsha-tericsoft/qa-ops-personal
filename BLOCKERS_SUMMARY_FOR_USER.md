# Filter-Based Suite Creation & Tag Sync: Status Report

**Date:** June 23, 2026  
**Status:** 🔴 **BLOCKED** - Cannot proceed without stakeholder decision  
**Blocker Type:** Requirements clarification (not a code bug)

---

## What You Need to Know (2-Minute Summary)

### The Problem
Two separate test datasets exist in the database:
1. **RoamTestCase** (2,982 records) - Tests imported from Roam Research
2. **TestCase** (141 records) - Unknown origin, appears to be seed/fixture data

**They have no relationship.** They're different tables with different IDs. The proposed tag sync migration assumed they were linked (they're not) and failed.

### The Impact
- ❌ Cannot synchronize tags (migration broke on broken assumption)
- ❌ Cannot build filter-based suite creation (unclear which dataset to filter)
- ❌ Cannot clarify data model (don't know which is "source of truth")

### What's Required
**Single decision needed:** Which dataset should filter-based suite creation use?
- Option A: RoamTestCase (2,982 real Roam-imported tests)
- Option B: TestCase (141 manual/fixture tests)
- Option C: Both somehow

**Once decided:** Implementation takes 2-3 days.

---

## Evidence Summary

### The Broken Migration (Commit 39a9754)

**What it tried to do:**
```sql
INSERT INTO "TagTestCase" ("tagId", "testCaseId")
SELECT t.id, tc.id  -- assumes RoamTestCase.id = TestCase.id
FROM "RoamTestCase" rtc
JOIN "TestCase" tc ON tc.id = rtc.id  ← ❌ WRONG
```

**Why it failed:**
- RoamTestCase has 2,982 unique IDs (e.g., `cmqorfa8702vk7kgcdd5okaiz`)
- TestCase has 141 unique IDs (e.g., `cmqos71nj00037kggz296atk9`)
- Zero ID overlap
- **JOIN returns 0 rows**

**Verification:** Run `node check-join.js` → returns `{ count: 0 }`

### The Missing Link (TestCaseNode)

**Expected:** RepositoryNode (Roam hierarchy) should link to TestCase via TestCaseNode
```
RepositoryNode --[TestCaseNode]--> TestCase
```

**Actual:** TestCaseNode table is completely empty
```
TestCaseNode.count = 0
```

**Implication:** TestCase records exist independently, NOT linked to Roam hierarchy.

### The Data Mismatch

| Table | Count | Purpose | Status |
|-------|-------|---------|--------|
| RoamTestCase | 2,982 | Roam imports | ✅ Complete, linked to RepositoryNode |
| TestCase | 141 | ??? | ❌ Disconnected, no tags, purpose unclear |
| Tag | 0 | Tags for filtering | ❌ Empty (migration failed) |
| TagTestCase | 0 | Tag links | ❌ Empty (migration failed) |
| TestCaseNode | 0 | RepositoryNode→TestCase | ❌ Empty (links missing) |

---

## Three Critical Questions

### Q1: Which Dataset for Filtering?
**RoamTestCase (2,982)?** or **TestCase (141)?** or **Both?**

#### If RoamTestCase (Real Roam Imports)
✅ Advantages:
- Complete dataset (2,982 tests from Roam)
- Already has tags (in array format)
- Directly linked to Roam hierarchy
- Clear origin

❌ Disadvantages:
- Need to verify data quality
- More tests to filter through

#### If TestCase (Unknown/Fixtures)
✅ Advantages:
- Already used in current execution pipeline
- Smaller dataset (141 tests)

❌ Disadvantages:
- No tags at all (Tag table empty)
- No link to Roam hierarchy
- Purpose unclear (why only 141?)
- Created 2026-06-22 (batch created, not incremental)

#### If Both
✅ Advantages:
- Use all tests available

❌ Disadvantages:
- Must define relationship
- Complex join logic
- Performance implications

---

### Q2: What Is TestCase's Intended Purpose?

#### Possibility A: Separate Fixture Data
"TestCase is for manual/offline testing, seed data, or fixtures. Keep it independent from Roam. Users should filter from RoamTestCase for Roam-based testing."

**Evidence for:** Different naming, smaller count, seems like test fixtures

#### Possibility B: Incomplete Mirror
"TestCase should be a complete copy of RoamTestCase for backward compatibility. Only 141 exist because the migration is incomplete. We should have all 2,982 RoamTestCases mirrored in TestCase."

**Evidence for:** ExecutionCycle uses TestCase (might indicate it should be comprehensive)

#### Possibility C: Legacy/Deprecated
"TestCase is old design that's being replaced. We're migrating to RoamTestCase as single source of truth. Eventually remove TestCase."

**Evidence for:** Dual design suggests migration in progress

---

### Q3: Should They Be Linked?

#### Option A: No Relationship (Coexist)
```
RoamTestCase ─ (separate) ─ TestCase
Use Roam                   Use manual
```

#### Option B: Link Them
```
TestCase.roamTestCaseId → RoamTestCase
(Add foreign key)
```

#### Option C: Consolidate
```
Use only RoamTestCase (remove TestCase)
Or: Use only TestCase (remove RoamTestCase)
```

---

## What Happens Next

### Phase 1: Get Stakeholder Decision (TODAY - 30-60 min)
**Meeting participants:** Product Manager, Architecture, anyone who understands TestCase origin

**Meeting agenda:**
1. Show this document's evidence
2. Answer Q1: Which dataset for filtering?
3. Answer Q2: TestCase's purpose?
4. Answer Q3: Relationship?
5. Document decisions

**Success:** 3 documented decisions, owner assigned for implementation

### Phase 2: Fix Migration (DAY 2-3)
Once Q1 is answered:

**If Answer = "Use RoamTestCase":**
```sql
-- Correct migration SQL
INSERT INTO "Tag" ... FROM RoamTestCase
-- (No TestCase involved)
```

**If Answer = "Use TestCase":**
```sql
-- Understand where TestCase data comes from
-- Populate tags somehow
-- Fix TestCaseNode links
```

**If Answer = "Use Both":**
```sql
-- Define join logic
-- Create appropriate relationships
```

### Phase 3: Validate & Deploy (DAY 4-5)
```bash
# Run migration on staging
# Verify Tag table populates (count > 0)
# Verify filtering works
# Verify execution cycles still work
# Verify versioning still works
# Deploy to production
```

---

## Immediate Actions (You Can Do Now)

### Action 1: Find TestCase Origin
```bash
# Who created 141 TestCase records?
git log --oneline --all | grep -i "testcase\|seed"
# Check database creation date: 2026-06-22

# Search for script that creates them
grep -r "createTestCase\|INSERT INTO.*TestCase" . --include="*.ts"
```

### Action 2: Document Findings
```
Create one-page summary of:
- Where 141 TestCases came from
- Why only 141 (vs 2,982 RoamTestCases)
- Original intent (fixture? backup? incomplete import?)
```

### Action 3: Schedule Decision Meeting
```
Calendar invite to:
- Product Manager
- Architecture Lead
- QA Lead
- Dev Team Lead

Subject: Critical Data Model Decision: TestCase vs RoamTestCase
Duration: 1 hour
Date: Today if possible
```

### Action 4: Prepare for Meeting
```
Print/share this document:
- CRITICAL_BLOCKER_EVIDENCE.md (detailed evidence)
- INVESTIGATION_SUMMARY_AND_BLOCKERS.md (full analysis)
This file (blockers summary)
```

---

## What NOT to Do

- ❌ Do NOT deploy the tag migration (commit 39a9754)
- ❌ Do NOT build UI for filtering yet
- ❌ Do NOT modify TestCase/TestCaseNode schema
- ❌ Do NOT assume the broken JOIN is the only problem
- ❌ Do NOT proceed "just to get something working"

---

## Timeline

| Timeline | Task | Owner | Status |
|----------|------|-------|--------|
| **Today** | Decision meeting | Product/Arch | ⏳ Pending |
| **Today** | Document decisions | Arch | ⏳ Pending |
| **Tomorrow** | Fix migration SQL | Engineer | ⏳ Blocked |
| **Day 2-3** | Test migration | QA | ⏳ Blocked |
| **Day 3-4** | Deploy to staging | DevOps | ⏳ Blocked |
| **Day 4** | Validate & approve | Product | ⏳ Blocked |
| **Day 5** | Deploy to production | DevOps | ⏳ Blocked |

**Critical Path:** Everything is blocked until the decision meeting is scheduled and completed.

---

## Contact & Escalation

**Blocker Owner:** Data Model Relationship (RoamTestCase vs TestCase)

**Escalation Path:**
1. First: Schedule decision meeting (this week)
2. If blocked: Escalate to Architecture Lead
3. If still blocked: Escalate to Product Lead

**Time Lost:** ⏱️ ~24 hours (acceptable - clarification needed)
**Risk of Proceeding Without Decision:** 🔴 HIGH (another failed migration, wrong data in filters)

---

## Key Documents

1. **CRITICAL_BLOCKER_EVIDENCE.md** - Detailed evidence with concrete queries
2. **INVESTIGATION_SUMMARY_AND_BLOCKERS.md** - Full analysis with 4 decision points
3. **ROAM_TESTCASE_MAPPING_INVESTIGATION.md** - Deep schema investigation
4. **This document** - Executive summary

---

## One-Sentence Recommendation

> **Schedule a 1-hour meeting with Product/Architecture today to decide: Should filter-based suite creation use RoamTestCase (real imports) or TestCase (unknown fixtures)? Once decided, implementation is 2-3 days.**

---

## Appendix: Proof of Separate Datasets

### Proof 1: ID Format Difference
```javascript
// RoamTestCase IDs (Prisma CUID format, created during import)
cmqorfa8702vk7kgcdd5okaiz
cmqorfbe402vm7kgcbf81vgqy

// TestCase IDs (Prisma CUID format, created 2026-06-22)
cmqos71nj00037kggz296atk9
cmqos727o00057kggay36dimf

// Analysis: Prefix differs (cmqor* vs cmqos*)
// Implication: Created at different times by different processes
```

### Proof 2: No ID Overlap
```sql
SELECT COUNT(DISTINCT rtc.id) FROM "RoamTestCase" rtc
WHERE rtc.id IN (SELECT id FROM "TestCase")

Result: 0 (confirmed: zero matches)
```

### Proof 3: Title Mismatch
```
RoamTestCase: "Test:: When I enter a valid email address..."
TestCase:    "Test: Admin Portal"

Different purposes, different naming conventions
```

### Proof 4: Tag Mismatch
```
RoamTestCase.tags: ["Manual", "Automated", ...] (has tags)
TestCase.tags: undefined (no tags)

Only RoamTestCase has tag data
```

### Proof 5: Hierarchy Mismatch
```
RoamTestCase → RepositoryNode: ✅ Works (2,982 mappings)
TestCase → RepositoryNode: ❌ Missing (0 TestCaseNode records)

TestCase never linked to Roam hierarchy
```

---

**Status:** 🔴 **CRITICAL BLOCKER - AWAITING STAKEHOLDER DECISION**

**Next Step:** Schedule decision meeting TODAY.
