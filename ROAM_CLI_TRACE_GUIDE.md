# Roam CLI Trace Guide - Identify Where Children Disappear

## Location
File: `qa-ops-desktop-connector/src/services/roam/roam-cli-client.ts` in `fetchPageByTitle()`

## Three Traces in Order

### TRACE 1: Raw stdout from `roam get-page`
Shows exactly what the Roam CLI command returns before any processing.

**Look for:**
- First 500 characters of raw output
- Total stdout length
- Evidence of children in the raw data

### TRACE 2: After JSON.parse()
Shows the structure after parsing the CLI output.

**Look for:**
- `page.children exists: true/false`
- `page.children is array: true/false`
- `page.children.length: X`
- First child's children count

### TRACE 3: After convertBlocksToTree()
Shows if the conversion function preserved children.

**Look for:**
- `result.children.length: X`
- First child's children count after conversion

## Data Loss Scenarios

### Scenario A: CLI returns children but TRACE 2 shows 0
→ **Problem:** `roam get-page` not returning descendants  
→ **Evidence:** TRACE 1 shows children in raw JSON but TRACE 2.page.children.length = 0  
→ **Cause:** Could be CLI flag, command, or Roam API limitation

### Scenario B: TRACE 2 shows children but TRACE 3 shows 0
→ **Problem:** `convertBlocksToTree()` is not converting children  
→ **Evidence:** TRACE 2.page.children.length > 0 but TRACE 3.result.children.length = 0  
→ **Cause:** Bug in `convertBlocksToTree()` recursion

### Scenario C: All traces show 0 children
→ **Problem:** Roam CLI itself only returns root  
→ **Evidence:** TRACE 1 raw output, TRACE 2, TRACE 3 all show children.length = 0  
→ **Cause:** Wrong CLI command, wrong flags, or Roam limitation

## Run Procedure

```bash
# 1. Rebuild Desktop Connector
cd qa-ops-desktop-connector
npm run build

# 2. Start it
npm start

# 3. In another terminal, trigger sync
curl -X POST http://localhost:7890/api/roam/sync \
  -H "Content-Type: application/json" \
  -d '{
    "projectId":"test",
    "syncType":"initial",
    "graphName":"Project_Kinergy",
    "apiToken":"YOUR_TOKEN",
    "repositoryRootPage":"Project_Kinergy"
  }'
```

## What to Collect

Copy all output from the Desktop Connector console that includes:
- TRACE 1
- TRACE 2
- TRACE 3
- STAGE 2 (final summary)

## Report Format

When you run this, paste the complete output showing:

1. **TRACE 1 output:** (first 500 chars of raw CLI output)
2. **TRACE 1 total length:** (how many characters total)
3. **TRACE 2 values:** (page.children.length, array status)
4. **TRACE 3 values:** (result.children.length)
5. **Conclusion:** Which trace first shows 0 children?

That will definitively answer: Does the CLI return children or not?
