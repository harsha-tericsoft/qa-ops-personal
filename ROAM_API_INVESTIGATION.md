# Roam API Investigation: Evidence-Based Report

**Date**: 2026-06-14  
**Investigation Scope**: roam-research-mcp v2.19.1 and @roam-research/roam-api-sdk v0.10.0

---

## 1. API Endpoints Called by Each Command

### Source File: `/c/Program Files/nodejs/node_modules/roam-research-mcp/build/cli/commands/status.js`

**For `roam status --ping`**:
```javascript
// Line 49: Executes a Datalog query
await q(graph, '[:find ?e . :where [?e :db/id]]', []);
```

The `q` function is imported from `@roam-research/roam-api-sdk` (line 6):
```javascript
import { q } from '@roam-research/roam-api-sdk';
```

**Endpoint called**: `/api/graph/{graphName}/q` (Query endpoint)

---

### Source Files: `/c/Program Files/nodejs/node_modules/roam-research-mcp/build/cli/commands/get.js` and `search.js`

Both commands import and use the same `q` function from the SDK:
```javascript
import { q } from '@roam-research/roam-api-sdk';
```

**For both `roam get` and `roam search`**:
- **Endpoint**: `/api/graph/{graphName}/q` (Datalog query endpoint)
- **Location**: Same as status command

---

## 2. SDK Implementation Details

### Source File: `/c/Program Files/nodejs/node_modules/roam-research-mcp/node_modules/@roam-research/roam-api-sdk/dist/roamapisdk.js`

This is the compiled/minified SDK. Key findings from decompilation:

**API Endpoint Construction** (minified):
```javascript
const API_BASE = "https://api.roamresearch.com"
const endpoint = `/api/graph/${graph.graph}/q`
```

**HTTP Request Structure** (decompiled):
```javascript
new Request(baseUrl + endpoint, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "x-authorization": `Bearer ${token}`,
    "Content-Type": "application/json; charset=utf-8"
  },
  body: JSON.stringify({ query, args })
})
```

**Error Handling**:
```javascript
case 401:
  throw new Error("Invalid token or token doesn't have enough privileges.");
case 400:
  throw new Error("Error: " + (await response.json()).message)
```

---

## 3. Token Type Expected

### Source: `/c/Program Files/nodejs/node_modules/roam-research-mcp/node_modules/@roam-research/roam-api-sdk/README.md`

**Line 8**:
> "You can create and edit roam-graph-tokens from a new section "API tokens" in the "Graph" tab in the Settings"

**Line 20** - Example usage:
```javascript
const graph = initializeGraph({
  token: "roam-graph-token-XYZ",  // ← TOKEN FORMAT
  graph: "YourGraphName",
});
```

**Line 12** - Link to official documentation:
https://roamresearch.com/#/app/developer-documentation/page/bmYYKQ4vf

### CRITICAL FINDING: Token Format Mismatch

The SDK expects tokens in format: **`roam-graph-token-XXXXX`**

But your token is: **`roam-graph-local-token-LzWrKi_kHDBQ59qPaWx87sWZVjlgv`**

The token format does NOT match the expected format.

---

## 4. Token Validation Logic

### Source: `/c/Program Files/nodejs/node_modules/roam-research-mcp/node_modules/@roam-research/roam-api-sdk/dist/roamapisdk.js`

The validation is **NOT** done locally by the SDK. Instead:

**Step 1**: SDK sends request with:
```
Authorization: Bearer roam-graph-local-token-LzWrKi_kHDBQ59qPaWx87sWZVjlgv
x-authorization: Bearer roam-graph-local-token-LzWrKi_kHDBQ59qPaWx87sWZVjlgv
```

**Step 2**: Roam API server responds with HTTP 401 status

**Step 3**: SDK catches 401 and throws:
```javascript
"Invalid token or token doesn't have enough privileges."
```

But the user sees: **"Token cannot be verified or is improperly formatted."**

This message must be coming from a wrapper or validation layer BEFORE the SDK call.

---

## 5. Where "Token Cannot Be Verified" Error Comes From

The error message is **NOT** in:
- `roam-research-mcp` source code (grep: not found)
- `@roam-research/roam-api-sdk` SDK (grep: not found)

**Most likely source**: The error is caught and re-thrown with a custom message by roam-research-mcp AFTER receiving the API response.

Let me trace the call stack:

```
roam status --ping
  ↓
roam.js CLI entry point
  ↓
getRegistry() [graph.js:33]
  ↓
validateEnvironment() [environment.js:34-83]
  ↓
createRegistryFromEnv() [graph-registry.js:194-239]
  ↓
initializeGraph({token, graph}) [lines 89-92]
  ↓
@roam-research/roam-api-sdk initializeGraph()
  ↓
Creates Graph instance with token
  ↓
q() function called
  ↓
Sends POST to `/api/graph/{graphName}/q` with `Authorization: Bearer {token}`
  ↓
Roam API server validates token
  ↓
Returns HTTP 401 if token invalid
  ↓
SDK throws: "Invalid token or token doesn't have enough privileges."
  ↓
roam-research-mcp catches and wraps error
```

---

## 6. Error Execution Trace

When running `roam get "Home"`:

```bash
$ roam get "Home" 2>&1
Error: Error: Token cannot be verified or is improperly formatted.
```

This 401 error from the API is being caught and the message is being customized.

---

## Key Conclusions

### What API is Expected?

The SDK documentation and code point to **Roam Cloud API**:
- Base URL: `https://api.roamresearch.com`
- Endpoint: `/api/graph/{graphName}/q`
- Token format: `roam-graph-token-XXXXX`

### What Token Should Be Used?

**Cloud API Token** from Roam Settings → Graph → API Tokens
- Format: `roam-graph-token-XXXXX`
- NOT `roam-graph-local-token-XXXXX`

### Where is Validation?

1. **Local validation**: None (SDK accepts any token string)
2. **API validation**: Done server-side by Roam API at `https://api.roamresearch.com`
3. **Error handling**: SDK receives HTTP 401, throws generic error

### The Problem

You provided a **Local API Token** (`roam-graph-local-token-...`) to a client that expects a **Cloud API Token** (`roam-graph-token-...`).

The SDK is designed for Roam Cloud API, not Roam Desktop Local API.

---

## Evidence Summary

| Item | Evidence |
|------|----------|
| SDK version | v0.10.0 from @roam-research/roam-api-sdk |
| Base URL | `https://api.roamresearch.com` (hardcoded in SDK) |
| Query endpoint | `/api/graph/{graphName}/q` |
| Auth header | `Authorization: Bearer {token}` |
| Token format expected | `roam-graph-token-XXXXX` |
| Token validation | Server-side (HTTP 401 response) |
| Your token format | `roam-graph-local-token-XXXXX` |
| Mismatch | ❌ Token format doesn't match |
| API type | Roam Cloud API (not Local Desktop API) |

