# Roam Desktop Local API Investigation

**Date**: 2026-06-14  
**Status**: ✅ OFFICIAL ROAM LOCAL API PACKAGES FOUND  
**Source**: npm packages + source code inspection

---

## 1. Official Roam Local API Packages

### Primary Package: `@roam-research/roam-cli`

**Version**: 0.7.4 (published 2026-06-13)  
**npm**: https://www.npmjs.com/package/@roam-research/roam-cli  
**GitHub**: https://github.com/Roam-Research/roam-tools  
**Description**: Official command-line interface for Roam Research

**Purpose**: Setup, token management, and direct tool access (search, get pages, create blocks, etc.)

**Installation**:
```bash
npm install -g @roam-research/roam-cli
```

---

### Supporting Package: `@roam-research/roam-tools-local`

**Version**: 0.7.4 (published 2026-06-13)  
**npm**: https://www.npmjs.com/package/@roam-research/roam-tools-local  
**Description**: Local Roam Desktop API transport for @roam-research/roam-tools-core

**Purpose**: Provides HTTP client for Roam's local API, token management, graph resolution

**Key Feature**: Wraps core with a `RoamClient` that talks to Roam Desktop on `127.0.0.1`

---

### Core Package: `@roam-research/roam-tools-core`

**Version**: 0.7.5 (published 2026-06-14)  
**npm**: https://www.npmjs.com/package/@roam-research/roam-tools-core  
**Description**: Official transport-agnostic core for Roam Research MCP and CLI tools

**Purpose**: Tool definitions and execution logic (transport-independent)

---

## 2. Local API Authentication

### Token Format

**Expected Format**: `roam-graph-local-token-XXXXX`

**Example**: `roam-graph-local-token-LzWrKi_kHDBQ59qPaWx87sWZVjlgv`

**Source**: 
- `/node_modules/@roam-research/roam-tools-local/dist/client.js` (line 105)
- `getAuthErrorGuidance(code)` function

**Error if format invalid**:
```
Authentication failed. The token format is invalid. 
Tokens should start with 'roam-graph-local-token-'.
```

---

### Token Acquisition

**Two Methods**:

#### Method 1: Interactive Setup (Recommended)
```bash
roam connect
```

1. Walks through selecting a graph
2. Chooses permission level
3. Approves token in Roam Desktop app
4. Token is generated and stored in `~/.roam-tools.json`

#### Method 2: Non-Interactive
```bash
roam connect --graph my-graph-name \
  --nickname "My Team Graph" \
  --access-level full
```

**Access Levels**:
- `read-only` - Read pages, blocks, search only
- `read-append` - Read + create new blocks/pages
- `full` - Read, create, update, delete

---

### Token Storage

**Config File**: `~/.roam-tools.json`

**Example Content**:
```json
{
  "version": "1",
  "graphs": {
    "my-graph": {
      "nickname": "My Graph",
      "type": "hosted",
      "token": "roam-graph-local-token-LzWrKi_kHDBQ59qPaWx87sWZVjlgv",
      "accessLevel": "full",
      "lastKnownTokenStatus": "active"
    }
  }
}
```

---

## 3. Local API Connection Details

### Endpoint Structure

**Main API Endpoint**:
```
POST http://127.0.0.1:{port}/api/{graphName}
```

**Port Discovery**:
- Reads from: `~/.roam-local-api.json`
- Default port: `3333` (if file doesn't exist)

**Example Configuration File** (`~/.roam-local-api.json`):
```json
{
  "port": 3333
}
```

### HTTP Headers

```
Content-Type: application/json
Authorization: Bearer {token}
```

### Request Body

```json
{
  "action": "get_page",
  "args": ["My Page"],
  "expectedApiVersion": "2.0.0"
}
```

---

### Other Endpoints

**List Available Graphs**:
```
GET http://127.0.0.1:{port}/api/graphs/available
```

**Request Token**:
```
POST http://127.0.0.1:{port}/api/graphs/tokens/request
```

**Token Info** (permissions):
```
POST http://127.0.0.1:{port}/api/graphs/tokens/info
```

---

## 4. Supported Operations

### Data Operations (Read)

- ✅ `get_page` - Get a page's content as markdown
- ✅ `get_block` - Get a block's content as markdown
- ✅ `search` - Search pages and blocks by text
- ✅ `get_backlinks` - Get linked references
- ✅ `datalog_query` - Execute Datomic-style queries
- ✅ `roam_query` - Execute Roam queries
- ✅ `search_templates` - Search Roam templates
- ✅ `get_graph_guidelines` - Get user preferences/conventions

### Data Operations (Write)

- ✅ `create_page` - Create new page with markdown
- ✅ `create_block` - Create blocks from markdown
- ✅ `update_page` - Update page title
- ✅ `update_block` - Update block text/properties
- ✅ `delete_page` - Delete page (irreversible)
- ✅ `delete_block` - Delete block (irreversible)
- ✅ `move_block` - Move block to new location
- ✅ `append_to_daily_note` - Capture to daily note

### Comments

- ✅ `add_comment` - Add comment to block
- ✅ `get_comments` - Get block comments

### Navigation (Desktop Only)

- ✅ `get_open_windows` - Get current view
- ✅ `get_selection` - Get focused/selected blocks
- ✅ `open_main_window` - Navigate to page/block
- ✅ `open_sidebar` - Open in right sidebar

### Files (Desktop Only)

- ✅ `file_get` - Fetch file from Roam
- ✅ `file_upload` - Upload file to Roam
- ✅ `file_delete` - Delete file from Roam

---

## 5. Comparison: Local API vs Cloud API

| Feature | Local API (Desktop) | Cloud API |
|---------|-------------------|-----------|
| **Package** | `@roam-research/roam-cli` | `@roam-research/roam-api-sdk` |
| **Token Format** | `roam-graph-local-token-*` | `roam-graph-token-*` |
| **Where to Get Token** | Roam Settings → Graph → Local API Tokens | Roam Settings → Graph → API Tokens |
| **Server Location** | Local (`127.0.0.1:3333`) | Cloud (`api.roamresearch.com`) |
| **Port** | Configurable (default 3333) | 443 (HTTPS) |
| **Connection Type** | Local HTTP | HTTPS |
| **Requires Roam Desktop** | ✅ YES (required) | ❌ NO (web-based) |
| **Authentication** | Bearer token in Authorization header | Bearer token in Authorization header |
| **Base Endpoint** | `/api/{graph}` | `/api/graph/{graph}/q` |
| **Read Pages** | ✅ YES | ✅ YES |
| **Read Blocks** | ✅ YES | ✅ YES |
| **Search** | ✅ YES | ✅ YES |
| **Create Blocks** | ✅ YES | ❌ NO (read-only) |
| **Update Blocks** | ✅ YES | ❌ NO (read-only) |
| **Delete Blocks** | ✅ YES | ❌ NO (read-only) |
| **File Operations** | ✅ YES | ❌ NO |
| **Desktop UI Operations** | ✅ YES | ❌ NO |
| **Graph Type Support** | Hosted + Offline | Hosted only |
| **Availability** | When Desktop app runs | Always (web-based) |
| **Data Sensitivity** | Local only | Transmitted to cloud |
| **MCP Support** | ✅ YES (`@roam-research/roam-mcp`) | ❌ NO |
| **CLI Support** | ✅ YES (`@roam-research/roam-cli`) | ❌ YES (SDK only) |

---

## 6. Why roam-research-mcp (v2.19.1) Doesn't Work with Local Tokens

**Key Finding**: The `roam-research-mcp` v2.19.1 package uses `@roam-research/roam-api-sdk` v0.10.0, which is the **Cloud API SDK**.

The official Roam packages have evolved:

- **Old**: `roam-research-mcp` → `@roam-research/roam-api-sdk` (Cloud API)
- **New**: `@roam-research/roam-cli` → `@roam-research/roam-tools-local` → `@roam-research/roam-tools-core` (Local API)

The new architecture separates:
1. **Transport** (`roam-tools-local` for local, other packages for hosted)
2. **Core** (`roam-tools-core` - tool definitions)
3. **Clients** (`roam-cli`, `roam-mcp`)

Your `roam-research-mcp` v2.19.1 uses the old Cloud API SDK and **cannot** authenticate with Local API tokens.

---

## 7. How to Use Roam Local API with Your Token

### Option 1: Use Official CLI (Recommended)

```bash
# Install
npm install -g @roam-research/roam-cli

# Configure (if not already done)
roam connect --graph Project_Kinergy --nickname "Kinergy" --access-level full

# Use CLI
roam search --query "todo"
roam get-page --title "My Page"
roam create-page --title "New Page"
roam create-block --title "My Page" --markdown "- [ ] Task 1"
```

### Option 2: Use Official MCP Server

**Package**: `@roam-research/roam-mcp`

```bash
# Install
npm install @roam-research/roam-mcp
```

This is the officially maintained MCP server with Local API support (unlike `roam-research-mcp`).

### Option 3: Direct SDK Usage

**Package**: `@roam-research/roam-tools-local`

```javascript
import { createRoamClient, routeToolCall } from '@roam-research/roam-tools-local';

const client = new RoamClient({
  graphName: "Project_Kinergy",
  graphType: "hosted",
  token: "roam-graph-local-token-LzWrKi_kHDBQ59qPaWx87sWZVjlgv"
});

const result = await client.call('get_page', ['My Page']);
```

---

## 8. Configuration Files

### File 1: `~/.roam-tools.json`

**Purpose**: Graph connections and tokens (maintained by CLI)

**Location**: User's home directory

**Contents**:
```json
{
  "version": "1",
  "graphs": {
    "kinergy": {
      "nickname": "Kinergy",
      "type": "hosted",
      "token": "roam-graph-local-token-LzWrKi_kHDBQ59qPaWx87sWZVjlgv",
      "accessLevel": "full",
      "lastKnownTokenStatus": "active"
    }
  }
}
```

### File 2: `~/.roam-local-api.json`

**Purpose**: Roam Desktop Local API port configuration

**Location**: User's home directory

**Contents**:
```json
{
  "port": 3333
}
```

**Generated by**: Roam Desktop app (auto-created when you first enable Local API)

---

## 9. Source Code Evidence

### Token Format Validation

**File**: `@roam-research/roam-tools-local/dist/client.js`

**Lines 103-105**:
```javascript
case ErrorCodes.INVALID_TOKEN_FORMAT:
  return (baseMsg +
    "The token format is invalid. Tokens should start with 'roam-graph-local-token-'.");
```

### API Endpoint

**File**: `@roam-research/roam-tools-local/dist/client.js`

**Lines 220-238**:
```javascript
async call(action, args = []) {
  const port = await this.getPort();
  let url = `http://127.0.0.1:${port}/api/${this.graphName}`;
  if (this.graphType === "offline") {
    url += "?type=offline";
  }
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

### Token Info Endpoint

**File**: `@roam-research/roam-tools-local/dist/client.js`

**Lines 175-210**:
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

---

## Summary

✅ **Roam Desktop Local API IS officially supported**

✅ **Token format**: `roam-graph-local-token-XXXXX`

✅ **Official packages**: 
- `@roam-research/roam-cli` (CLI)
- `@roam-research/roam-mcp` (MCP server - **different** from roam-research-mcp)
- `@roam-research/roam-tools-local` (SDK)

✅ **Capabilities**: Full read/write access, file ops, desktop UI integration

❌ **roam-research-mcp v2.19.1** is outdated and uses Cloud API SDK - **not compatible with Local tokens**

---

## References

**GitHub Repository**: https://github.com/Roam-Research/roam-tools  
**NPM Package**: https://www.npmjs.com/package/@roam-research/roam-cli  
**Documentation**: https://github.com/Roam-Research/roam-tools#readme

