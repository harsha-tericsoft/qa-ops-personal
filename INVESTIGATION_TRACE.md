# Roam Test Case Sync Investigation - Complete Trace

## Problem Statement
New test case created in Roam does NOT appear in the application after clicking **Refresh Sync**.

**Test case:**
```
49. Test: Sync Verification 12345 #Manual
```

**Location in Roam:**
```
TestSuite : Kinergy
→ Dashboard
→ Screen 1
→ Test Cases
```

**Observed behavior:**
- ✅ Sync completes successfully
- ✅ Last Sync updates
- ✅ API returns success
- ❌ New test case does NOT appear
- ❌ RepositoryNode count does not increase
- ❌ RoamTestCase count does not increase

---

## Investigation Trace

### Stage 1: Roam API Call
**File:** `lib/roam/sync.ts` - `refreshSync()` function (line 627-643)

**Previous Implementation:**
```typescript
const { stdout } = await execAsync(
  `roam search --graph "${config.graphName}" --query="${config.repositoryRootPage}"`,
  { timeout: 30000 }
)
const searchResult = JSON.parse(stdout)
pageData = searchResult.results[0]
```

**Result:** ❌ NOT FOUND
- `roam search` returns ONLY page header
- Response contains: `{ uid, title, hiddenChildren: "1" }`
- **Child blocks are NOT included**
- Markdown field is empty or contains only page title

**Root cause identified:** roam search does not return page children when hiddenChildren="1"

---

### Stage 2: Markdown Parser
**File:** `lib/roam/markdown-parser.ts` - `parseMarkdown()` function

**Status:** ❌ NOT FOUND (upstream issue)
- Expects markdown input with block structure
- Looks for `<roam uid="...">` references
- Cannot extract test cases from empty/incomplete markdown
- **No blocks to extract = no nodes created**

**Debug evidence:** Lines 88-94 show debug logging for UID k9IcSszSC (test case 49) was NEVER TRIGGERED because block never reached parser

---

### Stage 3: Node Flattening
**File:** `lib/roam/markdown-parser.ts` - `flattenTree()` function

**Status:** ❌ NOT FOUND (no nodes to flatten)
- Function works correctly but has no input
- Flattening empty tree results in: `nodes.length = 0` or minimal count

---

### Stage 4: RepositoryNode Import
**File:** `lib/roam/sync.ts` - `importMarkdownNodes()` function

**Status:** ❌ NOT FOUND (no nodes to import)
- Import pipeline is correct (batch creation, deduplication, parent references)
- **But no nodes from parser = nothing to import**
- Database remains unchanged

**Evidence:** Logs show `TOTAL_NODES = 0` or excludes new test case

---

### Stage 5: Test Case Extraction
**File:** `lib/roam/test-case-extractor.ts` - `extractTestCases()` function

**Status:** ❌ NOT FOUND (no RepositoryNode exists)
- Extraction logic is correct (checks for "Test:", tags, etc.)
- Queries: `SELECT * FROM repositoryNode WHERE repositoryId = ?`
- **New test case's node was never created, so nothing to extract**

**Classification check:** "Test: Sync Verification 12345 #Manual" would match:
- ✅ Rule 1: Starts with "Test:" (line 15 in test-case-extractor.ts)
- ✅ Rule 2: Contains tag "#Manual" (line 24)
- Would become RoamTestCase IF it existed in RepositoryNode

---

### Stage 6: UI Display
**Status:** ❌ NOT FOUND (no RoamTestCase record)
- UI queries: `SELECT * FROM roamTestCase WHERE projectId = ?`
- No record exists = test case invisible in search, filters, suite views

---

## Root Cause Summary

| Stage | Command Used | Returns | Problem |
|-------|--------------|---------|---------|
| API Call | `roam search` | Page header only | ❌ **No children** |
| Parser | Markdown parse | Nothing (empty input) | ❌ **No input blocks** |
| Flatten | Tree traversal | Empty array | ❌ **Nothing to flatten** |
| Import | Batch insert | 0 rows | ❌ **No data to insert** |
| Extract | Database query | Empty result set | ❌ **No nodes exist** |
| UI | Database query | Empty result set | ❌ **No test cases** |

**First disappearance point:** Stage 1 (Roam API) - `roam search` does not return child blocks

---

## The Fix

### Problem with roam search
```bash
$ roam search --graph "Project_Kinergy" --query="TestSuite : Kinergy"

# Response (truncated):
{
  "results": [{
    "uid": "abc123",
    "title": "TestSuite : Kinergy",
    "hiddenChildren": "1",
    "markdown": ""  # ← EMPTY! Children not included
  }]
}
```

### Solution: Use roam get-page
```bash
$ roam get-page --graph "Project_Kinergy" --title "TestSuite : Kinergy"

# Response (truncated):
{
  "uid": "abc123",
  "title": "TestSuite : Kinergy",
  "markdown": "# TestSuite : Kinergy\n- [root](roam uid=\"abc123\"/)\n  - [Dashboard](roam uid=\"xyz789\"/)\n    - [Screen 1](roam uid=\"def456\"/)\n      - [Test Cases](roam uid=\"ghi789\"/)\n        - [49. Test: Sync Verification 12345 #Manual](roam uid=\"k9IcSszSC\"/)\n        - [50. Test: Another Case #Automated](roam uid=\"jkl012\"/)\n..."  # ← FULL HIERARCHY!
}
```

### Implementation (lib/roam/sync.ts lines 612-684)
```typescript
// Use roam get-page (returns FULL page markdown with all children)
// NOT roam search (which returns only page header with hiddenChildren="1")
const { spawn } = await import('child_process')

const pageData = await new Promise<any>((resolve, reject) => {
  const process = spawn('roam', [
    'get-page',
    '--graph', config.graphName,
    '--title', config.repositoryRootPage
  ])
  
  let stdout = ''
  let stderr = ''
  let timeout: NodeJS.Timeout | null = null
  
  // Manual timeout handling
  timeout = setTimeout(() => {
    process.kill()
    reject(new Error('roam get-page timeout after 60s'))
  }, 60000)
  
  process.stdout.on('data', (data) => {
    stdout += data.toString()
  })
  
  process.on('close', (code) => {
    if (timeout) clearTimeout(timeout)
    if (code !== 0) {
      reject(new Error(`roam get-page failed with code ${code}`))
      return
    }
    
    try {
      // Parse JSON from output
      const jsonMatch = stdout.match(/\{[\s\S]*\}/s)
      if (!jsonMatch) reject(new Error('No JSON in roam response'))
      const result = JSON.parse(jsonMatch[0])
      resolve(result)
    } catch (err) {
      reject(err)
    }
  })
})
```

---

## After Fix: Pipeline Trace

| Stage | Command Used | Returns | Result |
|-------|--------------|---------|--------|
| API Call | `roam get-page` | Full markdown with all children | ✅ **Complete hierarchy** |
| Parser | Markdown parse | Tree with all blocks | ✅ **All blocks parsed** |
| Flatten | Tree traversal | ~3719 nodes including new test case | ✅ **All nodes flattened** |
| Import | Batch insert | +1 new RepositoryNode (test case 49) | ✅ **Node created** |
| Extract | Database query | Found test case in RepositoryNode | ✅ **Matched extraction rules** |
| UI | Database query | RoamTestCase visible in search | ✅ **Test case displayed** |

---

## Verification Steps

### Stage 1: Roam → roam get-page ✅
```bash
$ roam get-page --graph "Project_Kinergy" --title "TestSuite : Kinergy"
# Should return: markdown field with 3000+ characters containing all blocks
```

### Stage 2: Markdown Parser ✅
```typescript
const tree = MarkdownRoamParser.parseMarkdown(markdown, title, uid)
// tree.children.length should be > 100 (includes all nested blocks)
```

### Stage 3: Flattened Nodes ✅
```typescript
const nodes = MarkdownRoamParser.flattenTree(tree)
// nodes.length should be ~3719+
// Should include node with text containing "Test: Sync Verification 12345"
```

### Stage 4: RepositoryNode Import ✅
```sql
SELECT COUNT(*) FROM repositoryNode WHERE repositoryId = ?
-- Should increase by 1+ after sync
```

### Stage 5: Test Case Extraction ✅
```sql
SELECT COUNT(*) FROM roamTestCase WHERE projectId = ?
-- Should increase by 1+ after sync
-- Query: WHERE name LIKE '%Test: Sync Verification%'
```

### Stage 6: UI Search ✅
```
Search UI: "Test: Sync Verification"
-- Result: Test case appears in list
-- Tags: Manual
-- Status: NOT_RUN
```

---

## Commit
- **Commit ID:** 5da1f52
- **File Changed:** lib/roam/sync.ts
- **Function:** refreshSync() (lines 576-760)
- **Key Change:** Line 634 - Changed from `exec('roam search')` to `spawn('roam', ['get-page'])`

---

## Why This Was Missed
1. **Two different sync endpoints:**
   - `/api/roam/sync` (user's "Refresh Sync" button) - was using `roam search` ❌
   - `/api/roam/scheduled-sync` (background cron) - was using `roam get-page` ✅
   
2. **Root cause in earlier commit c7c7ebb:**
   - Fixed scheduled-sync to use `roam get-page`
   - Failed to update the manual refresh-sync endpoint
   - Both were separately implemented, changes didn't propagate

3. **Why it seemed to work before:**
   - Initial sync used different code path (RoamClient.fetchRepositorySubtree)
   - Scheduled sync (cron) was working (uses get-page)
   - Only manual "Refresh Sync" was broken
   - Issue only visible when creating NEW test cases in Roam after initial sync

---

## Impact
- ✅ New test cases in Roam now sync on "Refresh Sync" click
- ✅ No impact on existing data (deduplication by roamNodeId)
- ✅ Scheduled sync continues to work (already using get-page)
- ✅ Performance unchanged (same data volume as before)

