# Roam API Options: Detailed Comparison Table

**Date**: 2026-06-14  
**Based on**: Source code inspection + official documentation

---

## Side-by-Side: Local API vs Cloud API

### Connection Details

| Aspect | Local API | Cloud API |
|--------|-----------|-----------|
| **Official Packages** | `@roam-research/roam-cli` v0.7.4 (2026-06-13)<br>`@roam-research/roam-mcp` (forthcoming)<br>`@roam-research/roam-tools-local` v0.7.4 | `@roam-research/roam-api-sdk` v0.10.0 (2023-06-14) |
| **Server Type** | Local HTTP | Cloud HTTPS |
| **Base URL** | `http://127.0.0.1:3333` | `https://api.roamresearch.com` |
| **Main Endpoint** | `/api/{graphName}` | `/api/graph/{graphName}/q` |
| **Port** | Configurable (default 3333) | 443 (HTTPS) |
| **Token Format** | `roam-graph-local-token-XXXXX` | `roam-graph-token-XXXXX` |
| **Token Length** | Varies (example: 32+ chars) | Varies (example: 32+ chars) |
| **Authentication** | `Authorization: Bearer {token}` | `Authorization: Bearer {token}` |
| **Requires Roam Desktop** | ✅ YES (running) | ❌ NO |
| **Requires Internet** | ❌ NO (local) | ✅ YES |
| **Data Location** | Stays on device | Transmitted to Roam servers |
| **Config File** | `~/.roam-tools.json` | Environment variable / hardcoded |

---

### Capabilities: Reading Data

| Operation | Local API | Cloud API |
|-----------|-----------|-----------|
| **Get page by title** | ✅ `get_page` | ✅ `pull` (limited) |
| **Get block by UID** | ✅ `get_block` | ✅ `pull` |
| **Search text** | ✅ `search` | ⚠️ Datalog only |
| **Datalog query** | ✅ `datalog_query` | ✅ `q` |
| **Roam query** | ✅ `roam_query` | ❌ NO |
| **Get backlinks** | ✅ `get_backlinks` | ❌ NO |
| **Get page guidelines** | ✅ `get_graph_guidelines` | ❌ NO |
| **Search templates** | ✅ `search_templates` | ❌ NO |
| **Recently edited** | ✅ (via search) | ❌ NO |

---

### Capabilities: Writing Data

| Operation | Local API | Cloud API |
|-----------|-----------|-----------|
| **Create page** | ✅ `create_page` | ✅ `createPage` |
| **Create block** | ✅ `create_block` | ✅ `createBlock` |
| **Update page title** | ✅ `update_page` | ❌ NO |
| **Update block** | ✅ `update_block` | ✅ `updateBlock` |
| **Delete page** | ✅ `delete_page` | ✅ `deletePage` |
| **Delete block** | ✅ `delete_block` | ✅ `deleteBlock` |
| **Move block** | ✅ `move_block` | ❌ NO |
| **Append to daily note** | ✅ `append_to_daily_note` | ❌ NO |

---

### Capabilities: Comments & Metadata

| Operation | Local API | Cloud API |
|-----------|-----------|-----------|
| **Add comment** | ✅ `add_comment` | ❌ NO |
| **Get comments** | ✅ `get_comments` | ❌ NO |
| **Get token info** | ✅ Endpoint exists | ❌ NO |
| **Check permissions** | ✅ (via token_info) | ❌ NO |

---

### Capabilities: Files

| Operation | Local API | Cloud API |
|-----------|-----------|-----------|
| **Get file** | ✅ `file_get` | ❌ NO |
| **Upload file** | ✅ `file_upload` | ❌ NO |
| **Delete file** | ✅ `file_delete` | ❌ NO |
| **Handles encryption** | ✅ YES (local) | ✅ YES (server-side) |

---

### Capabilities: Navigation & UI (Desktop Only)

| Operation | Local API | Cloud API |
|-----------|-----------|-----------|
| **Get open windows** | ✅ `get_open_windows` | ❌ NO |
| **Get selection** | ✅ `get_selection` | ❌ NO |
| **Open in main window** | ✅ `open_main_window` | ❌ NO |
| **Open in sidebar** | ✅ `open_sidebar` | ❌ NO |

---

### Permission Levels

| Level | Local API | Cloud API |
|-------|-----------|-----------|
| **Read-Only** | ✅ Supported | ✅ Supported |
| **Read + Append** | ✅ Supported | ⚠️ Limited (create only) |
| **Full Access** | ✅ Supported | ⚠️ Read-heavy |

---

### Error Handling

| Aspect | Local API | Cloud API |
|--------|-----------|-----------|
| **HTTP 401 (Auth Error)** | `MISSING_TOKEN`, `INVALID_TOKEN_FORMAT`, `TOKEN_NOT_FOUND` | Generic auth error |
| **HTTP 403 (Permission)** | `INSUFFICIENT_SCOPE`, `SCOPE_EXCEEDS_PERMISSION` | Not typically returned |
| **HTTP 404 (Not Found)** | Unknown action | Graph not found |
| **Version Mismatch** | `VERSION_MISMATCH` with guidance | Not applicable |
| **Retry Logic** | Built-in (auto-retry with deep link) | Manual |
| **Connection Recovery** | Opens Roam app automatically | N/A |

---

### Integration Methods

| Method | Local API | Cloud API |
|--------|-----------|-----------|
| **CLI Tool** | ✅ `@roam-research/roam-cli` | ❌ NO |
| **MCP Server** | ✅ `@roam-research/roam-mcp` | ❌ NO |
| **JavaScript SDK** | ✅ `@roam-research/roam-tools-local` | ✅ `@roam-research/roam-api-sdk` |
| **Python SDK** | ❌ NO | ❌ NO |
| **REST API** | ⚠️ HTTP (custom) | ✅ REST/HTTP |
| **Webhook Support** | ❌ NO | ❌ NO |

---

### Graph Type Support

| Graph Type | Local API | Cloud API |
|-----------|-----------|-----------|
| **Hosted (Web)** | ✅ YES | ✅ YES |
| **Offline (Desktop)** | ✅ YES | ❌ NO (web-based) |
| **Public** | ❌ NO | ✅ YES (read-only) |
| **Encrypted** | ✅ YES (local decrypt) | ✅ YES (server decrypt) |

---

### Configuration & Setup

| Aspect | Local API | Cloud API |
|--------|-----------|-----------|
| **Setup Complexity** | ✅ Easy: `roam connect` | ⚠️ Medium: Manual token creation |
| **Interactive Setup** | ✅ YES | ❌ NO (manual) |
| **Token Storage** | Secure (`~/.roam-tools.json`) | Application-managed |
| **Port Discovery** | Auto (`~/.roam-local-api.json`) | N/A |
| **Config File Format** | JSON (`~/.roam-tools.json`) | Environment variable / hardcoded |
| **Multi-Graph Support** | ✅ YES (nicknames) | ✅ YES (multiple tokens) |
| **Token Rotation** | ✅ Built-in | Manual |

---

### Performance Characteristics

| Aspect | Local API | Cloud API |
|--------|-----------|-----------|
| **Latency** | Ultra-low (local) | Network-dependent (100+ ms) |
| **Bandwidth** | Minimal (local) | Standard (network) |
| **Connection Pool** | Single HTTP | Managed by SDK |
| **Concurrent Requests** | Supported | Supported |
| **Rate Limiting** | None (local) | Roam server limits |
| **Throttling** | None (local) | Per-IP / per-token |

---

### Development Experience

| Aspect | Local API | Cloud API |
|--------|-----------|-----------|
| **Documentation** | ✅ Good (github.com/Roam-Research/roam-tools) | ⚠️ Sparse |
| **Examples** | ✅ CLI help + repo | ⚠️ Basic examples |
| **Type Definitions** | ✅ Full TypeScript types | ⚠️ Minimal |
| **Error Messages** | ✅ User-friendly | ⚠️ Generic |
| **Debugging** | ✅ Easy (local server) | ❌ Hard (remote) |
| **Testing** | ✅ Easy (local) | ⚠️ Requires API key |
| **Community** | 🆕 New ecosystem | 🔵 Established |

---

### Security & Privacy

| Aspect | Local API | Cloud API |
|--------|-----------|-----------|
| **Data at Rest** | Local device | Roam servers |
| **Data in Transit** | HTTP (local network) | HTTPS (encrypted) |
| **Token Exposure** | Local config file | Application managed |
| **Network Exposure** | None (local) | Roam API endpoints |
| **Offline Capability** | ✅ YES | ❌ NO (cloud-only) |
| **Encryption** | Local (filesystem) | Server-side |
| **Audit Logging** | Local (Roam app) | Server-side |

---

### Costs

| Aspect | Local API | Cloud API |
|--------|-----------|-----------|
| **Licensing** | Free (with Roam subscription) | Free (with Roam subscription) |
| **Infrastructure** | Your device | Roam servers |
| **Rate Limits** | None (local) | Roam-managed |
| **Premium Tier** | N/A | N/A |

---

## Critical Incompatibility Warning

### ⚠️ Your Token Format

**Your Token**: `roam-graph-local-token-LzWrKi_kHDBQ59qPaWx87sWZVjlgv`

**This token ONLY works with**:
- ✅ Local API (`@roam-research/roam-cli`, `@roam-research/roam-mcp`)
- ✅ `@roam-research/roam-tools-local`

**This token does NOT work with**:
- ❌ `@roam-research/roam-api-sdk` (Cloud API)
- ❌ `roam-research-mcp` v2.19.1 (outdated, uses Cloud SDK)

**Solution**: Use the official `@roam-research/roam-mcp` package (not roam-research-mcp)

---

## Quick Decision Guide

### I want to read from Roam
**→ Use Local API** (any package)

### I want to write to Roam
**→ Use Local API** (full CRUD support)

### I want to use CLI commands
**→ Use `@roam-research/roam-cli`**

### I want AI/Claude integration
**→ Use `@roam-research/roam-mcp` (Official MCP)**

### I want programmatic access
**→ Use Local API SDK or Cloud API SDK** (choose based on token format)

### I don't have Roam Desktop running
**→ Use Cloud API SDK** (but you need a `roam-graph-token-*` token)

### I have a `roam-graph-local-token-*` token
**→ MUST use Local API packages**

### I have a `roam-graph-token-*` token
**→ Can use Cloud API SDK**

---

## Summary Table

| Feature | Local | Cloud |
|---------|-------|-------|
| Full read/write | ✅ YES | ⚠️ Limited |
| Desktop required | ✅ YES | ❌ NO |
| File operations | ✅ YES | ❌ NO |
| UI controls | ✅ YES | ❌ NO |
| Offline mode | ✅ YES | ❌ NO |
| Official CLI | ✅ YES | ❌ NO |
| Official MCP | ✅ YES | ❌ NO |
| Web-based | ❌ NO | ✅ YES |
| Always available | ❌ NO | ✅ YES |
| Complex setup | ❌ Easy | ⚠️ Medium |

---

**Recommendation**: For your proof-of-concept with `roam-graph-local-token-*`, use the **official `@roam-research/roam-mcp`** package (not roam-research-mcp).

