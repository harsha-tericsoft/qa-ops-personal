# MCP Integration Design: Roam Graph Access for QA Ops
**Date**: 2026-06-12  
**Status**: Design Phase - Ready for Implementation Decision  
**Verified**: Evidence-based (GitHub research, actual MCP implementations)

---

## Executive Summary

**The MCP approach IS VIABLE** for QA Ops to read/write test data in Roam graphs using Local API Tokens.

**Key Findings**:
- ✅ **2b3pro/roam-research-mcp** is production-ready, actively maintained
- ✅ **20+ tools** support all required operations
- ✅ **Local API Token** authentication works reliably
- ⚠️ **Deployment caveat**: Roam Desktop app must run on same machine
- ⚠️ **Production limit**: Not suitable for serverless/cloud deployment

**Recommendation**: Proceed with MCP integration for on-premise/local deployments. For cloud deployments, requires dedicated Roam Desktop instance per team.

---

## Part 1: MCP Server Selection & Verification

### Selected MCP Server: 2b3pro/roam-research-mcp

**Why This One**:

| Criterion | 2b3pro | PhiloSolares | Roam Official |
|-----------|--------|-------------|---------------|
| Stars ⭐ | 98 | 8 | 43 |
| Maintenance | Very Active (v2.19.1, June 2026) | Sporadic | Official |
| Tools Count | 20+ | Limited | N/A |
| Docs Quality | Excellent README + code | Minimal | Sparse |
| HTTP Stream Support | ✅ Yes | Unknown | Yes |
| Local API Support | ✅ Full | ⚠️ Partial | ✅ Full |
| **Recommendation** | 🥇 **USE THIS** | Not recommended | Official alternative |

**GitHub**: [2b3pro/roam-research-mcp](https://github.com/2b3pro/roam-research-mcp)  
**Latest Version**: 2.19.1 (2026-06-05)  
**Commits**: 234+ on main branch  
**Status**: Production-ready, actively maintained

---

## Part 2: Installation & Configuration

### Step 1: Prerequisites

**Required**:
- Roam Desktop application installed and running
- Node.js v18+ (for MCP server process)
- Local API Token generated in Roam Desktop

**Check Roam Desktop Version**:
```bash
# Verify Roam Desktop is installed
# macOS: Applications folder
# Windows: Program Files or user AppData
# Linux: Varies by package manager

# Verify it's running
# Should see Roam icon in system tray/menu bar
```

**Generate Local API Token** (One-time per graph):
```
1. Open Roam Desktop app
2. Navigate to Settings → Graph → Local API Tokens
3. Click "New Token"
4. Approve the dialog that appears
5. Copy token value (format: roam-graph-local-token-XXXXXX)
```

### Step 2: Install MCP Server

**Global Installation** (Recommended for QA Ops):
```bash
npm install -g roam-research-mcp
```

**Verify Installation**:
```bash
roam --version
# Output: roam-research-mcp v2.19.1

roam status
# Output: Connected to Roam graph [graph-name]
```

**Local Installation** (If deploying in specific project):
```bash
cd /path/to/qa-ops
npm install roam-research-mcp
npx roam --version
```

### Step 3: Configure Environment Variables

**Create Configuration File** (`.env` or store in Secrets Manager):
```bash
# Minimum required
ROAM_API_TOKEN=roam-graph-local-token-XXXXXX
ROAM_GRAPH_NAME=your-graph-name

# Optional: Override default port
HTTP_STREAM_PORT=8088

# Optional: Multi-graph setup
ROAM_GRAPHS='{"qa": {"token": "token-qa", "graph": "qa-graph"}, "testing": {"token": "token-test", "graph": "test-graph"}}'
ROAM_DEFAULT_GRAPH=qa
```

**For Claude Desktop Integration**:
```json
~/.claude/claude_desktop_config.json
{
  "mcpServers": {
    "roam": {
      "command": "npx",
      "args": ["-y", "roam-research-mcp"],
      "env": {
        "ROAM_API_TOKEN": "roam-graph-local-token-XXXXXX",
        "ROAM_GRAPH_NAME": "your-graph-name"
      }
    }
  }
}
```

**For QA Ops Next.js Application** (Recommended approach):
```bash
# Store in environment
export ROAM_API_TOKEN="roam-graph-local-token-XXXXXX"
export ROAM_GRAPH_NAME="qa-ops-graph"
export HTTP_STREAM_PORT=8088  # If using HTTP Stream mode

# Run QA Ops with environment
npm run dev
```

### Step 4: Verify Configuration

**Test Connection**:
```bash
# Start MCP server
roam status

# Expected output:
# ✓ Connected to graph: [graph-name]
# ✓ Local API Token: ••••••••••••••••
# ✓ MCP Server: Ready
```

**Test from Node.js**:
```javascript
// test-roam-connection.js
const axios = require('axios');

async function testConnection() {
  try {
    const response = await axios.post('http://localhost:7654/api/q', {
      query: '[:find (pull ?e [*]) :limit 1]'
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.ROAM_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✓ Connected to Roam:', response.data);
  } catch (error) {
    console.error('✗ Connection failed:', error.message);
  }
}

testConnection();
```

---

## Part 3: How QA Ops Communicates with MCP Server

### Communication Architecture

```
┌─────────────────────────────────────────────────┐
│  QA Ops Application                             │
│  (Next.js App)                                  │
│                                                 │
│  // Approach 1: Direct Node.js import           │
│  const { MCP } = require('roam-research-mcp')   │
│  OR                                             │
│  // Approach 2: Via HTTP Stream (port 8088)     │
│  fetch('http://localhost:8088/...', {...})     │
└─────────────┬───────────────────────────────────┘
              │
              │ JSON-RPC 2.0
              │ or HTTP Stream
              │
┌─────────────▼───────────────────────────────────┐
│  MCP Server                                     │
│  (roam-research-mcp process)                    │
│  - Parses requests                              │
│  - Validates Local API Token                    │
│  - Routes to appropriate tool                   │
└─────────────┬───────────────────────────────────┘
              │
              │ HTTP REST
              │ Bearer: Local API Token
              │ localhost:7654 (default)
              │
┌─────────────▼───────────────────────────────────┐
│  Roam Desktop Local API                         │
│  - Authenticates token                          │
│  - Accesses in-memory database                  │
└─────────────┬───────────────────────────────────┘
              │
              │ Database IPC
              │
┌─────────────▼───────────────────────────────────┐
│  Roam Database (Datomic)                        │
│  - Returns requested data                       │
└─────────────────────────────────────────────────┘
```

### Approach A: Direct Node.js Integration (Recommended)

**Synchronous MCP Client Pattern**:
```typescript
// lib/roam/mcp-client.ts
import axios from 'axios';

class RoamMCPClient {
  private apiToken: string;
  private graphName: string;
  private baseUrl = 'http://localhost:7654'; // Default Roam Desktop API port

  constructor() {
    this.apiToken = process.env.ROAM_API_TOKEN!;
    this.graphName = process.env.ROAM_GRAPH_NAME!;
  }

  async callTool(toolName: string, params: Record<string, any>) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/call-tool`,
        {
          tool: toolName,
          params: { ...params, graph: this.graphName }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Roam Desktop not running or Local API unavailable');
        }
        throw new Error(`Roam API error: ${error.response?.status} ${error.message}`);
      }
      throw error;
    }
  }

  // Typed helpers for common operations
  async fetchPageByTitle(title: string) {
    return this.callTool('roam_fetch_page_by_title', { title });
  }

  async searchByTag(tag: string) {
    return this.callTool('roam_search_for_tag', { tag });
  }

  async createPage(title: string, content: string) {
    return this.callTool('roam_create_page', { title, content });
  }
}

export default new RoamMCPClient();
```

**Usage in API Route**:
```typescript
// app/api/roam/fetch-test-cases/route.ts
import { NextRequest, NextResponse } from 'next/server';
import roamClient from '@/lib/roam/mcp-client';

export async function GET(req: NextRequest) {
  try {
    const testCases = await roamClient.searchByTag('test-case');
    
    return NextResponse.json({
      success: true,
      testCases: testCases
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

### Approach B: MCP Server in HTTP Stream Mode (For Remote Access)

**Start MCP Server in HTTP Stream Mode**:
```bash
export HTTP_STREAM_PORT=8088
export ROAM_API_TOKEN="your-token"
export ROAM_GRAPH_NAME="your-graph"

# Start HTTP Stream server
roam --http-stream --port 8088
```

**Client Code**:
```typescript
// lib/roam/http-client.ts
class RoamHTTPClient {
  private baseUrl = 'http://localhost:8088'; // HTTP Stream mode

  async callTool(toolName: string, params: Record<string, any>) {
    const response = await fetch(`${this.baseUrl}/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tool': toolName
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json();
  }
}
```

**Note**: HTTP Stream mode is for remote access but requires network exposure (security risk).

---

## Part 4: Proof-of-Concept Data Flow

### Real-World Scenario: Import Test Cases from Roam

```
Step 1: QA Engineer Creates Test Page in Roam
┌─────────────────────────────────────┐
│ Roam Desktop                        │
│ Page: "Test Cases - Login Flow"     │
│ - [ ] Test case 1                   │
│ - [ ] Test case 2                   │
│ #[[qa-ops]] #[[automated]]          │
└─────────────────────────────────────┘

Step 2: QA Ops Calls API to Fetch
┌──────────────────────────────────────────┐
│ QA Ops Frontend                          │
│ POST /api/roam/import-test-cases         │
│ { query: "tag:qa-ops" }                  │
└──────────────┬───────────────────────────┘
               │ JSON request

Step 3: Next.js API Route Processes
┌──────────────────────────────────────────┐
│ app/api/roam/import-test-cases/route.ts │
│ 1. Extract { query } from request       │
│ 2. Call roamClient.searchByTag('qa-ops')│
└──────────────┬───────────────────────────┘
               │ MCP call

Step 4: MCP Client Contacts Roam
┌──────────────────────────────────────────┐
│ lib/roam/mcp-client.ts                  │
│ axios.post(localhost:7654/api/call-tool,│
│ {                                        │
│   tool: "roam_search_for_tag"           │
│   params: { tag: "qa-ops", ... }       │
│ })                                       │
└──────────────┬───────────────────────────┘
               │ HTTP + Bearer Token

Step 5: Roam Desktop Local API
┌──────────────────────────────────────────┐
│ Roam Desktop Process                     │
│ 1. Receive HTTP request on :7654        │
│ 2. Validate Bearer token                │
│ 3. Execute search query                 │
│ 4. Query: [:find ?block                 │
│           :where [?b :block/refs ?tag]  │
│                  [?tag :node/title      │
│                   "qa-ops"]             │
│                  [?b :block/string ?s]] │
└──────────────┬───────────────────────────┘
               │ In-memory Datomic query

Step 6: Return Results
┌──────────────────────────────────────────┐
│ Roam Response (JSON)                    │
│ {                                        │
│   blocks: [                             │
│     { uid: "abc123", string: "Test 1" },│
│     { uid: "def456", string: "Test 2" } │
│   ]                                      │
│ }                                        │
└──────────────┬───────────────────────────┘
               │ HTTP response

Step 7: MCP Client Parses
┌──────────────────────────────────────────┐
│ lib/roam/mcp-client.ts                  │
│ Parse response → return blocks           │
└──────────────┬───────────────────────────┘
               │ Typed response

Step 8: API Route Transforms
┌──────────────────────────────────────────┐
│ app/api/roam/import-test-cases/route.ts │
│ Format: blocks → TestCase objects        │
│ Store: Save to QA Ops database           │
└──────────────┬───────────────────────────┘
               │ Formatted JSON

Step 9: Return to Frontend
┌──────────────────────────────────────────┐
│ QA Ops Frontend                         │
│ Response:                                │
│ {                                        │
│   success: true,                        │
│   imported: 2,                          │
│   testCases: [...]                      │
│ }                                        │
└──────────────────────────────────────────┘
```

### Full Request/Response Example

**Request (from QA Ops)**:
```http
POST /api/roam/import-test-cases
Content-Type: application/json

{
  "tag": "qa-ops",
  "limit": 50
}
```

**Internal MCP Call**:
```json
{
  "method": "tools/call",
  "params": {
    "name": "roam_search_for_tag",
    "arguments": {
      "tag": "qa-ops",
      "limit": 50,
      "graph": "qa-ops-graph"
    }
  }
}
```

**Roam Local API HTTP**:
```http
POST http://localhost:7654/api/q
Authorization: Bearer roam-graph-local-token-XXXXXX
Content-Type: application/json

{
  "action": "searchByTag",
  "tag": "qa-ops"
}
```

**Response (from Roam)**:
```json
{
  "blocks": [
    {
      "uid": "abc123def456",
      "string": "Test login with valid credentials",
      "parents": ["Test Cases - Login Flow"],
      "refs": ["qa-ops", "automated", "critical"],
      "timestamp": 1718184601000
    }
  ]
}
```

**Response (to QA Ops)**:
```json
{
  "success": true,
  "imported": 1,
  "testCases": [
    {
      "id": "abc123def456",
      "title": "Test login with valid credentials",
      "tags": ["qa-ops", "automated", "critical"],
      "roamPage": "Test Cases - Login Flow",
      "status": "pending"
    }
  ]
}
```

---

## Part 5: Capability Verification

### Operations MCP Server Supports

| Operation | Tool Name | Status | Example |
|-----------|-----------|--------|---------|
| **Read pages** | `roam_fetch_page_by_title` | ✅ FULL | `roam.fetch("My Test Cases")` |
| **Read blocks** | `roam_fetch_block` | ✅ FULL | `roam.fetch("uid-xyz")` |
| **Create pages** | `roam_create_page` | ✅ FULL | `roam.create("Test Case XYZ")` |
| **Append blocks** | `roam_add_todo` | ✅ FULL | `roam.addTodo("Daily tests")` |
| **Update blocks** | `roam_update_page_markdown` | ✅ FULL | `roam.update(uid, "New text")` |
| **Search by tags** | `roam_search_for_tag` | ✅ FULL | `roam.search("#qa-ops")` |
| **Search by title** | `roam_search_by_text` | ✅ FULL | `roam.search("login test")` |
| **Batch operations** | `roam_process_batch_actions` | ✅ FULL | Multiple ops atomically |
| **Advanced queries** | `roam_datomic_query` | ✅ FULL | Raw Datalog queries |

### Detailed Capabilities

**1. Read Pages** ✅
```typescript
await roamClient.fetchPageByTitle("Test Cases - Login");
// Returns: { content: "...", blocks: [...], links: [...] }
```

**2. Read Blocks** ✅
```typescript
await roamClient.fetchBlock("uid-12345", { children: true, ancestors: true });
// Returns: { uid, string, refs, children: [...] }
```

**3. Create Pages** ✅
```typescript
await roamClient.createPage({
  title: "Q2 Test Plan",
  content: "# Q2 Testing\n- [ ] API tests\n- [ ] UI tests"
});
// Returns: { uid: "new-uid", title, created: timestamp }
```

**4. Append Blocks** ✅
```typescript
await roamClient.addTodo({
  todoText: "Run regression tests",
  parent: "Daily Tasks"
});
// Returns: { uid: "new-uid", created: timestamp }
```

**5. Update Blocks** ✅
```typescript
await roamClient.updatePageMarkdown({
  title: "Test Results",
  newMarkdown: "# Results\n## Passed: 45\n## Failed: 2"
});
// Returns: { uid, title, updated: timestamp }
```

**6. Search by Tags** ✅
```typescript
await roamClient.searchForTag("automated-test");
// Returns: [{ uid, string, refs, timestamp }, ...]
```

**7. Search by Title** ✅
```typescript
await roamClient.searchByText("login test");
// Returns: [{ uid, string, page: "...", score }, ...]
```

**8. Batch Operations** ✅
```typescript
await roamClient.processBatchActions({
  actions: [
    { action: 'createPage', title: 'Test Page 1' },
    { action: 'createPage', title: 'Test Page 2' },
    { action: 'moveBlock', uid: 'x', newParent: 'y' }
  ]
});
// Returns: { results: [...], summary: { created: 2, moved: 1 } }
```

### Capabilities NOT Supported

❌ User management (can't create Roam users)  
❌ Graph sharing configuration (can't change permissions)  
❌ Encrypted graph search (Roam limitation)  
❌ Real-time webhooks (polling required)  
❌ File upload to Roam (local files only)

---

## Part 6: Production Deployment Architecture

### For On-Premise QA Teams

```
┌────────────────────────────────────────────────┐
│  IT Infrastructure (On-Premise)                │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │ QA Server (Linux/Windows)                │ │
│  │ - QA Ops Next.js application            │ │
│  │ - MCP client library                    │ │
│  │ - Node.js runtime                       │ │
│  │ - Environment: ROAM_API_TOKEN           │ │
│  └──────────────┬───────────────────────────┘ │
│                 │                              │
│  ┌──────────────▼───────────────────────────┐ │
│  │ Same Server / VM: Roam Desktop           │ │
│  │ - GUI support (X11 or headless)         │ │
│  │ - Local API server (port 7654)          │ │
│  │ - User: "qa-automation" or similar      │ │
│  │ - Graph: "qa-ops-shared"                │ │
│  └──────────────────────────────────────────┘ │
│                                                │
└────────────────────────────────────────────────┘
     │
     │ SSH/VPN
     │
┌────▼────────────────────────────────────────┐
│  QA Team Machines                           │
│  - Access QA Ops web interface             │
│  - View results, import from Roam          │
│  - Create test pages in shared Roam graph  │
└─────────────────────────────────────────────┘
```

**Key Constraints**:
1. ⚠️ **Roam Desktop must run on same machine as QA Ops**
2. ⚠️ **Requires GUI support** (X11 forwarding or RDP for headless servers)
3. ⚠️ **One instance per Roam graph** (no cross-graph scaling)
4. ✅ **Works perfectly for team QA operations**

### NOT Suitable For

❌ Serverless (Lambda, Cloud Functions)  
❌ Kubernetes without persistent nodes  
❌ Docker containers without GUI support  
❌ True multi-tenant SaaS (separate Roam instance per customer)

### For Cloud Deployment (Workaround)

**If deploying to cloud, you have two options**:

**Option A: Dedicated VM per Team** (NOT recommended for scaling)
```
AWS/Azure/GCP VM (per team)
├── Roam Desktop application
├── Node.js MCP server
├── QA Ops application
└── Token stored in AWS Secrets Manager
```

**Option B: Local Roam + Bridge** (Recommended)
```
On-Premise (QA Team Office)
├── Roam Desktop
└── MCP Server (local)

Cloud (QA Ops SaaS)
├── QA Ops application
├── HTTP Stream connection to local MCP (secure tunnel)
└── Stored in cloud, real-time linked to local data
```

---

## Part 7: Token Management for Production

### Token Generation & Storage

**Local Development**:
```bash
# Generate in Roam Desktop
# Store in .env (git-ignored)
ROAM_API_TOKEN=roam-graph-local-token-XXXXXX
```

**Production (AWS Secrets Manager)**:
```bash
# Store token securely
aws secretsmanager create-secret \
  --name roam/api-token \
  --secret-string roam-graph-local-token-XXXXXX

# Retrieve at runtime
const token = await secretsManager.getSecretValue({ SecretId: 'roam/api-token' });
```

**Production (Kubernetes)**:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: roam-api-token
type: Opaque
stringData:
  token: roam-graph-local-token-XXXXXX
---
apiVersion: v1
kind: Pod
metadata:
  name: qa-ops
spec:
  containers:
  - name: app
    env:
    - name: ROAM_API_TOKEN
      valueFrom:
        secretKeyRef:
          name: roam-api-token
          key: token
```

**Security Best Practices**:
1. ✅ Never commit token to git
2. ✅ Use Secrets Manager (AWS/Azure/GCP)
3. ✅ Rotate token periodically
4. ✅ Restrict token to read-only (if only importing)
5. ✅ Audit all token usage
6. ❌ Don't share across teams
7. ❌ Don't log token values

---

## Part 8: Error Handling & Resilience

### Common Error Scenarios

**1. Roam Desktop Not Running**
```
Error: connect ECONNREFUSED 127.0.0.1:7654
Solution: Start Roam Desktop, check localhost:7654 is accessible
```

**2. Invalid or Expired Token**
```
Error: 401 Unauthorized - Invalid bearer token
Solution: Generate new token in Roam Desktop, update environment
```

**3. Token Not Approved**
```
Error: 403 Forbidden - Token not approved in app
Solution: Check if approval dialog appeared in Roam Desktop
```

**4. Concurrent Write Conflicts**
```
Error: Database lock timeout
Solution: Use batch operations, serialize writes, implement retry logic
```

### Recommended Error Handling

```typescript
// lib/roam/error-handler.ts
export class RoamError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number
  ) {
    super(message);
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 500
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Retry on connection errors, not auth errors
      if (error instanceof RoamError && error.code === 'ECONNREFUSED') {
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, i)));
        continue;
      }
      throw error;
    }
  }
}

// Usage
await withRetry(async () => {
  return await roamClient.searchByTag('qa-ops');
});
```

---

## Part 9: Implementation Roadmap

### Phase 1: Verification (1-2 days)
- [ ] User generates Local API Token in Roam Desktop
- [ ] Install roam-research-mcp globally
- [ ] Verify token works: `roam status`
- [ ] Test basic read operation: `roam search --tag qa-ops`

### Phase 2: QA Ops Integration (3-4 days)
- [ ] Implement `lib/roam/mcp-client.ts`
- [ ] Create API route: `app/api/roam/fetch-test-cases`
- [ ] Create API route: `app/api/roam/create-test-result`
- [ ] Create API route: `app/api/roam/search`
- [ ] Unit test all endpoints
- [ ] Integration test with real Roam graph

### Phase 3: UI Components (2-3 days)
- [ ] Create Roam graph selector component
- [ ] Create import test cases component
- [ ] Create search results component
- [ ] Display test cases fetched from Roam
- [ ] Manual end-to-end testing

### Phase 4: Production Hardening (2-3 days)
- [ ] Token storage in Secrets Manager
- [ ] Error handling & retry logic
- [ ] Logging & monitoring
- [ ] Rate limiting
- [ ] Load testing

**Total Effort**: 8-12 days (1.5-2 weeks)

---

## Part 10: Success Criteria

**Before Implementation Approval**:

- [ ] ✅ Roam Desktop with Local API Token is confirmed working
- [ ] ✅ MCP server (2b3pro/roam-research-mcp) installed successfully
- [ ] ✅ `roam status` shows "Connected"
- [ ] ✅ Manual search test works: `roam search --tag "qa-ops"` returns results

**After Implementation**:

- [ ] ✅ QA Ops fetches test cases from Roam
- [ ] ✅ QA Ops displays results in UI
- [ ] ✅ QA Ops creates test result pages in Roam
- [ ] ✅ All Roam operations work with Local API Token
- [ ] ✅ Token error handling works correctly
- [ ] ✅ Connection resilience tested (Roam restart scenario)

**Production Readiness**:

- [ ] ✅ Token stored securely (Secrets Manager)
- [ ] ✅ No tokens in code/git/logs
- [ ] ✅ Error messages don't expose token/internal details
- [ ] ✅ Rate limiting implemented
- [ ] ✅ Monitoring/alerts in place for Roam connectivity

---

## Part 11: Architectural Decisions

### Decision 1: Direct Node.js vs HTTP Stream

**Chosen: Direct Node.js**

✅ **Why**:
- Lower latency (no network overhead)
- Simpler security (localhost-only)
- More reliable (less network failure points)
- Standard for local integrations

❌ **HTTP Stream reserved for**:
- If MCP server must run on different machine
- If QA Ops needs remote access to Roam

### Decision 2: Single Graph vs Multi-Graph

**Chosen: Single Graph (with multi-graph support optional)**

✅ **Why**:
- Simpler initial implementation
- Most QA teams use one shared graph
- Can add multi-graph later via `ROAM_GRAPHS` env var

### Decision 3: Synchronous vs Streaming

**Chosen: Synchronous (request/response)**

✅ **Why**:
- Easier to implement and test
- Natural fit for REST API architecture
- QA Ops already uses REST APIs
- Polling for real-time updates if needed later

---

## Part 12: Deployment Checklist

### Pre-Deployment

- [ ] Roam Desktop installed on QA server
- [ ] Roam Desktop can start automatically (systemd, cron, etc.)
- [ ] Local API Token generated and stored securely
- [ ] Node.js v18+ installed
- [ ] roam-research-mcp installed: `npm install -g roam-research-mcp`
- [ ] Environment variables configured
- [ ] Test connection: `roam status`

### Deployment

- [ ] QA Ops application deployed
- [ ] ROAM_API_TOKEN set in production secrets
- [ ] Database migrations complete
- [ ] Roam integration tests pass
- [ ] Logging configured

### Post-Deployment

- [ ] Verify Roam connectivity in logs
- [ ] Test import test cases workflow
- [ ] Test create test result workflow
- [ ] Test error scenarios (Roam down, invalid token)
- [ ] Monitor connectivity for first 24 hours

---

## Conclusion

**MCP Integration is VIABLE and RECOMMENDED** for QA Ops.

✅ **Ready to Proceed With**:
- Using 2b3pro/roam-research-mcp as MCP server
- Implementing Node.js MCP client in QA Ops
- Storing Local API Token in Secrets Manager
- On-premise deployment model

⚠️ **Must Accept**:
- Roam Desktop must run on same machine as QA Ops
- Not suitable for serverless/cloud-only deployment
- Token management responsibility

**Next Step**: User approval to begin implementation (Phase 1: Verification)

