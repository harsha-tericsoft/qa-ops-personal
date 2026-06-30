# Log Evidence Guide - Find Where Descendants Disappear

## What to Do

1. Rebuild both services (code has logging now)
2. Run Initial Sync
3. Copy the logs from both consoles
4. Compare the numbers at each stage

## Expected Log Output

### STAGE 2: Desktop Connector - Roam CLI output
```
[STAGE 2] Roam CLI fetchPageByTitle() output
  Root UID: <uid>
  Root Title: Project_Kinergy
  Root direct children: <N>
  Total recursive nodes (from Roam): <TOTAL>
  First child: uid=<uid>, string="<text>"
```

**CRITICAL:** `Root direct children` should be > 0 (should be ~50+)

### STAGE 3: Desktop Connector - HTTP response
```
[STAGE 3] Desktop Connector API response
  Root UID: <uid>
  Root Title: Project_Kinergy
  Root direct children: <N>
  Total recursive nodes: <TOTAL>
  First child: uid=<uid>, string="<text>"
```

**CRITICAL:** Should match STAGE 2 numbers

### STAGE 4: QA Ops - Bridge client received
```
[STAGE 4] Bridge client received response
  Root UID: <uid>
  Root Title: Project_Kinergy
  Root direct children: <N>
  Total recursive nodes: <TOTAL>
  First child: uid=<uid>, string="<text>"
```

**CRITICAL:** Should match STAGE 3 numbers

### STAGE 5: QA Ops - After conversion
```
[STAGE 5] After convertBridgeTreeToMarkdownBlock()
  Root UID: <uid>
  Root Text: Project_Kinergy
  Root direct children: <N>
  Total recursive nodes: <TOTAL>
  First child: uid=<uid>, text="<text>"
```

**CRITICAL:** Should match STAGE 4 numbers

### STAGE 6: QA Ops - After flattening
```
[STAGE 6] After flattenTree()
  Total flattened nodes: <N>
  Root nodes (parentId=null): 1
  Non-root nodes (parentId!=null): <N-1>
  Root: uid=<uid>, text="Project_Kinergy"
  First child: uid=<uid>, text="<text>", parentId=<parent_uid>
```

**CRITICAL:** `Total flattened nodes` should be >> 1 (should be ~3735)

### STAGE 7: QA Ops - Import result
```
[STAGE 7] importMarkdownNodes() result
  Received nodes: <N>
  Added: <N>
  Updated: 0
  Skipped: 0
  Total processed: <N>
```

**CRITICAL:** `Received nodes` should match STAGE 6 count

## Data Loss Detection

### If STAGE 2 shows children but STAGE 3 doesn't:
→ **Desktop Connector is losing children**
→ Problem in: Desktop Connector HTTP response serialization

### If STAGE 3 shows children but STAGE 4 doesn't:
→ **Bridge transmission lost children**
→ Problem in: lib/bridge/bridge-client.ts response handling

### If STAGE 4 shows children but STAGE 5 doesn't:
→ **Conversion function dropped children**
→ Problem in: convertBridgeTreeToMarkdownBlock() at sync/route.ts:177-194

### If STAGE 5 shows children but STAGE 6 shows only 1 node:
→ **Flattening didn't recurse through children**
→ Problem in: MarkdownRoamParser.flattenTree() at markdown-parser.ts:132-186

### If STAGE 6 shows many nodes but STAGE 7 shows added=1:
→ **Import logic filtered out non-root nodes**
→ Problem in: importMarkdownNodes() at sync.ts:78+

## Quick Checklist

Create this table as you read the logs:

| Stage | Root Children | Total Recursive | Status |
|-------|---------------|-----------------|--------|
| 2 (Roam) | ____ | ____ | ✓/✗ |
| 3 (Desktop API) | ____ | ____ | ✓/✗ |
| 4 (Bridge client) | ____ | ____ | ✓/✗ |
| 5 (After convert) | ____ | ____ | ✓/✗ |
| 6 (After flatten) | Flattened: ____ | ____ | ✓/✗ |
| 7 (Import result) | Received: ____ | Added: ____ | ✓/✗ |

## Expected Healthy Progression

```
Stage 2: 50 children, 3735 total
Stage 3: 50 children, 3735 total
Stage 4: 50 children, 3735 total
Stage 5: 50 children, 3735 total
Stage 6: 3735 flattened nodes
Stage 7: 3735 added
```

## Where to Look for Logs

**Desktop Connector:**
- Terminal running: `cd qa-ops-desktop-connector && npm start`
- Look for: `[STAGE 2]` and `[STAGE 3]` messages

**QA Ops:**
- Terminal running: `npm run dev`
- Look for: `[STAGE 4]`, `[STAGE 5]`, `[STAGE 6]`, `[STAGE 7]` messages

## Commands to Run

```bash
# Rebuild Desktop Connector
cd qa-ops-desktop-connector
npm run build

# Rebuild QA Ops
cd ..
npm run build

# Terminal 1: Start Desktop Connector
cd qa-ops-desktop-connector
npm start

# Terminal 2: Start QA Ops
npm run dev

# Terminal 3: Trigger Initial Sync
curl -X POST http://localhost:3000/api/roam/sync \
  -H "Content-Type: application/json" \
  -d '{"projectId":"test","syncType":"initial"}'
```

## Copy All Logs and Report

Once you have captured all the logs:

1. Copy all STAGE outputs from both consoles
2. Create the comparison table above
3. Identify which stage shows the first data loss
4. Report: "Data lost between STAGE X and STAGE Y"

That will tell us exactly which code section to investigate.
