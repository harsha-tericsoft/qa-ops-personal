# Roam Local API Investigation - Findings Summary

**Investigation Date**: 2026-06-14  
**Status**: ✅ COMPLETE - Official packages found and verified

---

## Executive Summary

**Your token `roam-graph-local-token-LzWrKi_kHDBQ59qPaWx87sWZVjlgv` IS supported by official Roam packages.**

The outdated `roam-research-mcp` v2.19.1 package uses Cloud API and is incompatible. The official, maintained packages use Local API and support your token format.

---

## Key Finding: 3 Official Packages Support Local API

### 1. Official CLI: `@roam-research/roam-cli` ✅
- **Version**: 0.7.4 (published 2026-06-13)
- **Status**: Latest, maintained by Roam Research
- **Token Support**: `roam-graph-local-token-*` ✅
- **Link**: https://www.npmjs.com/package/@roam-research/roam-cli

### 2. Official MCP Server: `@roam-research/roam-mcp` ✅
- **Status**: Official, maintained by Roam Research
- **Token Support**: `roam-graph-local-token-*` ✅
- **Best for**: Claude/AI integration

### 3. Official SDK: `@roam-research/roam-tools-local` ✅
- **Version**: 0.7.4 (published 2026-06-13)
- **Status**: Latest, maintained by Roam Research
- **Token Support**: `roam-graph-local-token-*` ✅
- **Link**: https://www.npmjs.com/package/@roam-research/roam-tools-local

---

## Evidence from Source Code

### Local API Endpoint

**File**: `/node_modules/@roam-research/roam-tools-local/dist/client.js` (lines 220-238)

```javascript
async call(action, args = []) {
  const port = await this.getPort();
  let url = `http://127.0.0.1:${port}/api/${this.graphName}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    },
    body: JSON.stringify({
      action,
      args,
      expectedApiVersion: "2.0.0",
    }),
  });
}
```

**Endpoint**: `POST http://127.0.0.1:3333/api/{graphName}`

---

### Token Format Validation

**File**: `/node_modules/@roam-research/roam-tools-local/dist/client.js` (lines 103-105)

```javascript
case ErrorCodes.INVALID_TOKEN_FORMAT:
  return (baseMsg +
    "The token format is invalid. Tokens should start with 'roam-graph-local-token-'.");
```

**Expected Format**: `roam-graph-local-token-XXXXX` (exactly this prefix)

---

### Token Info Endpoint

**File**: `/node_modules/@roam-research/roam-tools-local/dist/client.js` (lines 175-210)

```javascript
async getTokenInfo() {
  const port = await this.getPort();
  const response = await fetch(
    `http://127.0.0.1:${port}/api/graphs/tokens/info`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: this.token,
        graph: this.graphName,
        type: this.graphType,
      }),
    }
  );
}
```

**Endpoint**: `POST http://127.0.0.1:3333/api/graphs/tokens/info`

---

## Supported Operations (from source)

**File**: `/node_modules/@roam-research/roam-tools-core/dist/tools.js` (lines 145-179)

### Read Operations
- ✅ `get_page` - Get page content as markdown
- ✅ `get_block` - Get block content as markdown
- ✅ `search` - Search pages/blocks by text
- ✅ `get_backlinks` - Get linked references
- ✅ `datalog_query` - Datomic-style queries
- ✅ `roam_query` - Roam query blocks
- ✅ `search_templates` - Search templates
- ✅ `get_graph_guidelines` - Get user preferences

### Write Operations
- ✅ `create_page` - Create page with markdown
- ✅ `create_block` - Create blocks
- ✅ `update_page` - Update page title
- ✅ `update_block` - Update block text
- ✅ `delete_page` - Delete page
- ✅ `delete_block` - Delete block
- ✅ `move_block` - Move block
- ✅ `append_to_daily_note` - Append to daily note

### Comments
- ✅ `add_comment` - Add comment to block
- ✅ `get_comments` - Get comments

### File Operations
- ✅ `file_get` - Fetch file
- ✅ `file_upload` - Upload file
- ✅ `file_delete` - Delete file

### Navigation (Desktop)
- ✅ `get_open_windows` - Get current view
- ✅ `get_selection` - Get selection
- ✅ `open_main_window` - Navigate
- ✅ `open_sidebar` - Open sidebar

---

## Why roam-research-mcp v2.19.1 Fails

**Package**: `roam-research-mcp` v2.19.1  
**Status**: ❌ OUTDATED

**Uses**: `@roam-research/roam-api-sdk` (Cloud API)

**Error when using local token**: "Token cannot be verified or is improperly formatted"

**Reason**: 
- It calls Cloud API endpoint (`https://api.roamresearch.com`)
- Cloud API expects `roam-graph-token-*` format tokens
- Your token is `roam-graph-local-token-*` format (Local API)
- Incompatible architectures

**Solution**: Use `@roam-research/roam-mcp` (official) instead

---

## Architecture Evolution

### Old (what you have)
```
roam-research-mcp v2.19.1
    ↓
@roam-research/roam-api-sdk (Cloud API)
    ↓
https://api.roamresearch.com/api/graph/{graph}/q
    ↓
Expects: roam-graph-token-*
```

### New (official, recommended)
```
@roam-research/roam-cli or @roam-research/roam-mcp
    ↓
@roam-research/roam-tools-local (Local API)
    ↓
http://127.0.0.1:3333/api/{graph}
    ↓
Expects: roam-graph-local-token-*
```

---

## Configuration Files

### File 1: `~/.roam-tools.json`

**Created by**: `roam connect` command  
**Used by**: CLI and MCP server  
**Contains**: Graph names, tokens, access levels

### File 2: `~/.roam-local-api.json`

**Created by**: Roam Desktop app  
**Contains**: Local API port (usually 3333)

---

## Exact Implementation Details

### Token Storage
- **Location**: `~/.roam-tools.json`
- **Format**: JSON
- **Key**: `graphs.{nickname}.token`
- **Value**: `roam-graph-local-token-*`

### Port Discovery
- **File**: `~/.roam-local-api.json`
- **Key**: `port`
- **Default**: 3333 (if file missing)

### API Version
- **Current**: 2.0.0
- **Validated on each request**: Yes (via `expectedApiVersion`)
- **Mismatch error**: VERSION_MISMATCH with upgrade guidance

---

## Authentication Flow

1. **Token Request**
   ```
   POST http://127.0.0.1:3333/api/graphs/tokens/request
   {
     "graph": "Project_Kinergy",
     "graphType": "hosted",
     "accessLevel": "full",
     "ai": true
   }
   ```

2. **User Approves** (in Roam Desktop dialog)

3. **Token Returned** (format: `roam-graph-local-token-*`)

4. **CLI Stores** in `~/.roam-tools.json`

5. **Subsequent Calls** include token:
   ```
   Authorization: Bearer roam-graph-local-token-*
   ```

---

## Error Codes from Source

**File**: `/node_modules/@roam-research/roam-tools-local/dist/client.js`

### 401 Errors (Authentication)
- `MISSING_TOKEN` - No token provided
- `INVALID_TOKEN_FORMAT` - Wrong format (not starting with `roam-graph-local-token-`)
- `WRONG_GRAPH_TYPE` - Token for different graph type
- `TOKEN_NOT_FOUND` - Token revoked/not recognized

### 403 Errors (Permission)
- `INSUFFICIENT_SCOPE` - Operation requires higher permissions
- `SCOPE_EXCEEDS_PERMISSION` - Token has more permissions than user account

---

## Quick Comparison

| Aspect | roam-research-mcp v2.19.1 | Official Packages |
|--------|---|---|
| **Token Format Support** | ❌ `roam-graph-token-*` only | ✅ `roam-graph-local-token-*` |
| **Your Token** | ❌ NOT compatible | ✅ Compatible |
| **Maintenance** | ⚠️ Third-party | ✅ Official |
| **Latest Version** | ❌ v2.19.1 (old) | ✅ v0.7.4 (2026-06-13) |
| **Local API Support** | ❌ NO | ✅ YES |
| **CLI Available** | ⚠️ Basic | ✅ Full (`roam-cli`) |
| **MCP Server** | ⚠️ Third-party | ✅ Official |

---

## Action Items

### To Use Local API (Recommended for Your Token)

**Step 1**: Install official CLI
```bash
npm install -g @roam-research/roam-cli
```

**Step 2**: Connect graph
```bash
roam connect --graph Project_Kinergy --nickname "Kinergy" --access-level full
```

**Step 3**: Test
```bash
roam list-graphs
roam search --query "test" --graph Kinergy
roam get-page --title "Home" --graph Kinergy
```

### To Use MCP (for Claude Integration)

**Step 1**: Install official MCP
```bash
npm install @roam-research/roam-mcp
```

**Step 2**: Configure in Claude
```json
{
  "mcpServers": {
    "roam": {
      "command": "npx",
      "args": ["@roam-research/roam-mcp"]
    }
  }
}
```

**Step 3**: Use in Claude with tools

---

## Documentation Links

| Resource | Link |
|----------|------|
| Official CLI | https://www.npmjs.com/package/@roam-research/roam-cli |
| Local API SDK | https://www.npmjs.com/package/@roam-research/roam-tools-local |
| Tools Core | https://www.npmjs.com/package/@roam-research/roam-tools-core |
| GitHub Repository | https://github.com/Roam-Research/roam-tools |

---

## Conclusion

✅ **Your `roam-graph-local-token-*` is fully supported**

✅ **Official packages exist and are maintained**

✅ **Full read/write/file operations are supported**

❌ **`roam-research-mcp` v2.19.1 is incompatible** (uses Cloud API)

✅ **Solution: Use `@roam-research/roam-cli` or `@roam-research/roam-mcp`**

---

**Next Step**: Choose between CLI (scripting) or MCP (AI integration) and proceed with official packages.

