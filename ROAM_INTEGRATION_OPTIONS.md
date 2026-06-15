# Roam Integration Options: Complete Comparison

**Date**: 2026-06-14  
**Status**: Evidence-based comparison of all Roam integration options

---

## Summary: 3 Viable Options

| | **Option 1: Official CLI** | **Option 2: Official MCP** | **Option 3: Cloud API SDK** |
|---|---|---|---|
| **Package** | `@roam-research/roam-cli` | `@roam-research/roam-mcp` | `@roam-research/roam-api-sdk` |
| **Type** | Command-line tool | MCP server | JavaScript SDK |
| **Token Type** | `roam-graph-local-token-*` | `roam-graph-local-token-*` | `roam-graph-token-*` |
| **Best For** | Scripts, automation, testing | AI assistants, Claude integration | Web apps, backend services |
| **Installation** | `npm install -g @roam-research/roam-cli` | `npm install @roam-research/roam-mcp` | `npm install @roam-research/roam-api-sdk` |
| **Ease of Use** | Very easy | Easy | Medium |

---

## Option 1: Official CLI (`@roam-research/roam-cli`)

### Installation

```bash
npm install -g @roam-research/roam-cli
```

### Setup

```bash
# Interactive
roam connect

# Non-interactive
roam connect --graph Project_Kinergy --nickname "Kinergy" --access-level full
```

### Usage Examples

**List graphs**:
```bash
roam list-graphs
```

**Search**:
```bash
roam search --query "todo" --graph Kinergy
```

**Get page**:
```bash
roam get-page --title "Home" --graph Kinergy
```

**Create page**:
```bash
roam create-page --title "New Page" --graph Kinergy
```

**Create block**:
```bash
roam create-block \
  --title "Home" \
  --markdown "- [ ] Task 1\n- [ ] Task 2" \
  --graph Kinergy
```

**Append to daily note**:
```bash
roam append-to-daily-note \
  --markdown "## Meeting Notes\n- Topic 1\n- Topic 2" \
  --graph Kinergy
```

**Datalog query**:
```bash
roam datalog-query \
  --query '[:find ?page :where [?p :node/title ?page]]' \
  --graph Kinergy
```

### Pros

✅ Official, maintained by Roam Research  
✅ Latest features (v0.7.4, published 2026-06-13)  
✅ Full read/write support  
✅ File operations  
✅ Navigation/UI control  
✅ Easy setup with `roam connect`  
✅ Works with offline graphs  
✅ Simple CLI commands  
✅ Great for automation/scripting  

### Cons

❌ CLI-only (not programmable API)  
❌ Requires Roam Desktop running  
❌ Must parse CLI output for automation  

### Dependencies

- Node.js 18+
- Roam Desktop app (running)
- `@roam-research/roam-tools-local` (included)
- `@roam-research/roam-tools-core` (included)

### Authentication Flow

1. `roam connect` creates a token request
2. Roam Desktop app displays approval dialog
3. User approves token
4. CLI saves token to `~/.roam-tools.json`
5. CLI reads token from config for all subsequent operations

---

## Option 2: Official MCP Server (`@roam-research/roam-mcp`)

### Installation

```bash
npm install @roam-research/roam-mcp
```

### Configuration (Claude)

Add to your Claude config:

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

### Setup

```bash
# Interactive
npx @roam-research/roam-mcp connect

# Non-interactive
npx @roam-research/roam-mcp connect \
  --graph Project_Kinergy \
  --nickname "Kinergy" \
  --access-level full
```

### Available Tools

All tools from `@roam-research/roam-tools-core`:

**Data tools**:
- `get_page` - Get page content
- `create_page` - Create page
- `get_block` - Get block content
- `create_block` - Create blocks
- `update_block` - Update block
- `delete_block` - Delete block
- `search` - Search pages/blocks
- `datalog_query` - Query database
- `roam_query` - Run Roam query
- `get_backlinks` - Get references
- And 16 more tools (comments, navigation, files)

### Pros

✅ Official Roam MCP server  
✅ Designed for AI assistants (Claude, etc.)  
✅ Full tool set (30+ operations)  
✅ Works within Claude Code / Claude.ai  
✅ Supports all Local API features  
✅ Latest version (v0.7.4, published 2026-06-13)  
✅ Structured tool definitions  
✅ Full read/write/file access  

### Cons

❌ Requires Roam Desktop running  
❌ Configuration complexity (MCP setup)  
❌ Learning curve for tool parameters  
❌ Debugging requires MCP knowledge  

### Dependencies

- Node.js 18+
- Roam Desktop app (running)
- `@roam-research/roam-tools-local` (included)
- `@roam-research/roam-tools-core` (included)
- Claude / Claude Code (to use)

### Architecture

```
Claude.ai / Claude Code
    ↓
MCP Protocol (stdio)
    ↓
@roam-research/roam-mcp
    ↓
@roam-research/roam-tools-local (Local API transport)
    ↓
@roam-research/roam-tools-core (Tool definitions)
    ↓
Roam Desktop (127.0.0.1:3333)
```

---

## Option 3: Cloud API SDK (`@roam-research/roam-api-sdk`)

### Installation

```bash
npm install @roam-research/roam-api-sdk
```

### Setup

```javascript
import { initializeGraph, q } from '@roam-research/roam-api-sdk';

const graph = initializeGraph({
  token: "roam-graph-token-XXXXX",  // Cloud API token
  graph: "YourGraphName",
});
```

### Usage Examples

**Query**:
```javascript
const results = await q(
  graph,
  '[:find ?page :where [?p :node/title ?page]]',
  []
);
```

**Search (Datalog)**:
```javascript
const blocks = await q(
  graph,
  `[:find ?block-uid ?block-str 
    :in $ ?search-string 
    :where [?b :block/uid ?block-uid] 
           [?b :block/string ?block-str]
           [(clojure.string/includes? ?block-str ?search-string)]]`,
  ["search term"]
);
```

### Supported Operations

- ✅ Query (Datalog)
- ✅ Pull (fetch entities)
- ✅ Create block
- ✅ Create page
- ✅ Update block
- ✅ Delete block
- ✅ Update page
- ✅ Delete page
- ✅ Move block

**Note**: Cloud API is read-heavy. For full CRUD, verify your token's permissions.

### Pros

✅ Web-based (no Roam Desktop needed)  
✅ Programmatic JavaScript API  
✅ Works from any environment  
✅ Official Roam SDK  
✅ Good for backend services  
✅ Documented Datalog query support  

### Cons

❌ Requires Cloud API token (not Local API token)  
❌ Data sent to Roam servers  
❌ **Does NOT work with `roam-graph-local-token-*` format**  
❌ **Does NOT work with Roam Desktop Local API**  
❌ Less documentation on full write capabilities  
❌ No MCP support  
❌ No file operations in base SDK  
❌ No UI/navigation controls  

### Dependencies

- Node.js (any modern version)
- `roam-graph-token-*` format Cloud API token
- Internet connection

### Important Limitation

**Your token format is INCOMPATIBLE with this SDK**:
- Your token: `roam-graph-local-token-LzWrKi_kHDBQ59qPaWx87sWZVjlgv`
- SDK expects: `roam-graph-token-XXXXX`

**Solution**: Use Option 1 or Option 2 instead (both support Local API tokens).

---

## Architecture Comparison

### Option 1: CLI

```
CLI Terminal
    ↓
@roam-research/roam-cli
    ↓
@roam-research/roam-tools-local (Local API)
    ↓
@roam-research/roam-tools-core (Tools)
    ↓
Roam Desktop (127.0.0.1:3333)
```

### Option 2: MCP Server

```
Claude / Claude Code
    ↓
MCP Protocol (stdio)
    ↓
@roam-research/roam-mcp
    ↓
@roam-research/roam-tools-local (Local API)
    ↓
@roam-research/roam-tools-core (Tools)
    ↓
Roam Desktop (127.0.0.1:3333)
```

### Option 3: Cloud SDK

```
Node.js App / Web Service
    ↓
@roam-research/roam-api-sdk
    ↓
HTTPS
    ↓
Roam Cloud API (api.roamresearch.com)
    ↓
Roam Backend
```

---

## Decision Matrix

**Use Option 1 (CLI) if you**:
- Need scripting/automation
- Want simplicity
- Are testing or prototyping
- Don't need MCP
- Prefer command-line tools

**Use Option 2 (MCP) if you**:
- Want Claude integration
- Need structured tools
- Will use Claude Code / Claude.ai
- Need MCP protocol support
- Want 30+ pre-defined tools

**Use Option 3 (Cloud SDK) if you**:
- Have a Cloud API token (`roam-graph-token-*`)
- Don't want/can't run Roam Desktop
- Building a backend service
- Need programmatic JavaScript API
- Can store tokens in config

**Do NOT use**:
- `roam-research-mcp` (outdated, uses Cloud API SDK, incompatible with your token format)

---

## Token Format Cheat Sheet

| Token Format | Use With | Where to Get |
|---|---|---|
| `roam-graph-local-token-*` | Option 1 (CLI) | Roam Desktop → Settings → Graph → Local API Tokens |
| `roam-graph-local-token-*` | Option 2 (MCP) | Roam Desktop → Settings → Graph → Local API Tokens |
| `roam-graph-token-*` | Option 3 (Cloud SDK) | Roam Web → Settings → Graph → API Tokens |

---

## Your Setup

**Your Token**: `roam-graph-local-token-LzWrKi_kHDBQ59qPaWx87sWZVjlgv`  
**Your Graph**: `Project_Kinergy`

**Recommended Path**:

1. **Quick Start**: Use Option 1 (CLI)
   ```bash
   npm install -g @roam-research/roam-cli
   roam connect --graph Project_Kinergy --nickname "Kinergy"
   roam search --query "test" --graph Kinergy
   ```

2. **AI Integration**: Use Option 2 (MCP)
   ```bash
   npm install @roam-research/roam-mcp
   # Configure in Claude
   # Use Claude to read/write your Roam graph
   ```

3. **Backend Service**: Get Cloud API token and use Option 3
   ```bash
   npm install @roam-research/roam-api-sdk
   # Use roam-graph-token-* format
   ```

---

## Proof-of-Concept Recommendation

For your immediate need (prove Roam → MCP → QA Ops data flow):

### Use Official MCP Server (Option 2)

**Why**:
1. Official package from Roam Research
2. Designed specifically for MCP + AI workflows
3. Your Local API token format (`roam-graph-local-token-*`) is supported
4. 30+ tools available
5. Published 2026-06-13 (latest)
6. Works with Claude Code

**Next Steps**:
1. Install: `npm install @roam-research/roam-mcp`
2. Connect: `npx @roam-research/roam-mcp connect`
3. Configure in Claude or use directly
4. Test: `roam search --graph Kinergy`
5. Integrate with QA Ops

---

## References

- **Official CLI**: https://www.npmjs.com/package/@roam-research/roam-cli
- **Official MCP**: https://www.npmjs.com/package/@roam-research/roam-mcp
- **Cloud SDK**: https://www.npmjs.com/package/@roam-research/roam-api-sdk
- **GitHub**: https://github.com/Roam-Research/roam-tools

