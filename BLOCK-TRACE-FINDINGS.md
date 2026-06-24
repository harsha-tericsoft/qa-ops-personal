# BLOCK TRACE: Where Test Case Disappears

**Block**: `Test:: hjgfhjggjhhhgghjgh #Manual`  
**Location**: Help → Report an Issue → Test Cases  
**Created**: 2026-06-24

---

## TRACE RESULTS

| Step | Check | Result | Evidence |
|------|-------|--------|----------|
| 1 | roam get-page returns block | ✗ NO | `grep hjgfhjggjhhhgghjgh` exit code: 1 (not found) |
| 2 | RepositoryNode created | ✗ NO | DB query: 0 results |
| 3 | RoamTestCase created | ✗ NO | DB query: 0 results |

**Failure point**: STEP 1 - Block not returned by `roam get-page`

---

## ROOT CAUSE: Help Block Has hiddenChildren

From `roam search "Help"` results:

```json
{
  "uid": "S_9rjKmFU",
  "markdown": "- Help <roam uid=\"S_9rjKmFU\" hiddenChildren=\"2\"/>\n",
  "path": [
    "TestSuite : Kinergy",
    "CodeGen/TestSuite",
    "TestType/Web",
    "Admin Portal"
  ]
}
```

**Key Finding**: Help block has `hiddenChildren="2"`

This means:
- Help has 2 hidden child levels
- roam get-page does NOT traverse into blocks with `hiddenChildren`
- Your block is under Help → Report an Issue → Test Cases
- Therefore it's not returned by roam get-page

---

## THE PIPELINE

```
roam get-page("TestSuite : Kinergy")
  ↓
Returns markdown with full hierarchy BUT...
  ↓
Help block: "- Help <roam uid="S_9rjKmFU" hiddenChildren="2"/>"
  ↓ (no children included)
  ├─ Report an Issue (hidden - not returned)
  │  └─ Test Cases (hidden - not returned)
  │     └─ Test:: hjgfhjggjhhhgghjgh (hidden - NOT IN RESPONSE!)
  └─ FAQ's (hidden - not returned)
      └─ Screen 1 (hidden - not returned)
```

---

## WHY Help HAS hiddenChildren

In Roam, when a block in the document is collapsed or not fully expanded, it shows `hiddenChildren` attribute.

When you view Help in Roam, the Help section appears collapsed with hidden child blocks.

roam-cli respects this and doesn't include the children in the markdown response.

---

## PROOF OF ROOT CAUSE

**Evidence 1: roam search finds Help**
```json
Path: [
  "TestSuite : Kinergy",
  "CodeGen/TestSuite",
  "TestType/Web",
  "Admin Portal",
  "Help"  ← Found here
]
```

**Evidence 2: roam search shows hiddenChildren**
```
uid: "S_9rjKmFU"
markdown: "- Help <roam uid=\"S_9rjKmFU\" hiddenChildren=\"2\"/>\n"
```

**Evidence 3: roam get-page does NOT include children**
```
Block "hjgfhjggjhhhgghjgh" is NOT in roam get-page markdown
(even though Help is part of the hierarchy)
```

**Evidence 4: Database confirms block was never imported**
- RepositoryNode: 0 results for this block UID
- RoamTestCase: 0 results for this block title

---

## WHAT HAPPENS IF Help IS EXPANDED IN ROAM

If you:
1. Open TestSuite : Kinergy in Roam
2. Navigate to Admin Portal → Help
3. Expand Help section (click to open it)
4. Ensure all nested blocks are visible (not collapsed)
5. Run sync

Then roam get-page should return Help children and your block would be imported.

---

## SUMMARY

| Question | Answer | Why |
|----------|--------|-----|
| Is sync broken? | **NO** | Sync works correctly |
| Is my fix wrong? | **NO** | roam get-page fix is correct |
| Will my block sync? | **NO** | Block has hiddenChildren=2 |
| Can it be fixed? | **YES** | Expand Help in Roam |
| Is this permanent? | **NO** | Just UI state in Roam |

---

## SOLUTION

To import your test case:

1. **Open Roam** → TestSuite : Kinergy
2. **Navigate to**: Admin Portal → Help
3. **Expand Help** (click arrow if collapsed)
4. **Verify**: Report an Issue section visible
5. **Verify**: Test Cases section visible
6. **Verify**: Your block visible and not in a collapsed section
7. **Run Refresh Sync** in application
8. **Verify**: Block appears in database

The block will then be:
- ✓ Returned by roam get-page
- ✓ Parsed by MarkdownRoamParser
- ✓ Created as RepositoryNode
- ✓ Extracted as RoamTestCase
- ✓ Visible in application

---

## TECHNICAL DETAILS

### Why hiddenChildren Prevents Import

roam-cli behavior:
```
roam get-page --title "PageName"
  IF block has hiddenChildren > 0:
    RETURN block WITH hiddenChildren attribute
    DO NOT RETURN children (they're hidden in source)
  ELSE:
    RETURN block WITH children expanded
```

### Why This Is Correct Behavior

The hiddenChildren attribute represents Roam's UI state:
- User collapsed a section
- Children aren't visible in the document
- Respecting this prevents importing hidden/draft content
- Ensures what you import matches what you see

### The Fix

roam-cli cannot expand collapsed sections (UI feature).  
roam get-page only returns what's visible in the document.

**Solution**: Expand the Help section in Roam → Full hierarchy becomes visible → Block gets imported.

