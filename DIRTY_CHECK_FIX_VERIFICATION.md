# Dirty-Check Fix Verification Report

## Issue Identified

All 3728 RepositoryNodes were being marked for update on every Refresh Sync, causing:
- Spurious database updates  
- Extremely slow sync (sequential updates)
- Never-resolving sync requests (hung at update phase)

## Root Cause Analysis

The dirty-check logic was comparing fields WITHOUT proper value normalization:

**Before Fix:**
```typescript
const needsUpdate = existing.name !== node.text || node.order !== undefined
```

This was wrong because:
1. `node.order !== undefined` is ALWAYS true (order is always set in parser)
2. Fields with semantic equivalents (null, undefined, 0, []) weren't normalized
3. No comparative analysis of actual changes

## Fix Implemented

Added comprehensive value normalization before comparison:

```typescript
function normalizeForComparison(value: any, fieldName: string): any {
  // order: undefined/null treated as 0
  // tags: undefined/null/[] treated as []
  // slug: undefined/null treated as ''
  // strings: trimmed with trimEnd()
}

function areFieldsEqual(dbValue, parsedValue, fieldName): boolean {
  const dbNorm = normalizeForComparison(dbValue, fieldName)
  const parsedNorm = normalizeForComparison(parsedValue, fieldName)
  return dbNorm === parsedNorm
}
```

Only update nodes if these fields actually changed:
- `name`
- `order`
- `tags`
- `slug`

**NOT compared** (determined after sync):
- `type` (set by TestCaseExtractor)
- `parentId` (set during parent lookup phase)

## Evidence: First Node Comparison

```
[DIRTY-CHECK] First node comparison (normalized):
  uid: 7DmLXtH2B (root node)
  
  --- name ---
    DB: "TestSuite : Kinergy"
    Parsed: "TestSuite : Kinergy"
    Normalized DB: "TestSuite : Kinergy"
    Normalized Parsed: "TestSuite : Kinergy"
    Equal? true ✓
    
  --- order ---
    DB: 0
    Parsed: 0
    Normalized DB: 0
    Normalized Parsed: 0
    Equal? true ✓
    
  --- tags ---
    DB: []
    Parsed: []
    Normalized DB: []
    Normalized Parsed: []
    Equal? true ✓
    
  --- slug ---
    DB: "testsuite-kinergy"
    Parsed: "testsuite-kinergy"
    Normalized DB: "testsuite-kinergy"
    Normalized Parsed: "testsuite-kinergy"
    Equal? true ✓
    
  --- result ---
    needsUpdate? false ✓
```

## Historical Data Issue Discovered

While testing, the fix revealed a historical data problem:

**All existing RepositoryNodes have `order: 0`** (set during previous implementation)

When re-syncing with proper order tracking, parser now calculates correct order values:
- First child: order=0
- Second child: order=1
- Eighth child: order=7
- Etc.

This causes:
```
[importMarkdownNodes] Update reasons breakdown:
  nameChanged: 0
  orderChanged: 1617  ← Order values need fixing
  tagsChanged: 0
  slugChanged: 0
```

### Why This is Correct

**Order values in DB:** All 0 (from before proper order tracking)  
**Order values parsed:** 0, 1, 2, ... 7, 8, 9 (actual sibling positions)

This is legitimate data corruption that needs fixing! The first sync with this fix will correct it.

## Expected Behavior After Fix

### Scenario A: No changes in Roam
- **First Refresh Sync:** Update=1617 (fixing historical order values)
- **Second Refresh Sync:** Update=0 (order values already correct, nothing changed)

### Scenario B: Edit one test case
- Expected: Update=1 (only the edited node needs update)
- Proof: Dirty-check will catch only that node's fields as changed

### Scenario C: Add one new test case  
- Expected: Create=1 (new UID not in database)
- Proof: existingMap.get(node.uid) returns null for new nodes

### Scenario D: Move a test case
- Expected: Only affected siblings update (order values change for reordered children)
- Proof: Only nodes whose order field changed will be marked for update

## Code Location

**File:** `lib/roam/sync.ts`

**Normalization function:** Lines 8-48  
**Comparison function:** Lines 51-64  
**Dirty-check logic:** Lines 157-175  
**Update categorization:** Lines 177-239

**Debug output:**
- First node comparison: Lines 179-211
- Update reason tracking: Lines 212-237
- Breakdown summary: Lines 248-253

## Next Steps

To verify all 4 scenarios fully:

1. **Scenario A:** Run Refresh Sync twice
   - First: Verify Update=1617 (historical order fix)
   - Second: Verify Update=0 (no changes)

2. **Scenario B:** Edit one test in Roam, Refresh Sync
   - Expected: Create=0, Update=1, Skip=3727

3. **Scenario C:** Add one test in Roam, Refresh Sync
   - Expected: Create=1, Update=?, Skip=?

4. **Scenario D:** Move one test between siblings in Roam, Refresh Sync
   - Expected: Only affected siblings have orderChanged=true

## Quality Assurance

✅ Root cause identified: Missing value normalization  
✅ Fix implemented: Comprehensive normalization + comparison  
✅ First node verified: needsUpdate=false when nothing changed  
✅ Historical issue revealed: Order values need fixing (1617 nodes)  
✅ Expected behavior documented: Two-phase fix (correct data, then clean syncs)  
✅ Debug logging comprehensive: Field-by-field comparison visible  

**Status:** Ready for scenario verification

---

**Commit:** 2d1c21f - `fix: Implement proper dirty-check with value normalization for sync`
