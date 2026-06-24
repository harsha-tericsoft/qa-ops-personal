# ROOT CAUSE: SYNC BROKEN AFTER MIGRATION FROM ROAM API TO ROAM-CLI

## ORIGINAL IMPORT (WORKED - 3,718 nodes imported)

**Commit**: 287c755 - "Build Roam Integration - crypto, client, import/export, sync, and API routes"

**Method**: RoamClient API (cloud-based, not CLI)

```typescript
// app/api/roam/sync/route.ts (original)
const client = new RoamClient(config.graphName, decryptedKey)
const pages = await client.fetchAllPages()  // ← Fetches FULL page data via Roam Cloud API
const result = await importRoamJSON(pages, repository.id, projectId)
```

**How it worked**:
1. Creates RoamClient with API key
2. Calls `client.fetchAllPages()` - gets full page JSON from Roam API
3. JSON includes COMPLETE hierarchical structure with all children
4. Imports entire tree into RepositoryNode and RoamTestCase
5. Result: 3,718 RepositoryNodes, 2,425 RoamTestCases

**Why it worked for new content**:
- The Roam API returns the FULL page structure with all children visible
- No "hiddenChildren" issue
- New test cases added to Roam are part of the page JSON

---

## CURRENT SYNC (BROKEN - no new content imported)

**Commit**: 308bedd - "feat: implement live Roam sync with duplicate-safe synchronization"

**Method**: roam-cli search (command-line tool)

```typescript
// app/api/roam/scheduled-sync/route.ts (current)
const searchResult = await roamSearch(config.graphName, config.repositoryRootPage)
const markdown = searchResult.results[0].markdown  // ← Only returns markdown of root page
const tree = MarkdownRoamParser.parseMarkdown(markdown, ...)
```

**How it fails**:
1. Uses `roam search` CLI command
2. Returns only the root page with `hiddenChildren="1"`
3. Markdown is just: `# TestSuite : Kinergy <roam uid="7DmLXtH2B" hiddenChildren="1"/>`
4. No child content in the markdown
5. Parser extracts 0 child nodes
6. Result: No new RepositoryNodes created, no new RoamTestCases extracted

**Why it fails for new content**:
- The roam-cli search command returns only the page header
- Children are marked as "hidden" and not included in markdown
- New test cases added to Roam are children → invisible to sync
- Every sync runs but imports nothing (created: 0, updated: 0)

---

## THE EVIDENCE

### Database State Shows the Break

```
Most recent RepositoryNode created: June 21 22:13:17
Most recent RoamTestCase created: June 21 22:13:17
Today's syncs at 09:35: status=SUCCESS but created=undefined, updated=0
```

### Roam CLI Response vs API Response

**roam-cli search output**:
```json
{
  "markdown": "# TestSuite : Kinergy <roam uid=\"7DmLXtH2B\" hiddenChildren=\"1\"/>",
  "uid": "7DmLXtH2B"
}
```
^ No children, no content

**Roam API response (original client.fetchAllPages())**:
```json
{
  "uid": "7DmLXtH2B",
  "title": "TestSuite : Kinergy",
  "children": [
    {
      "uid": "hH38FJnvO",
      "string": "CodeGen/TestSuite:: for ...",
      "children": [...]
    },
    ...
  ]
}
```
^ Complete hierarchy with all children

---

## WHY THE SWITCH HAPPENED

**Hypothesis** (from commit messages):
- Original RoamClient used Roam Cloud API (with API key auth)
- Commit `e1cc79f` - "Implement Roam CLI service migration from deprecated HTTP architecture"
- The API may have had connectivity/auth issues or was deprecated
- Migration to roam-cli was intended but didn't account for the "hiddenChildren" limitation

---

## THE FIX

Replace `roam search` with a method that returns full content:

**Option 1**: Restore the original RoamClient API approach
```typescript
const client = new RoamClient(config.graphName, decryptedKey)
const pages = await client.fetchAllPages()  // ← Returns full data
```

**Option 2**: Use `roam get-page` instead of `roam search`
```typescript
const pageContent = await roamGetPage(config.graphName, config.repositoryRootPage)
// May return full page structure instead of just header
```

**Option 3**: Use a different roam-cli command with recursive depth
```typescript
const result = await roamSearch(..., { maxDepth: 999 })
// If roam-cli supports depth parameter
```

---

## SUMMARY

**How 2,425 tests were originally imported**:
- ✓ Used RoamClient.fetchAllPages() from Roam Cloud API
- ✓ Got FULL page JSON with complete hierarchy
- ✓ Imported all 3,718 nodes and 2,425 test cases

**Why new syncs don't work**:
- ✗ Current code uses roam-cli search instead
- ✗ search returns only page header with hiddenChildren="1"
- ✗ No child content in markdown → nothing to import
- ✗ Database unchanged since June 21

**Evidence**:
- Code migration happened in commit 308bedd
- Original working code in commit 287c755
- Current database state shows last import on June 21
- Sync logs show created=0, updated=0 for all recent syncs

