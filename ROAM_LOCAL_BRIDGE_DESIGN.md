# Roam Local Bridge Architecture Design

**Date:** June 30, 2026  
**Status:** Design Phase (Pre-Implementation)  
**Author:** Senior Software Architect  
**Purpose:** Enable deployed QA Ops web application to securely access each teammate's local Roam graph

---

## Table of Contents
1. [Architecture Diagram](#1-architecture-diagram)
2. [Browser Flow](#2-browser-flow)
3. [Local Bridge Flow](#3-local-bridge-flow)
4. [Backend Flow](#4-backend-flow)
5. [API Contracts](#5-api-contracts)
6. [Endpoint Analysis](#6-endpoint-analysis)
7. [CORS Strategy](#7-cors-strategy)
8. [Authentication Strategy](#8-authentication-strategy)
9. [Error Handling](#9-error-handling)
10. [Bridge Installation](#10-bridge-installation-process)
11. [Configuration Storage](#11-configuration-storage)
12. [Logging Strategy](#12-logging-strategy)
13. [Rollback Strategy](#13-rollback-strategy)
14. [Migration Phases](#14-migration-phases)
15. [File Changes](#15-file-changes)
16. [Risk Analysis](#16-risk-analysis)

---

## 1. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│ BROWSER (User's Laptop)                                                 │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ React Frontend (qa-ops.vercel.app)                                  │ │
│ │ - Renders UI                                                        │ │
│ │ - Handles user interactions                                         │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┬─┘
                               │                                          │
                    ┌──────────┴──────────┐                               │
                    │                     │                               │
      (HTTPS/HTTP)  │                     │                       (CORS enabled)
                    ▼                     ▼                               │
        ┌──────────────────────┐  ┌──────────────────────┐               │
        │  Vercel Backend      │  │ Local Bridge Service │◄──────────────┘
        │  (QA Ops API)        │  │ (Port 7890 default)  │
        │                      │  │                      │
        │ - /api/roam/*        │  │ - Auth tokens        │
        │   (modified)         │  │ - Bridge endpoints   │
        │ - /api/projects      │  │ - Local HTTP server  │
        │ - /api/test-cases    │  │                      │
        │ - health check       │  └──────────────────────┘
        │ - CORS enabled       │           │
        └──────────────────────┘           │ (HTTP/stdio)
                    │                      │
                    │                      ▼
                    │          ┌──────────────────────┐
                    │          │  Roam MCP Server     │
                    │          │  (Local Process)     │
                    │          │                      │
                    │          │ - Port 8088 default  │
                    │          │ - stdio socket       │
                    │          └──────────────────────┘
                    │                      │
                    │                      │ (Local HTTP API)
                    │                      ▼
                    │          ┌──────────────────────┐
                    │          │  Roam Desktop        │
                    │          │  (User's Machine)    │
                    │          │                      │
                    │          │ - Running locally    │
                    │          │ - Local HTTP API     │
                    │          └──────────────────────┘
                    │                      │
                    │                      │ (Local GraphQL)
                    │                      ▼
                    │          ┌──────────────────────┐
                    │          │  Roam Graph          │
                    │          │  (User's Data)       │
                    │          └──────────────────────┘
                    │
                    ▼
        ┌──────────────────────────────────────────┐
        │  Supabase Postgres Database              │
        │  (Shared between all users)              │
        │                                          │
        │  - Projects                              │
        │  - Test cases                            │
        │  - RoamConfig (per-user)                 │
        │  - SyncLogs (audit trail)                │
        │  - BridgeTokens (NEW)                    │
        │  - BridgeSessions (NEW)                  │
        └──────────────────────────────────────────┘
```

### Key Points:
- **Network Isolation**: Local Bridge runs on user's machine, Vercel backend in cloud
- **User-Specific**: Each teammate has their own Local Bridge instance
- **Backward Compatible**: Old Roam CLI paths still work temporarily
- **New Bridge Paths**: New endpoints go through Bridge, old ones fallback to CLI
- **Authentication**: Token-based auth between Browser→Backend and Backend→Bridge

---

## 2. Browser Flow

### Scenario A: Using New Bridge Architecture

**Flow:** Browser → Vercel Backend → Local Bridge → Roam MCP

```
1. USER ACTION
   User opens https://qa-ops.vercel.app
   User is authenticated (existing auth system)
   User loads test cases page

2. FETCH TEST CASES (NEW FLOW - Via Bridge)
   Browser calls: POST /api/roam/test-cases/fetch
   Headers: {
     Authorization: "Bearer <user-session-token>",
     X-Bridge-Available: "true"  // NEW: Indicates bridge is running
   }

3. VERCEL BACKEND DECISION
   Backend checks: Is bridge configured for this user?
   Backend checks: Is bridge healthy?
   
   YES → Route through bridge
   NO  → Fallback to CLI (for transition period)

4. BRIDGE COMMUNICATION
   Backend: POST http://localhost:7890/api/roam/fetch-test-cases
   Headers: {
     Authorization: "Bearer <bridge-token>",
     X-User-Id: "<user-id>",
     X-Project-Id: "<project-id>"
   }
   Body: { projectId, syncType }

5. BRIDGE PROCESSES REQUEST
   - Validates token against session in local database
   - Calls Roam MCP server
   - Returns test cases

6. RESPONSE CHAIN
   Bridge → Backend → Browser
   Browser: Displays test cases
   User: Doesn't know if it came from Bridge or CLI

7. ERROR HANDLING
   If bridge offline:
     - Backend logs: "Bridge unavailable for user X"
     - Backend tries CLI fallback
     - If CLI fails: Return error
     - User sees: "Cannot connect to Roam"
   
   If auth fails:
     - Bridge returns 401
     - Backend returns 401 to Browser
     - Browser redirects to login
```

### Scenario B: Falling Back to CLI (Transition Period)

```
1. User action same as above

2. Backend checks bridge status:
   bridge_available = false OR bridge_token_expired

3. FALLBACK TO CLI
   Backend executes Roam CLI directly
   (Old behavior, for backward compatibility)

4. CLI runs and returns results

5. Response goes to Browser
   User doesn't know CLI was used
```

### Scenario C: Bridge Installation Workflow

```
1. USER SETUP
   Teammate downloads: @qa-ops/roam-bridge v1.0.0
   
   npm install -g @qa-ops/roam-bridge

2. FIRST RUN
   Teammate runs in terminal:
   
   roam-bridge setup
   
   The CLI prompts:
   ✓ Graph name? → "Project_Kinergy"
   ✓ API token? → [paste from Roam Desktop settings]
   ✓ Bridge port? → [default 7890]
   ✓ Backend URL? → [auto-detect or manual]
   
3. AUTHENTICATION WITH BACKEND
   Bridge: POST https://qa-ops.vercel.app/api/bridge/register
   Body: {
     bridgeId: "<unique-id>",
     publicKey: "<public-key>",
     graphName: "Project_Kinergy",
     version: "1.0.0"
   }
   
4. BACKEND RESPONSE
   Backend: Returns {
     bridgeToken: "<32-char-token>",
     expiresAt: "2026-07-01T00:00:00Z",
     webhookUrl: "https://qa-ops.vercel.app/api/bridge/health"
   }
   
5. BRIDGE STORES TOKEN
   Local file: ~/.roam-bridge/config.json
   {
     bridgeId: "...",
     bridgeToken: "...",
     graphName: "Project_Kinergy",
     apiToken: "[encrypted]",
     port: 7890,
     backendUrl: "https://qa-ops.vercel.app",
     registeredAt: "2026-06-30T12:00:00Z"
   }
   
6. BRIDGE STARTS
   Bridge server listens on http://localhost:7890
   Bridge connects to Roam MCP on localhost:8088
   Bridge registers with backend (health check heartbeat)
   
   Terminal output:
   ✓ Bridge started on http://localhost:7890
   ✓ Connected to Roam graph "Project_Kinergy"
   ✓ Registered with backend
   ✓ Keep this terminal open
   
7. USER OPENS APP
   Teammate opens https://qa-ops.vercel.app
   Backend detects: "This user has a bridge registered"
   Backend: Routes requests to Bridge
   Everything works!

8. BRIDGE SHUTDOWN
   User closes terminal → Bridge stops
   Backend detects offline after 30s timeout
   Backend automatically falls back to CLI
   User continues working (no manual action needed)
```

---

## 3. Local Bridge Flow

### Internal Bridge Logic

```
LOCAL BRIDGE PROCESS (Node.js CLI tool)

┌────────────────────────────────────────────────────────┐
│ START: roam-bridge start                               │
└────────────────────────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────┐
│ STEP 1: Load Configuration                             │
│ - Read: ~/.roam-bridge/config.json                     │
│ - Validate: bridgeToken, graphName, apiToken           │
│ - Check: Expiration dates                              │
│ - Set: Environment variables                           │
└────────────────────────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────┐
│ STEP 2: Validate Roam MCP Connection                   │
│ - Attempt: Connect to Roam MCP on localhost:8088       │
│ - Retry: Up to 3 times with 2s interval                │
│ - Fallback: Try auto-launch Roam Desktop               │
│ - Timeout: 10s per attempt                             │
└────────────────────────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────┐
│ STEP 3: Initialize HTTP Server                         │
│ - Create: Express.js HTTP server                       │
│ - Bind: http://127.0.0.1:7890 (localhost only)         │
│ - Setup: CORS headers (localhost + backend URL)        │
│ - Add: Request logging middleware                      │
│ - Add: Error handling middleware                       │
└────────────────────────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────┐
│ STEP 4: Register with Backend                          │
│ - POST: /api/bridge/heartbeat                          │
│ - Headers: Authorization: Bearer {bridgeToken}         │
│ - Body: { bridgeId, status, version }                  │
│ - Interval: Every 30 seconds                           │
│ - On Failure: Retry with exponential backoff           │
│ - On Success: Continue operation                       │
│ - On 401: Token expired, need to re-register           │
└────────────────────────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────┐
│ STEP 5: Ready for Requests                             │
│ - Listen: On configured port                           │
│ - Accept: Requests from backend                        │
│ - Log: All activities to local file                    │
│ - Monitor: Roam MCP connection health                  │
│ - Retry: Failed requests to Roam MCP                   │
└────────────────────────────────────────────────────────┘
                     ▼
         REQUEST PROCESSING (See below)
```

### Request Processing Inside Bridge

```
INCOMING REQUEST: POST /api/roam/fetch-test-cases
Headers: {
  Authorization: "Bearer {bridgeToken}",
  X-User-Id: "user123",
  X-Project-Id: "proj456"
}
Body: { projectId: "proj456" }

┌────────────────────────────────────────────────────────┐
│ 1. AUTHENTICATE REQUEST                                │
│    - Verify: Authorization header present              │
│    - Verify: Token format is valid                     │
│    - Verify: Token matches configured bridgeToken      │
│    - Result: ALLOW or REJECT with 401                  │
└────────────────────────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────┐
│ 2. VALIDATE REQUEST                                    │
│    - Check: Content-Type is application/json           │
│    - Check: Body parameters are valid                  │
│    - Check: User has permission for project            │
│    - Result: CONTINUE or REJECT with 400/403           │
└────────────────────────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────┐
│ 3. LOG REQUEST                                         │
│    - requestId: uuid                                   │
│    - timestamp: ISO                                    │
│    - action: "FETCH_TEST_CASES"                        │
│    - status: "IN_PROGRESS"                             │
│    - Write to: ~/.roam-bridge/logs/[date].log          │
└────────────────────────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────┐
│ 4. CALL ROAM MCP                                       │
│    - Method: MCP client library call                   │
│    - Tool: search / get / query                        │
│    - Parameters: graphName, query from config          │
│    - Timeout: 30 seconds                               │
│    - Retry: 1 retry on timeout                         │
│    - Result: Data or Error                             │
└────────────────────────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────┐
│ 5. FORMAT RESPONSE                                     │
│    - Success: {                                        │
│        success: true,                                  │
│        data: [...],                                    │
│        requestId: "...",                               │
│        duration: 234  (ms)                             │
│      }                                                  │
│    - Error: {                                          │
│        success: false,                                 │
│        error: "...",                                   │
│        requestId: "...",                               │
│        duration: 234  (ms)                             │
│      }                                                  │
└────────────────────────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────┐
│ 6. LOG RESPONSE                                        │
│    - requestId: (same as request)                      │
│    - status: "SUCCESS" or "FAILED"                     │
│    - duration: (total ms)                              │
│    - responseSize: (bytes)                             │
│    - error: (if any)                                   │
│    - Write to: ~/.roam-bridge/logs/[date].log          │
└────────────────────────────────────────────────────────┘
                     ▼
         SEND RESPONSE TO BACKEND
         HTTP 200 + JSON body
```

### Bridge State Machine

```
States:
- UNINITIALIZED: Just started, not configured yet
- INITIALIZING: Loading config, checking Roam
- ROAM_OFFLINE: Roam MCP not available
- READY: All systems go, accepting requests
- DEGRADED: Roam MCP intermittently available
- ERROR: Critical error, needs human intervention

State Transitions:

UNINITIALIZED
    ↓ (config loaded)
INITIALIZING
    ├─ (Roam MCP available) → READY
    └─ (Roam MCP unavailable) → ROAM_OFFLINE

READY
    ├─ (request succeeds) → READY (stay)
    ├─ (request fails, timeout) → DEGRADED
    └─ (Roam MCP dies) → ROAM_OFFLINE

ROAM_OFFLINE
    ├─ (retry successful) → READY
    └─ (max retries reached) → ERROR

DEGRADED
    ├─ (recovery successful) → READY
    ├─ (repeated failures) → ROAM_OFFLINE
    └─ (timeout) → ROAM_OFFLINE

ERROR
    └─ (manual restart required)

Backend is informed:
- Via heartbeat (every 30s): Current state
- Immediately on state change: State transition
- On health check failure: OFFLINE detected
```

---

## 4. Backend Flow

### Vercel Backend Request Handling

```
INCOMING REQUEST: POST /api/roam/sync
Body: { projectId, syncType }
User: Authenticated (existing auth system)

┌────────────────────────────────────────────────────────┐
│ MIDDLEWARE: Authentication                             │
│ - Verify: User is logged in                            │
│ - Verify: User owns project (projectId)                │
│ - Extract: userId, projectId                           │
│ - Result: ALLOW or 401                                 │
└────────────────────────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────┐
│ NEW: Check Bridge Status                               │
│                                                        │
│ Query DB:                                              │
│   bridgeSession = await db.bridgeSession.findFirst({   │
│     where: {                                           │
│       userId,                                          │
│       OR: [                                            │
│         { expiresAt > now() },                         │
│       ]                                                │
│     }                                                  │
│   })                                                   │
│                                                        │
│ Result: bridgeSession found? YES/NO                    │
└────────────────────────────────────────────────────────┘
                     ▼
        ┌─────────YES────────┬─────────NO──────────┐
        │                    │                     │
        ▼                    ▼                     ▼
   BRIDGE ROUTE      CLI FALLBACK         NO ROAM ACCESS
   (NEW)             (DEPRECATED)         (ERROR)

═══════════════════════════════════════════════════════════════

BRIDGE ROUTE (Preferred for new installations):

┌────────────────────────────────────────────────────────┐
│ STEP 1: Get Bridge Token                               │
│                                                        │
│ bridgeToken = bridgeSession.token                      │
│ bridgeUrl = bridgeSession.endpoint                     │
│         = "http://localhost:7890"  (typical)           │
└────────────────────────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────┐
│ STEP 2: Make Request to Bridge                         │
│                                                        │
│ const response = await fetch(                          │
│   `${bridgeUrl}/api/roam/sync`,                        │
│   {                                                    │
│     method: "POST",                                    │
│     headers: {                                         │
│       "Authorization": `Bearer ${bridgeToken}`,        │
│       "Content-Type": "application/json",              │
│       "X-User-Id": userId,                             │
│       "X-Project-Id": projectId,                       │
│       "X-Request-Id": requestId                        │
│     },                                                 │
│     body: JSON.stringify({                             │
│       projectId,                                       │
│       syncType                                         │
│     })                                                 │
│   }                                                    │
│ )                                                      │
│                                                        │
│ Timeout: 60 seconds                                    │
│ Retry: 1 time on network error                         │
└────────────────────────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────┐
│ STEP 3: Handle Response                                │
│                                                        │
│ if response.status === 200:                            │
│   → Process data, return to client                     │
│   → Log: SUCCESS in SyncLog                            │
│                                                        │
│ if response.status === 401:                            │
│   → Token expired or invalid                           │
│   → Action: Mark bridge offline                        │
│   → Action: Delete bridgeSession                       │
│   → Fallback: Try CLI                                  │
│   → Log: TOKEN_EXPIRED in SyncLog                      │
│                                                        │
│ if response.status === 500:                            │
│   → Bridge error or Roam MCP error                     │
│   → Action: Mark bridge in DEGRADED state              │
│   → Fallback: Try CLI                                  │
│   → Log: BRIDGE_ERROR in SyncLog                       │
│                                                        │
│ if response timeout or network error:                  │
│   → Bridge is offline                                  │
│   → Action: Mark bridge OFFLINE                        │
│   → Fallback: Try CLI                                  │
│   → Log: BRIDGE_OFFLINE in SyncLog                     │
└────────────────────────────────────────────────────────┘
                     ▼
         RETURN RESPONSE TO CLIENT

═══════════════════════════════════════════════════════════════

CLI FALLBACK ROUTE (Temporary, during transition):

┌────────────────────────────────────────────────────────┐
│ WARNING: Using deprecated Roam CLI                     │
│                                                        │
│ console.warn(                                          │
│   `[DEPRECATION] User ${userId} using CLI fallback`    │
│ )                                                      │
│ console.warn(                                          │
│   `[ACTION] Suggest bridge installation to user`       │
│ )                                                      │
│                                                        │
│ Log: FALLBACK_TO_CLI in SyncLog                        │
└────────────────────────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────┐
│ Execute Roam CLI                                       │
│ (Existing code path - no changes)                      │
│                                                        │
│ This is the OLD behavior, kept for compatibility       │
│ Will only work if:                                     │
│ - Roam Desktop is running on Vercel (IT WON'T BE!)     │
│ - Therefore: This WILL FAIL for deployed app           │
│                                                        │
│ Result: Error returned to client                       │
│         with helpful message:                          │
│         "Bridge required for deployed app"             │
└────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════

NO ROAM ACCESS (Neither bridge nor CLI available):

┌────────────────────────────────────────────────────────┐
│ RETURN ERROR TO CLIENT                                 │
│                                                        │
│ {                                                      │
│   success: false,                                      │
│   error: "Roam Bridge not available",                  │
│   code: "BRIDGE_NOT_REGISTERED",                       │
│   message: "Please install and start the Roam bridge", │
│   helpUrl: "https://docs.qa-ops.vercel.app/bridge"     │
│ }                                                      │
│                                                        │
│ HTTP Status: 503 Service Unavailable                   │
│                                                        │
│ Log: BRIDGE_REQUIRED in SyncLog                        │
└────────────────────────────────────────────────────────┘
```

---

## 5. API Contracts

### 5.1 Browser → Backend (Existing, with additions)

#### Endpoint: POST /api/roam/test-connection
**Purpose:** Test connectivity to Roam (via Bridge if available, otherwise CLI)

**Request:**
```typescript
{
  projectId: string          // Required
  graphName?: string         // Optional (from form)
  apiToken?: string          // Optional (from form)
  repositoryRootPage?: string // Optional
  useBridge?: boolean        // NEW: Force bridge (true) or CLI (false)
}
```

**Response (Success):**
```typescript
{
  success: true
  message: "Connected to Roam graph..."
  graphName: string
  repositoryRootPage: string | null
  bridgeUsed?: boolean  // NEW: Was bridge used?
  duration?: number     // NEW: Response time in ms
}
```

**Response (Error):**
```typescript
{
  success: false
  error: string
  code?: string  // NEW: Error code (BRIDGE_OFFLINE, TOKEN_INVALID, etc)
  details?: string
  bridgeUsed?: boolean
  fallbackAttempted?: boolean  // NEW: Did we try CLI?
}
```

---

#### Endpoint: POST /api/roam/sync
**Purpose:** Sync test cases from Roam (via Bridge or CLI)

**Request:**
```typescript
{
  projectId: string
  syncType: 'initial' | 'refresh'
  useBridge?: boolean  // NEW
}
```

**Response (Success):**
```typescript
{
  success: true
  projectId: string
  syncType: string
  nodesAdded: number
  nodesUpdated: number
  nodesSkipped: number
  duration: number  // ms
  bridgeUsed?: boolean  // NEW
}
```

**Response (Error):**
```typescript
{
  success: false
  error: string
  code?: string
  projectId: string
  bridgeUsed?: boolean
  fallbackAttempted?: boolean
}
```

---

#### Endpoint: POST /api/roam/config (Existing)
**Purpose:** Save/update Roam configuration

**No Changes to this endpoint** - exists for backward compatibility

---

### 5.2 Backend → Bridge (New Endpoints)

**Base URL:** `http://localhost:7890` (default)  
**Authentication:** Bearer token in Authorization header

---

#### Endpoint: POST /api/roam/test-connection
**Purpose:** Test connection from Bridge to Roam MCP

**Request:**
```typescript
{
  // No body needed - Bridge uses its own config
}
```

**Headers:**
```typescript
{
  "Authorization": "Bearer {bridgeToken}",
  "Content-Type": "application/json",
  "X-User-Id": "user123",
  "X-Request-Id": "req-abc123"
}
```

**Response (Success):**
```typescript
{
  success: true
  message: "Connected to Roam MCP"
  graphName: string
  status: "READY"  // NEW
  uptime: number   // NEW: seconds
}
```

**Response (Error):**
```typescript
{
  success: false
  error: string
  code: string  // ROAM_OFFLINE, TOKEN_INVALID, etc
  status: "ROAM_OFFLINE" | "ERROR" | "DEGRADED"  // NEW
}
```

---

#### Endpoint: POST /api/roam/sync
**Purpose:** Sync test cases from Roam MCP

**Request:**
```typescript
{
  projectId: string
  syncType: 'initial' | 'refresh'
}
```

**Response:** (Same as Browser endpoint but from Bridge perspective)

---

#### Endpoint: GET /api/roam/pages/{pageTitle}
**Purpose:** Fetch a specific page from Roam

**Response:**
```typescript
{
  success: true
  page: {
    uid: string
    title: string
    children: Block[]  // Hierarchical structure
  }
}
```

---

#### Endpoint: POST /api/roam/search
**Purpose:** Search Roam graph

**Request:**
```typescript
{
  query: string
  limit?: number
  tags?: string[]
}
```

**Response:**
```typescript
{
  success: true
  results: Array<{
    uid: string
    title?: string
    type: 'page' | 'block'
    preview?: string
  }>
}
```

---

#### Endpoint: POST /api/health
**Purpose:** Bridge health check (for backend polling)

**Request:** (No body)

**Response:**
```typescript
{
  status: "READY" | "ROAM_OFFLINE" | "DEGRADED" | "ERROR"
  bridgeId: string
  graphName: string
  uptime: number  // seconds
  requestsProcessed: number
  lastRequestAt: ISO8601 | null
}
```

---

### 5.3 Bridge ↔ Backend Health Check & Registration

#### Endpoint: POST /api/bridge/register
**Purpose:** Register a new bridge with backend (called once by Bridge)

**Called by:** Local Bridge (during setup)

**Request:**
```typescript
{
  bridgeId: string        // Unique ID for this bridge instance
  graphName: string       // Roam graph name
  publicKey: string       // For future encrypted communication
  version: string         // Bridge version (e.g., "1.0.0")
  os: string              // Operating system
  hostname: string        // User's machine hostname
}
```

**Response:**
```typescript
{
  bridgeToken: string     // Token for future requests
  expiresAt: ISO8601      // When token expires
  webhookUrl: string      // For health check callbacks
  graphName: string       // Confirmed graph name
}
```

**Errors:**
- 400: Invalid request format
- 409: Bridge already registered for this graph
- 503: Service unavailable

---

#### Endpoint: POST /api/bridge/heartbeat
**Purpose:** Keep bridge alive, report health (called every 30s)

**Called by:** Local Bridge (periodic)

**Request:**
```typescript
{
  bridgeId: string
  status: "READY" | "DEGRADED" | "OFFLINE" | "ERROR"
  uptime: number           // seconds
  requestsProcessed: number
  errorsInLast30s: number
  roamStatus: "CONNECTED" | "CONNECTING" | "OFFLINE"
  lastError?: string
}
```

**Response:**
```typescript
{
  acknowledged: true
  nextHeartbeatAt: ISO8601  // When next heartbeat should be
}
```

**Errors:**
- 401: Invalid token (bridge should re-register)
- 503: Backend maintenance

---

#### Endpoint: DELETE /api/bridge/{bridgeId}
**Purpose:** Unregister bridge (called when user wants to remove it)

**Called by:** Local Bridge (on `roam-bridge unregister`) OR Backend

**Response:**
```typescript
{
  success: true
  message: "Bridge unregistered"
}
```

---

## 6. Endpoint Analysis

### 6.1 Unchanged Endpoints

These endpoints remain **exactly as-is** and continue to work:

```
✓ POST /api/auth/login
✓ POST /api/projects
✓ GET  /api/projects
✓ POST /api/test-cases
✓ GET  /api/test-cases
✓ POST /api/test-suites
✓ GET  /api/test-suites
✓ POST /api/execution-cycles
✓ GET  /api/execution-cycles
✓ POST /api/dashboard/metrics
✓ GET  /api/dashboard/summary
✓ GET  /api/health
✓ POST /api/codeRepositories
✓ GET  /api/codeRepositories
✓ POST /api/tags
✓ GET  /api/tags
```

**Why?** These don't interact with Roam directly.

---

### 6.2 Modified Endpoints

These endpoints are **modified** to support Bridge (while maintaining CLI fallback):

#### /api/roam/test-connection
- **Change:** Add bridge routing logic
- **Fallback:** CLI if bridge unavailable
- **New fields:** `useBridge`, `bridgeUsed`, `code`
- **Backward compatible:** Yes

#### /api/roam/sync
- **Change:** Add bridge routing logic
- **Fallback:** CLI if bridge unavailable
- **New fields:** `useBridge`, `bridgeUsed`
- **Backward compatible:** Yes

#### /api/roam/sync-simple
- **Change:** Add bridge routing logic
- **Fallback:** CLI if bridge unavailable
- **Backward compatible:** Yes

#### /api/roam/export
- **Change:** Add bridge routing logic
- **Fallback:** CLI if bridge unavailable
- **Backward compatible:** Yes

#### /api/roam/import
- **Change:** Add bridge routing logic
- **Fallback:** CLI if bridge unavailable
- **Backward compatible:** Yes

#### /api/roam/config
- **No changes needed** - This just stores config in DB
- **Backward compatible:** Yes

#### /api/roam/logs
- **Change:** Add support for bridge logs
- **New fields:** Filter by `source: "BRIDGE" | "CLI"`
- **Backward compatible:** Yes

#### /api/roam/scheduled-sync
- **Change:** Routes via bridge if available
- **Fallback:** CLI if bridge unavailable
- **Note:** GitHub Actions can target bridge webhook if available
- **Backward compatible:** Yes

---

### 6.3 New Endpoints

These endpoints are **new** and only exist in Bridge or Backend:

**Backend:** (For bridge management)
```
POST   /api/bridge/register          (Register a new bridge)
POST   /api/bridge/heartbeat         (Health check from bridge)
DELETE /api/bridge/{bridgeId}        (Unregister a bridge)
GET    /api/bridge/status            (Check bridge status for current user)
GET    /api/bridge/config            (Get bridge config from backend)
POST   /api/bridge/test-token        (Test if bridge token is valid)
```

**Bridge:** (For roam operations)
```
POST   /api/roam/test-connection     (Test connection)
POST   /api/roam/sync                (Sync test cases)
POST   /api/roam/sync-simple         (Simple sync)
POST   /api/roam/search              (Search pages/blocks)
GET    /api/roam/pages/{title}       (Fetch specific page)
POST   /api/roam/export              (Export data)
POST   /api/roam/import              (Import data)
GET    /api/health                   (Health status)
```

---

### 6.4 Summary Table

| Endpoint | Current | Change | New Status | Fallback |
|----------|---------|--------|------------|----------|
| /api/roam/test-connection | CLI | Bridge routing | Modified | CLI if offline |
| /api/roam/sync | CLI | Bridge routing | Modified | CLI if offline |
| /api/roam/sync-simple | CLI | Bridge routing | Modified | CLI if offline |
| /api/roam/export | CLI | Bridge routing | Modified | CLI if offline |
| /api/roam/import | CLI | Bridge routing | Modified | CLI if offline |
| /api/roam/config | DB store | No change | Unchanged | N/A |
| /api/roam/logs | DB read | Bridge logs added | Modified | N/A |
| /api/roam/scheduled-sync | CLI | Bridge routing | Modified | CLI if offline |
| /api/bridge/* | N/A | New | New | N/A |
| All other endpoints | Current | None | Unchanged | N/A |

---

## 7. CORS Strategy

### 7.1 Frontend CORS (Browser → Backend)

**Current:** Already enabled by Vercel  
**No changes needed** - Vercel handles CORS for Next.js API routes

---

### 7.2 Bridge CORS (Browser → Local Bridge)

**Problem:** Browser on deployed domain cannot reach localhost:7890

**Solution:** Don't allow direct browser → bridge communication

**Architecture:**
```
Browser
   ↓ (HTTPS - safe)
Vercel Backend
   ↓ (HTTP - internal network)
Local Bridge
   ↓ (HTTP - local machine)
Roam MCP
```

**Browser cannot reach Bridge directly** - This is intentional:
- ✓ Bridge token is never exposed to browser
- ✓ Bridge can authenticate requests without CORS tokens
- ✓ All traffic is encrypted (Browser→Backend is HTTPS)
- ✓ Backend→Bridge can use HTTP on localhost (safe)

**Bridge CORS Headers** (for health check from frontend, if needed):
```
Access-Control-Allow-Origin: http://localhost:3000, https://qa-ops.vercel.app
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, X-Request-Id
Access-Control-Max-Age: 86400
```

**Note:** Not needed if browser never calls bridge directly (recommended architecture)

---

### 7.3 Implementation

**Backend (Next.js):**
```typescript
// Existing middleware continues to handle CORS for /api/* routes
// No changes needed
```

**Bridge (Express.js):**
```typescript
// Only needed if Browser ever calls Bridge directly
// Default: disable CORS headers on Bridge
// Option: enable for localhost only for debugging
const corsOptions = {
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: false,  // No cookies, token-based auth only
  maxAge: 86400
};
app.use(cors(corsOptions));
```

---

## 8. Authentication Strategy

### 8.1 User → Backend Authentication (Existing)

**Mechanism:** Base64 token (current implementation)

```typescript
// User logs in, receives token
const token = Buffer.from(
  JSON.stringify({ userId, email, role, timestamp })
).toString('base64');

// Token sent in requests to backend
headers.authorization = `Bearer ${token}`;

// No changes needed
```

---

### 8.2 Backend → Bridge Authentication (New)

**Mechanism:** Long-lived token stored locally

**Flow:**

```
1. BRIDGE REGISTRATION (First time)
   Bridge sends: POST /api/bridge/register
   With: graphName, publicKey, version
   Backend returns: bridgeToken + expiresAt
   
2. BRIDGE STORES TOKEN
   File: ~/.roam-bridge/config.json
   Format: Plaintext (encrypted at rest is future enhancement)
   
3. EVERY BRIDGE REQUEST
   Header: Authorization: Bearer {bridgeToken}
   
4. BACKEND VALIDATES
   - Check token exists in BridgeToken table
   - Check token not expired
   - Check token userId matches user making request
   - If invalid: Return 401, Bridge deletes config & re-registers
   
5. TOKEN REFRESH
   Token expires after 90 days (configurable)
   Bridge heartbeat includes refresh request
   Backend auto-refreshes if expiry < 7 days
```

---

### 8.3 Database Tables (New)

#### Table: BridgeToken
```sql
CREATE TABLE BridgeToken (
  id                    TEXT PRIMARY KEY,
  userId                TEXT NOT NULL,
  bridgeId              TEXT NOT NULL UNIQUE,
  token                 TEXT NOT NULL UNIQUE,
  graphName             TEXT NOT NULL,
  status                ENUM ('ACTIVE', 'REVOKED') DEFAULT 'ACTIVE',
  expiresAt             TIMESTAMP NOT NULL,
  createdAt             TIMESTAMP DEFAULT now(),
  lastUsedAt            TIMESTAMP,
  
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
  INDEX(userId),
  INDEX(bridgeId),
  INDEX(expiresAt)
);
```

#### Table: BridgeSession
```sql
CREATE TABLE BridgeSession (
  id                    TEXT PRIMARY KEY,
  userId                TEXT NOT NULL,
  bridgeTokenId         TEXT NOT NULL,
  endpoint              TEXT NOT NULL,  -- "http://localhost:7890"
  status                ENUM ('CONNECTED', 'OFFLINE', 'DEGRADED') DEFAULT 'CONNECTED',
  lastHealthCheckAt     TIMESTAMP,
  lastHealthCheckStatus TEXT,
  expiresAt             TIMESTAMP NOT NULL,
  createdAt             TIMESTAMP DEFAULT now(),
  
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
  FOREIGN KEY (bridgeTokenId) REFERENCES BridgeToken(id) ON DELETE CASCADE,
  INDEX(userId),
  INDEX(status),
  INDEX(expiresAt)
);
```

#### Table: BridgeLog
```sql
CREATE TABLE BridgeLog (
  id                    TEXT PRIMARY KEY,
  userId                TEXT NOT NULL,
  bridgeId              TEXT NOT NULL,
  action                TEXT NOT NULL,
  status                ENUM ('SUCCESS', 'FAILED') NOT NULL,
  requestId             TEXT,
  durationMs            INT,
  error                 TEXT,
  createdAt             TIMESTAMP DEFAULT now(),
  
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
  INDEX(userId),
  INDEX(bridgeId),
  INDEX(createdAt)
);
```

---

### 8.4 Token Validation Logic

**In Backend:**
```typescript
// Middleware to check bridge token
async function validateBridgeToken(token: string): Promise<{
  valid: boolean
  userId?: string
  bridgeId?: string
  error?: string
}> {
  const bridgeToken = await db.bridgeToken.findUnique({
    where: { token }
  });

  if (!bridgeToken) {
    return { valid: false, error: 'INVALID_TOKEN' };
  }

  if (bridgeToken.expiresAt < new Date()) {
    return { valid: false, error: 'TOKEN_EXPIRED' };
  }

  if (bridgeToken.status !== 'ACTIVE') {
    return { valid: false, error: 'TOKEN_REVOKED' };
  }

  // Auto-refresh if expiring soon
  const daysUntilExpiry = (bridgeToken.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (daysUntilExpiry < 7) {
    await refreshBridgeToken(bridgeToken.id);
  }

  return {
    valid: true,
    userId: bridgeToken.userId,
    bridgeId: bridgeToken.bridgeId
  };
}
```

---

## 9. Error Handling

### 9.1 Error Classification

**Level 1: Bridge Not Running**
```
Status: 503 Service Unavailable
Message: "Roam Bridge not available"
Code: BRIDGE_OFFLINE
Action: Fallback to CLI (which will also fail for deployed app)
User sees: "Cannot connect. Please install Roam Bridge."
```

**Level 2: Bridge Token Invalid**
```
Status: 401 Unauthorized
Message: "Bridge authentication failed"
Code: BRIDGE_TOKEN_INVALID
Action: Delete BridgeSession, prompt user to re-register
User sees: "Bridge setup required. Please run: roam-bridge setup"
```

**Level 3: Roam MCP Offline**
```
Status: 502 Bad Gateway
Message: "Roam MCP not responding"
Code: ROAM_MCP_OFFLINE
Action: Mark BridgeSession as DEGRADED, keep retrying
User sees: "Roam is offline. Please start Roam Desktop."
```

**Level 4: Roam Data Error**
```
Status: 400 Bad Request or 500 Internal Server Error
Message: Roam MCP returned error
Code: ROAM_ERROR or ROAM_DATA_INVALID
Action: Log error, return to user
User sees: Error details from Roam
```

**Level 5: Network Error (Browser → Backend)**
```
Status: Network error (timeout, connection refused)
Message: Cannot reach backend
Code: NETWORK_ERROR
Action: Retry with exponential backoff
User sees: "Network error. Retrying..."
```

---

### 9.2 Error Response Format

**All APIs use this format for errors:**

```typescript
{
  success: false
  error: string              // Human-readable message
  code: string               // Machine-readable code
  requestId: string          // For debugging
  bridgeUsed?: boolean       // Was bridge used for this request?
  fallbackAttempted?: boolean // Did we try fallback?
  details?: string           // Extra context
  helpUrl?: string           // Link to documentation
}
```

**Example errors:**

```json
{
  "success": false,
  "error": "Roam Bridge not available",
  "code": "BRIDGE_OFFLINE",
  "requestId": "req-abc123",
  "helpUrl": "https://docs.qa-ops.vercel.app/bridge-offline"
}
```

```json
{
  "success": false,
  "error": "Graph not found in Roam",
  "code": "ROAM_GRAPH_NOT_FOUND",
  "requestId": "req-def456",
  "bridgeUsed": true,
  "details": "Graph 'Project_Kinergy' does not exist in this Roam instance"
}
```

---

### 9.3 Retry Logic

**Client-side (Browser):**
```typescript
// Exponential backoff
const delays = [100, 200, 400, 800, 1600];  // ms

for (let attempt = 0; attempt <= delays.length; attempt++) {
  try {
    response = await fetch(url, options);
    if (response.ok) return response;
    if (response.status >= 500) {
      // Server error, retry
      if (attempt < delays.length) {
        await sleep(delays[attempt]);
        continue;
      }
    }
    // Client error, don't retry
    throw new ApiError(response);
  } catch (error) {
    if (attempt < delays.length) {
      await sleep(delays[attempt]);
      continue;
    }
    throw error;
  }
}
```

**Backend-to-Bridge:**
```typescript
// Same exponential backoff, max 2 attempts
const maxRetries = 1;
for (let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    response = await fetch(bridgeUrl, {
      timeout: 60000,
      // ... headers ...
    });
    if (response.ok) return response;
    if (response.status === 401) {
      // Token invalid, mark for refresh
      markBridgeTokenForRefresh(userId);
      throw new TokenInvalidError();
    }
    if (response.status >= 500) {
      // Bridge error, retry once
      if (attempt < maxRetries) {
        await sleep(500);
        continue;
      }
    }
  } catch (error) {
    if (attempt < maxRetries) {
      await sleep(500);
      continue;
    }
    throw error;
  }
}
```

---

### 9.4 Timeout Handling

```typescript
// Client timeouts
fetch timeout: 60 seconds
  → Network error
  → Retry once
  → If still timeout: Return error to user

// Bridge request timeout
fetch timeout: 60 seconds
  → Mark bridge as degraded
  → Retry once
  → If still timeout: Mark as offline
  → Fallback to CLI (if available)

// Roam MCP timeout (inside bridge)
Roam MCP request timeout: 30 seconds
  → Retry once
  → If still timeout: Return error
  → Bridge marks itself as degraded
  → Sends DEGRADED status in next heartbeat
```

---

## 10. Bridge Installation Process

### 10.1 Installation Steps (For Each Teammate)

**Prerequisite:**
- Roam Desktop installed and working
- Node.js 18+ installed
- npm or yarn package manager

**Step 1: Install Bridge CLI**
```bash
npm install -g @qa-ops/roam-bridge@1.0.0
```

**Step 2: Verify Installation**
```bash
roam-bridge --version
# Output: @qa-ops/roam-bridge v1.0.0
```

**Step 3: Initial Setup**
```bash
roam-bridge setup
```

**Interactive prompts:**
```
? Graph name (from Roam Desktop): Project_Kinergy
? API token (from Roam → Settings → Workspace → API): roam-graph-local-token-xxxxx
? Port for bridge [7890]: [press Enter to accept default]
? Backend URL [https://qa-ops.vercel.app]: [press Enter to accept]
? Start bridge now? [Y/n]: y

✓ Configuration saved to ~/.roam-bridge/config.json
✓ Bridge registered with backend
✓ Bridge is running on http://localhost:7890
✓ Keep this terminal open

Next steps:
1. Open https://qa-ops.vercel.app in your browser
2. You're ready to use the app!
```

**Step 4: Keep Terminal Open**
```
The bridge must be running while you use the app.
To stop: Press Ctrl+C
To start again: roam-bridge start
```

---

### 10.2 Installation Configuration File

**Location:** `~/.roam-bridge/config.json`

```json
{
  "version": "1.0.0",
  "bridgeId": "bridge-abc123def456",
  "graphName": "Project_Kinergy",
  "apiToken": "roam-graph-local-token-xxxxx",
  "bridgeToken": "qop_bridge_abcdef123456789",
  "backendUrl": "https://qa-ops.vercel.app",
  "port": 7890,
  "registeredAt": "2026-06-30T12:00:00Z",
  "tokenExpiresAt": "2026-09-28T12:00:00Z",
  "autoStartEnabled": false
}
```

---

### 10.3 Bridge Commands

```bash
# Start bridge
roam-bridge start

# Setup (first time, or to reconfigure)
roam-bridge setup

# Check status
roam-bridge status
# Output:
# Status: READY
# Graph: Project_Kinergy
# Uptime: 2h 15m
# Requests processed: 347
# Last error: none

# View logs
roam-bridge logs
roam-bridge logs --tail 50
roam-bridge logs --follow

# Stop bridge
roam-bridge stop

# Unregister bridge (remove from backend)
roam-bridge unregister
# ✓ Bridge unregistered from backend
# ✓ Configuration cleared

# Help
roam-bridge help
roam-bridge help start
```

---

### 10.4 Troubleshooting

**Problem: "Roam Desktop not responding"**
```bash
roam-bridge logs --tail 20
# Look for: "ROAM_MCP_OFFLINE"

Solution:
1. Open Roam Desktop app (if closed)
2. Run: roam-bridge start
3. Bridge will auto-connect to Roam MCP
```

**Problem: "Token invalid"**
```
Solution:
1. Run: roam-bridge setup
2. Enter API token again
3. Bridge will re-register with backend
```

**Problem: "Cannot reach backend"**
```
Solution:
1. Check internet connection
2. Check if qa-ops.vercel.app is accessible
3. Bridge will auto-retry
4. Check logs: roam-bridge logs --tail 50
```

---

## 11. Configuration Storage

### 11.1 Bridge Configuration (Local Machine)

**File:** `~/.roam-bridge/config.json`

```json
{
  "version": "1.0.0",
  "bridgeId": "bridge-uuid",
  "graphName": "Project_Kinergy",
  "apiToken": "roam-graph-local-token-xxxxx",
  "bridgeToken": "qop_bridge_token",
  "backendUrl": "https://qa-ops.vercel.app",
  "port": 7890,
  "registeredAt": "2026-06-30T12:00:00Z",
  "tokenExpiresAt": "2026-09-28T12:00:00Z",
  "tokenRefreshToken": "qop_refresh_xxxxx"
}
```

**Permissions:** `600` (read/write user only)

**Encryption:** Not encrypted (could be improved with future enhancement)

---

### 11.2 Bridge Logs (Local Machine)

**Directory:** `~/.roam-bridge/logs/`

**Files:**
- `2026-06-30.log` - Daily rotation
- `2026-06-29.log`
- etc.

**Retention:** 30 days (configurable)

**Format:** JSON (one line per log entry)
```json
{
  "timestamp": "2026-06-30T12:34:56.789Z",
  "level": "INFO",
  "requestId": "req-abc123",
  "action": "FETCH_TEST_CASES",
  "status": "SUCCESS",
  "duration": 234,
  "details": "Fetched 42 test cases"
}
```

---

### 11.3 Backend Configuration (Supabase)

**Tables added to existing database:**

1. **BridgeToken** (stores issued tokens)
   - Unique per bridge instance
   - User can have multiple bridges (for different machines)
   - Tokens auto-refresh if expiring

2. **BridgeSession** (tracks active connections)
   - Current status of bridge
   - Last health check time
   - Endpoint (localhost:7890)

3. **BridgeLog** (audit trail)
   - All bridge operations logged
   - Helps with debugging
   - Retention: 90 days

---

### 11.4 Application Configuration (No Changes)

**Existing configuration files remain unchanged:**
- `.env` - Environment variables (no new vars needed)
- `next.config.js` - Next.js config (no changes)
- `tsconfig.json` - TypeScript config (no changes)
- `prisma/schema.prisma` - Add 3 new tables only

---

## 12. Logging Strategy

### 12.1 Frontend Logging (Browser Console)

**New logs related to bridge:**

```typescript
// When checking bridge status
console.log('[QA-OPS] Bridge available: true');
console.log('[QA-OPS] Using bridge for sync');
console.log('[QA-OPS] Bridge offline, using fallback');

// On errors
console.error('[QA-OPS] Bridge error: BRIDGE_OFFLINE');
console.error('[QA-OPS] Falling back to CLI');
```

**No changes to existing frontend logging**

---

### 12.2 Backend Logging (Vercel)

**New logs related to bridge:**

```typescript
// Bridge routing decision
console.log('[ROAM] Checking bridge status for user:', userId);
console.log('[ROAM] Bridge available:', bridgeSession !== null);
console.log('[ROAM] Routing to: BRIDGE | CLI');

// Bridge communication
console.log('[ROAM-BRIDGE] Sending request to bridge endpoint', bridgeUrl);
console.log('[ROAM-BRIDGE] Response status:', response.status);
console.log('[ROAM-BRIDGE] Response time:', duration, 'ms');

// Fallback activation
console.warn('[ROAM-BRIDGE] Bridge unavailable, falling back to CLI');
console.error('[ROAM-BRIDGE] Bridge error:', errorMessage);

// Token management
console.log('[ROAM-BRIDGE-AUTH] Token refresh initiated');
console.log('[ROAM-BRIDGE-AUTH] Token expired, marking for refresh');
```

**Existing Roam CLI logs continue as-is**

---

### 12.3 Bridge Logs (Local Machine)

**Log file:** `~/.roam-bridge/logs/[date].log`

**All operations logged:**

```json
{
  "timestamp": "2026-06-30T12:34:56.789Z",
  "level": "INFO",
  "requestId": "req-abc123",
  "action": "REGISTER",
  "status": "SUCCESS",
  "details": "Bridge registered with backend",
  "duration": 234
}
```

**Log levels:**
- `INFO` - Normal operations
- `WARN` - Warning conditions
- `ERROR` - Error conditions
- `DEBUG` - Detailed debugging info (if enabled)

**Sample logs:**

```
2026-06-30T12:00:00.123Z INFO  Bridge started on localhost:7890
2026-06-30T12:00:01.456Z INFO  Connecting to Roam MCP on localhost:8088
2026-06-30T12:00:02.789Z INFO  Connected to Roam MCP
2026-06-30T12:00:03.012Z INFO  Registering with backend...
2026-06-30T12:00:04.345Z INFO  Registered with backend
2026-06-30T12:00:05.678Z INFO  Health check started (every 30s)

2026-06-30T12:05:34.901Z INFO  Request: POST /api/roam/sync [req-123]
2026-06-30T12:05:34.902Z INFO  Auth: Token validated
2026-06-30T12:05:34.903Z INFO  Calling Roam MCP...
2026-06-30T12:05:35.234Z INFO  Roam response received: 42 test cases
2026-06-30T12:05:35.235Z INFO  Request completed [req-123] in 334ms

2026-06-30T12:30:00.000Z INFO  Health check: status=READY
2026-06-30T12:30:00.000Z INFO  Uptime: 30m, Requests: 15, Errors: 0
```

**Sensitive data masking:**
- API token: Masked to first 8 chars: `roam-gra...`
- User IDs: Hashed
- Project IDs: Full (non-sensitive)

---

### 12.4 Audit Trail (Backend Database)

**Table: BridgeLog**

```
userId | bridgeId | action | status | duration | error | timestamp
-------|----------|--------|--------|----------|-------|----------
user1  | bridge1  | SYNC   | OK     | 234      | null  | 2026-06-30 12:34:00
user1  | bridge1  | SYNC   | OK     | 256      | null  | 2026-06-30 12:35:00
user1  | bridge1  | SEARCH | OK     | 45       | null  | 2026-06-30 12:36:00
user2  | bridge2  | SYNC   | ERROR  | 5000     | TIMEOUT | 2026-06-30 12:37:00
```

**Accessible via:**
- UI: Admin dashboard (future feature)
- API: `GET /api/bridge/logs?userId=X&days=30`
- Export: `GET /api/bridge/logs/export?format=csv`

---

## 13. Rollback Strategy

### 13.1 Instant Rollback (Zero Downtime)

**If bridge causes issues, instant rollback is possible because:**

1. **CLI fallback always available**
   - Old Roam CLI code path still in codebase
   - Endpoint logic checks: bridge available? YES → use bridge; NO → use CLI
   - No changes to CLI code, still works as before

2. **Feature flag approach (optional)**
   ```typescript
   // In backend code
   const useBridgeForSyncType = (await featureFlags.get('bridge.enabled')) ?? false;
   
   if (useBridgeForSyncType && bridgeAvailable) {
     // Use bridge
   } else {
     // Use CLI (fallback)
   }
   ```

3. **Disable bridge at endpoint level**
   ```typescript
   // Disable bridge for all users instantly
   await featureFlags.set('bridge.enabled', false);
   
   // All requests route to CLI immediately
   // No deployment needed
   ```

---

### 13.2 Rollback Steps

**If major issue discovered:**

```
STEP 1: Disable bridge globally (60 seconds)
  $ aws lambda invoke ... --function featureFlags
  → Set bridge.enabled = false

STEP 2: Verify rollback
  $ Monitor /api/roam/* endpoints
  → All routing to CLI
  → No bridge errors in logs

STEP 3: Notify users (if needed)
  $ Send notification in app
  → "Using fallback Roam connection (temporary)"

STEP 4: Investigate issue
  $ Check bridge logs
  $ Check backend logs
  $ Review recent code changes

STEP 5: Fix and redeploy
  $ Fix bug in bridge or backend
  $ Deploy new version
  $ Re-enable bridge.enabled = true
```

---

### 13.3 Partial Rollback (Per-User)

**If only some users have issues:**

```typescript
// Disable bridge for specific user
await db.bridgeSession.update({
  where: { userId },
  data: { status: 'DISABLED' }
});

// That user routes to CLI
// Other users continue using bridge
```

---

### 13.4 Database Rollback

**If database schema migration fails:**

```sql
-- Rollback script (pre-generated)
DROP TABLE BridgeLog;
DROP TABLE BridgeSession;
DROP TABLE BridgeToken;
```

**Safety:**
- No data loss (tables are new, not modifying existing ones)
- Can be reverted without affecting existing data
- RoamConfig table unchanged

---

### 13.5 Code Rollback

**If code changes are problematic:**

```bash
# Revert bridge routing logic
git revert <commit-hash>
git push origin main

# Vercel auto-deploys
# Users automatically route to CLI fallback
```

**No manual action needed from users** - CLI still works as-is

---

## 14. Migration Phases

### Phase 0: Preparation (Week 1)

**Objective:** Infrastructure ready, no user-facing changes

**Tasks:**
- [ ] Create Prisma schema migrations for new tables (BridgeToken, BridgeSession, BridgeLog)
- [ ] Deploy database changes to Supabase
- [ ] Create bridge routing helper functions (not yet used)
- [ ] Add bridge-related API endpoints (disabled by default)
- [ ] Write unit tests for bridge logic
- [ ] Create bridge CLI package structure

**Testing:**
- [ ] Unit tests pass
- [ ] Local integration tests pass
- [ ] No new errors in existing endpoints

**Rollback:** Revert database migrations, remove new code branches

---

### Phase 1: Bridge Development (Weeks 2-3)

**Objective:** Build and test bridge locally

**Tasks:**
- [ ] Develop @qa-ops/roam-bridge CLI package
- [ ] Implement bridge registration endpoint
- [ ] Implement bridge heartbeat endpoint
- [ ] Implement bridge Roam communication
- [ ] Write bridge unit tests
- [ ] Write bridge integration tests (locally)

**Testing:**
- [ ] Manual testing on Mac/Windows/Linux
- [ ] Bridge can register with local backend
- [ ] Bridge can communicate with Roam MCP
- [ ] Bridge logs working correctly
- [ ] Error handling working

**Deployment:** NPM package (internal, not yet released)

---

### Phase 2: Backend Integration (Week 4)

**Objective:** Backend can route requests to bridge (feature-flagged off)

**Tasks:**
- [ ] Implement bridge routing logic in /api/roam/* endpoints
- [ ] Add bridge availability check
- [ ] Add bridge request/response handling
- [ ] Add bridge-to-backend auth token validation
- [ ] Add bridge status monitoring
- [ ] Enable feature flag: bridge.enabled = false (disabled)

**Testing:**
- [ ] Existing tests still pass
- [ ] Bridge endpoints respond correctly (when called directly)
- [ ] Fallback to CLI works
- [ ] All error codes tested
- [ ] Load tests pass (no performance regression)

**Deployment:** Deploy to Vercel staging environment

---

### Phase 3: Internal Pilot (Week 5)

**Objective:** Test with first 2 users (internal team)

**Tasks:**
- [ ] Install bridge on 2 machines (Windows laptops)
- [ ] Enable bridge.enabled = true for these users (via database)
- [ ] Have users use app normally
- [ ] Monitor logs and metrics
- [ ] Collect feedback

**Testing:**
- [ ] Manual user testing
- [ ] Monitor: /api/roam/* endpoint metrics
- [ ] Monitor: bridge health checks
- [ ] Monitor: error rates
- [ ] Check: Performance impact

**Metrics to track:**
- Response times (bridge vs CLI)
- Error rates
- Bridge uptime
- User feedback

**Decision:**
- If issues: Disable bridge, investigate, fix, re-enable
- If successful: Move to Phase 4

---

### Phase 4: Beta Rollout (Week 6)

**Objective:** Roll out to all users with ability to opt-out

**Tasks:**
- [ ] Document bridge installation in wiki
- [ ] Create FAQ and troubleshooting guide
- [ ] Add bridge status indicator to UI (show if using bridge or CLI)
- [ ] Implement user preference: bridge.preferred = true/false
- [ ] Set bridge.enabled = true for all users

**Deployment:**
- [ ] All users can install bridge
- [ ] Users can choose to use bridge or stay on CLI
- [ ] Backend routes based on user preference + bridge availability

**Support:**
- [ ] Monitor bridge.logs table for errors
- [ ] Answer user questions
- [ ] Provide troubleshooting help

---

### Phase 5: Deprecation (Week 8+)

**Objective:** Plan CLI deprecation (months away)

**Timeline:**
- Week 8: Announce CLI deprecation (6-month timeline)
- Month 4: Show warning when using CLI: "Switch to bridge for better performance"
- Month 6: Make bridge default, CLI opt-in
- Month 9: Remove CLI code entirely

**Before removing CLI:**
- [ ] 95%+ users on bridge
- [ ] Zero CLI-specific bugs
- [ ] All functionality available via bridge
- [ ] Users had 6 months notice

---

### Phase Timeline Summary

```
Week 1    Phase 0: Preparation
Week 2-3  Phase 1: Bridge Development
Week 4    Phase 2: Backend Integration (feature-flagged off)
Week 5    Phase 3: Internal Pilot (2 users)
Week 6    Phase 4: Beta Rollout (all users)
Week 7+   Phase 5: Stabilization & Deprecation Planning
```

---

## 15. File Changes

### 15.1 Files to be Modified

#### 1. **prisma/schema.prisma**
**Status:** Modified to add 3 new models
**Changes:**
- Add BridgeToken model
- Add BridgeSession model
- Add BridgeLog model
- No changes to existing models

**Risk:** Database migration required, but additive (no data loss)

---

#### 2. **app/api/roam/test-connection/route.ts**
**Status:** Modified to support bridge routing
**Changes:**
- Add bridge availability check
- Add bridge request handler
- Keep CLI fallback
- Add new response fields (bridgeUsed, code)

**Risk:** Low - Only routing logic added, existing code path preserved

---

#### 3. **app/api/roam/sync/route.ts**
**Status:** Modified to support bridge routing
**Changes:**
- Add bridge routing logic
- Keep CLI fallback
- Add new response fields

**Risk:** Low - Critical endpoint, but fallback preserved

---

#### 4. **app/api/roam/sync-simple/route.ts**
**Status:** Modified to support bridge routing
**Changes:**
- Same as sync/route.ts

**Risk:** Low

---

#### 5. **app/api/roam/export/route.ts**
**Status:** Modified to support bridge routing
**Changes:**
- Same pattern as other roam endpoints

**Risk:** Low

---

#### 6. **app/api/roam/import/route.ts**
**Status:** Modified to support bridge routing
**Changes:**
- Same pattern as other roam endpoints

**Risk:** Low

---

#### 7. **app/api/roam/logs/route.ts**
**Status:** Modified to support bridge log filtering
**Changes:**
- Add source filter (BRIDGE vs CLI)
- Include BridgeLog table in queries
- Maintain backward compatibility

**Risk:** Low

---

#### 8. **app/api/roam/scheduled-sync/route.ts**
**Status:** Modified to support bridge routing
**Changes:**
- Add bridge routing logic
- GitHub Actions can target bridge webhook if available

**Risk:** Low

---

#### 9. **lib/roam/cli-service.ts**
**Status:** Unchanged
**Changes:** None
**Reason:** CLI path still needed for fallback
**Risk:** None

---

#### 10. **lib/roam/sync.ts**
**Status:** Unchanged
**Changes:** None
**Reason:** Sync logic still needed for fallback
**Risk:** None

---

#### 11. **package.json**
**Status:** Modified to add bridge development dependency
**Changes:**
- Add @qa-ops/roam-bridge (when ready to release)
- Currently no change needed in this phase

**Risk:** None

---

#### 12. **tsconfig.json**
**Status:** Unchanged
**Changes:** None
**Risk:** None

---

#### 13. **.env** (example)
**Status:** Unchanged
**Changes:** None (no new environment variables needed)
**Reason:** Bridge uses local config file, not env vars
**Risk:** None

---

#### 14. **CLAUDE.md** (project instructions)
**Status:** Should be updated with bridge info
**Changes:**
- Add bridge architecture notes
- Link to bridge documentation

**Risk:** None (documentation only)

---

### 15.2 Files to be Created

#### 1. **app/api/bridge/register/route.ts** (NEW)
**Purpose:** Register a new bridge with backend
**Size:** ~150 lines
**Imports:**
- NextRequest, NextResponse
- prisma
- Helper: generateBridgeToken()
**Risk:** New endpoint, careful validation required

---

#### 2. **app/api/bridge/heartbeat/route.ts** (NEW)
**Purpose:** Receive heartbeat from running bridges
**Size:** ~100 lines
**Imports:**
- NextRequest, NextResponse
- prisma
- Helper: validateBridgeToken()
**Risk:** New endpoint, high-frequency calls

---

#### 3. **app/api/bridge/[bridgeId]/unregister/route.ts** (NEW)
**Purpose:** Unregister a bridge
**Size:** ~80 lines
**Imports:**
- NextRequest, NextResponse
- prisma
**Risk:** Low - straightforward deletion

---

#### 4. **app/api/bridge/status/route.ts** (NEW)
**Purpose:** Get bridge status for current user
**Size:** ~100 lines
**Imports:**
- NextRequest, NextResponse
- prisma
**Risk:** Low

---

#### 5. **lib/roam/bridge-client.ts** (NEW)
**Purpose:** Client for communicating with local bridge
**Size:** ~300 lines
**Exports:**
- class BridgeClient
- Methods: test(), sync(), search(), etc.
- Error handling
- Retry logic
**Risk:** Medium - Complex retry logic, needs thorough testing

---

#### 6. **lib/bridge/token-manager.ts** (NEW)
**Purpose:** Manage bridge tokens (validate, refresh, store)
**Size:** ~200 lines
**Exports:**
- validateBridgeToken()
- refreshBridgeToken()
- generateBridgeToken()
**Risk:** Medium - Security-sensitive, token validation

---

#### 7. **lib/bridge/routing.ts** (NEW)
**Purpose:** Route requests to bridge or CLI
**Size:** ~150 lines
**Exports:**
- shouldUseBridge(userId)
- routeRoamRequest(endpoint, options)
**Risk:** Medium - Core routing logic, affects all requests

---

#### 8. **lib/bridge/health-monitor.ts** (NEW)
**Purpose:** Monitor bridge health, update database
**Size:** ~200 lines
**Exports:**
- checkBridgeHealth(userId)
- markBridgeOffline(userId)
- markBridgeOnline(userId)
**Risk:** Medium - Database updates, timing critical

---

#### 9. **prisma/migrations/[timestamp]_add_bridge_tables/migration.sql** (NEW)
**Purpose:** Create BridgeToken, BridgeSession, BridgeLog tables
**Size:** ~80 lines
**Risk:** High - Database migration, must be carefully tested

---

#### 10. **lib/feature-flags.ts** (NEW - unless exists)
**Purpose:** Feature flag management
**Size:** ~100 lines
**Exports:**
- isFeatureEnabled(flag)
- setFeature(flag, enabled)
**Risk:** Medium - If doesn't exist, adds new dependency

---

#### 11. **docs/BRIDGE_INSTALLATION.md** (NEW)
**Purpose:** User-facing bridge installation guide
**Size:** ~500 lines
**Audience:** Teammates
**Risk:** None (documentation)

---

#### 12. **docs/BRIDGE_TROUBLESHOOTING.md** (NEW)
**Purpose:** Troubleshooting guide for bridge issues
**Size:** ~300 lines
**Audience:** Teammates + Support
**Risk:** None (documentation)

---

#### 13. **lib/types/bridge.ts** (NEW)
**Purpose:** TypeScript types for bridge-related data
**Size:** ~100 lines
**Exports:**
- BridgeToken
- BridgeSession
- BridgeStatus
- BridgeRequest
- BridgeResponse
**Risk:** Low - Type definitions only

---

#### 14. **app/api/roam/bridge-info/route.ts** (NEW - Optional)
**Purpose:** Return bridge info to frontend (bridge available? which user?)
**Size:** ~50 lines
**Risk:** Low - Optional, for UI improvements

---

### 15.3 Summary Table

| File | Type | Status | Lines | Risk | Notes |
|------|------|--------|-------|------|-------|
| prisma/schema.prisma | Modified | Add 3 tables | +50 | High | DB migration required |
| app/api/roam/test-connection/route.ts | Modified | Bridge routing | +100 | Low | Fallback preserved |
| app/api/roam/sync/route.ts | Modified | Bridge routing | +80 | Low | Critical endpoint |
| app/api/roam/sync-simple/route.ts | Modified | Bridge routing | +80 | Low | Similar to sync |
| app/api/roam/export/route.ts | Modified | Bridge routing | +60 | Low | Similar to sync |
| app/api/roam/import/route.ts | Modified | Bridge routing | +60 | Low | Similar to sync |
| app/api/roam/logs/route.ts | Modified | Bridge filtering | +30 | Low | New filter param |
| app/api/roam/scheduled-sync/route.ts | Modified | Bridge routing | +80 | Low | Similar to sync |
| lib/roam/cli-service.ts | Unchanged | - | 0 | None | Fallback mechanism |
| lib/roam/sync.ts | Unchanged | - | 0 | None | Fallback mechanism |
| app/api/bridge/register/route.ts | New | Bridge registration | 150 | Medium | Auth validation |
| app/api/bridge/heartbeat/route.ts | New | Health check | 100 | Medium | High-frequency |
| app/api/bridge/[id]/unregister/route.ts | New | Unregister | 80 | Low | Straightforward |
| app/api/bridge/status/route.ts | New | Status query | 100 | Low | Read-only |
| lib/roam/bridge-client.ts | New | Bridge client | 300 | High | Retry + error handling |
| lib/bridge/token-manager.ts | New | Token management | 200 | High | Security-sensitive |
| lib/bridge/routing.ts | New | Request routing | 150 | High | Core logic |
| lib/bridge/health-monitor.ts | New | Health monitoring | 200 | High | Database updates |
| prisma/migrations/[id]/migration.sql | New | DB schema | 80 | High | Must be reversible |
| lib/feature-flags.ts | New | Feature flags | 100 | Medium | If new dependency |
| docs/BRIDGE_INSTALLATION.md | New | Documentation | 500 | None | User guide |
| docs/BRIDGE_TROUBLESHOOTING.md | New | Documentation | 300 | None | Support guide |
| lib/types/bridge.ts | New | Type definitions | 100 | Low | Types only |
| app/api/roam/bridge-info/route.ts | New (Optional) | Bridge info | 50 | None | Optional |

---

## 16. Risk Analysis

### 16.1 Risk by Modified File

#### **prisma/schema.prisma** - HIGH RISK

**Risk:** Database schema changes are irreversible without migration

**Specific Risks:**
1. **Migration failure**
   - If migration fails partway, database could be in inconsistent state
   - Must have dry-run testing first

2. **Performance impact**
   - New indexes on BridgeToken, BridgeSession, BridgeLog
   - Could slow down other queries if not carefully indexed
   - Needs EXPLAIN ANALYZE testing

3. **Data integrity**
   - Foreign keys to User table must not break
   - Cascade delete could accidentally delete user data

**Mitigation:**
- [ ] Test migration on staging database first
- [ ] Create rollback script before deploying
- [ ] Monitor database performance after deploy
- [ ] Index strategy: Only critical queries get indexes
- [ ] Use ON DELETE CASCADE carefully, test with actual data

**Reversibility:** ✓ Fully reversible (migration rollback script provided)

---

#### **app/api/roam/test-connection/route.ts** - MEDIUM RISK

**Risk:** This endpoint is used by new users during setup

**Specific Risks:**
1. **Routing logic bug**
   - If bridge routing fails, falls back to CLI
   - CLI doesn't work on Vercel, returns error
   - User sees error instead of helpful "Install Bridge" message

2. **Error masking**
   - Bridge error might not be properly converted to error response
   - User might see confusing error messages

3. **Token validation**
   - Bridge token might be invalid but accepted
   - Could allow unauthorized access to Roam

**Mitigation:**
- [ ] Test both bridge and CLI code paths thoroughly
- [ ] Test all error cases (bridge offline, token invalid, etc.)
- [ ] Return clear error messages with helpful links
- [ ] Validate bridge token strictly
- [ ] Unit test routing logic separately

**Reversibility:** ✓ Can instantly fallback to CLI-only by feature flag

---

#### **app/api/roam/sync/route.ts** - HIGH RISK

**Risk:** This is the most critical endpoint, used for actual data operations

**Specific Risks:**
1. **Data loss**
   - If bridge request fails silently, no retries
   - User thinks data was synced, but wasn't

2. **Duplicate syncs**
   - If bridge request succeeds but timeout occurs
   - Backend retries, bridge syncs again
   - Duplicate test cases created

3. **State inconsistency**
   - Backend state doesn't match Roam state
   - Test cases out of sync

4. **Bridge timeout**
   - Bridge taking too long to sync
   - Frontend times out, user retries
   - Multiple retries cause duplicate syncs

**Mitigation:**
- [ ] Implement idempotent sync (check if already synced)
- [ ] Use request IDs to detect duplicates
- [ ] Set appropriate timeouts (longer than expected)
- [ ] Log all sync attempts with requestId
- [ ] Add SyncLog entries for each attempt
- [ ] Test with large graphs (1000+ pages)
- [ ] Test network interruption scenarios
- [ ] Implement sync deduplication in database

**Reversibility:** ✓ Fallback to CLI-only, though likely to fail on Vercel

---

#### **lib/roam/bridge-client.ts** - HIGH RISK

**Risk:** Complex retry logic and error handling, security-critical

**Specific Risks:**
1. **Infinite retry loops**
   - Bridge client keeps retrying forever
   - Thread/process never completes
   - Vercel timeout (10 min limit) eventually hit

2. **Memory leaks**
   - Retry state not cleaned up properly
   - Buffer accumulates in memory
   - Eventually crashes process

3. **Race conditions**
   - Multiple concurrent requests interfere
   - State becomes inconsistent

4. **Token exposure**
   - Bridge token might be logged in plain text
   - Sensitive in error messages

5. **Man-in-the-middle**
   - Bridge on localhost:7890 is accessible locally
   - If user runs malware, can intercept token

**Mitigation:**
- [ ] Implement max retries (3 total attempts, 1 retry)
- [ ] Implement request timeout (60s max)
- [ ] Test with concurrent requests (10+ simultaneous)
- [ ] Never log full bridge token, mask it
- [ ] Use HTTPS for backend-to-bridge? (Needs decision)
- [ ] Validate response format strictly
- [ ] Add circuit breaker pattern (fail-fast if many errors)
- [ ] Load test with 100+ concurrent requests

**Reversibility:** ✓ Can disable bridge routing globally, fallback to CLI

---

#### **lib/bridge/routing.ts** - HIGH RISK

**Risk:** Core routing logic affects all Roam requests

**Specific Risks:**
1. **Logic error in routing decision**
   - Routes to offline bridge instead of CLI
   - User gets error instead of fallback

2. **Race condition in bridge check**
   - Bridge status changes between check and request
   - Routes to bridge that goes offline
   - Request fails with timeout

3. **Caching issue**
   - Bridge status cached too long
   - Routes to offline bridge after it goes down

4. **Silent failure**
   - Routing silently fails, returns null
   - Caller doesn't handle null properly
   - Undefined behavior downstream

**Mitigation:**
- [ ] Simple, clear routing logic (easy to audit)
- [ ] No caching of bridge status (always check fresh)
- [ ] Null checks at every decision point
- [ ] Unit test all routing paths separately
- [ ] Integration test with real bridge online/offline
- [ ] Add logging of routing decision
- [ ] Feature flag to force CLI-only mode

**Reversibility:** ✓ Feature flag can disable bridge instantly

---

### 16.2 Risk by New File

#### **app/api/bridge/register/route.ts** - MEDIUM RISK

**Risk:** Endpoint for bridge registration, could be abused

**Specific Risks:**
1. **Token generation collision**
   - Generated token matches existing token
   - Two bridges get same token
   - Second bridge can impersonate first

2. **Missing validation**
   - Accept invalid graph names
   - Accept invalid public keys
   - Database corruption

3. **Rate limiting**
   - User registers bridge 1000 times
   - Creates 1000 tokens in database
   - Database bloat

**Mitigation:**
- [ ] Use secure random token generation (crypto.randomBytes)
- [ ] Check token uniqueness before inserting
- [ ] Validate graphName format (alphanumeric, spaces, underscores)
- [ ] Rate limit: Max 1 registration per user per 5 minutes
- [ ] Rate limit: Max 10 active bridges per user
- [ ] Add CSRF protection
- [ ] Test with invalid inputs

**Reversibility:** ✓ Delete registration data from database, bridge auto-unregisters

---

#### **lib/roam/bridge-client.ts** - HIGHEST RISK

**Risk:** HTTP client for bridge communication, many things can go wrong

**See High Risk section above**

---

#### **lib/bridge/token-manager.ts** - HIGH RISK

**Risk:** Security-critical token management code

**Specific Risks:**
1. **Token storage**
   - Token stored in plain text in database
   - Database breach exposes all tokens
   - Should be hashed

2. **Token validation bypass**
   - Validation logic has bug
   - Invalid token accepted
   - Unauthorized access to bridge

3. **Token refresh timing**
   - Token refresh happens at wrong time
   - Token expires before refresh
   - User suddenly cannot access bridge

4. **Timing attack**
   - Token comparison not constant-time
   - Attacker can guess token byte-by-byte

**Mitigation:**
- [ ] Hash tokens with bcrypt before storing (if practical)
- [ ] Strict validation: Check token format, expiry, status
- [ ] Refresh tokens proactively (at 7-day mark)
- [ ] Use crypto.timingSafeEqual() for token comparison
- [ ] Audit token validation code with security expert
- [ ] Test token validation extensively
- [ ] Log token usage for audit trail

**Reversibility:** ✓ Tokens can be revoked/regenerated in database

---

#### **prisma/migrations/[id]/migration.sql** - HIGHEST RISK

**Risk:** Database schema changes, irreversible without rollback script

**See High Risk section under prisma/schema.prisma**

**Additional Risks:**
1. **Production migration failure**
   - Migration script has syntax error
   - PostgreSQL version incompatibility
   - Cannot connect to database mid-migration

2. **Concurrent requests during migration**
   - Other requests try to access migrating tables
   - Queries fail or timeout
   - Users see errors

3. **Lock timeout**
   - Migration takes too long
   - Locks held too long
   - Other queries timeout

**Mitigation:**
- [ ] Test migration on exact same database version as production
- [ ] Dry-run migration on staging before production
- [ ] Create pre-migration backup
- [ ] Plan migration during low-traffic window (if possible)
- [ ] Add timeout to migration (max 10 minutes)
- [ ] Monitor database during migration
- [ ] Have rollback plan ready to execute in < 5 minutes

**Reversibility:** ✓ Rollback script provided, can revert in < 1 minute

---

### 16.3 Risk Matrix

```
                Reversibility
                     │
                     │ Easy (minutes)
           HIGH      │    
      ╱─────────────╲│
     │               │
     │ Feature flags │  ← app/api/roam/* endpoints
     │ Database      │  ← prisma schema
     │ Error config  │  ← lib/bridge/token-manager.ts
     │               │  ← lib/roam/bridge-client.ts
     │               │  ← lib/bridge/routing.ts
     │               │  ← prisma/migrations
     │               │
     └───────────────┴──────────────────→ Impact
           MEDIUM         HIGH
```

**High Risk Items:**
1. prisma schema changes (Highest)
2. lib/roam/bridge-client.ts (Highest)
3. lib/bridge/token-manager.ts (High)
4. app/api/roam/sync/route.ts (High)
5. lib/bridge/routing.ts (High)

**Medium Risk Items:**
1. app/api/bridge/register/route.ts
2. lib/bridge/health-monitor.ts
3. app/api/roam/test-connection/route.ts

**Low Risk Items:**
1. Documentation files
2. Type definitions
3. app/api/bridge/status/route.ts
4. New optional UI endpoints

---

### 16.4 Risk Mitigation Plan

**Before implementing any code:**

Phase 0 (Preparation):
- [ ] Create comprehensive test plan (unit, integration, load tests)
- [ ] Set up staging environment identical to production
- [ ] Create database backup & restore procedure
- [ ] Prepare rollback runbook (specific commands, expected time)
- [ ] Schedule code review with senior engineer
- [ ] Plan deployment during low-traffic window
- [ ] Set up monitoring alerts for bridge-related errors
- [ ] Create user communication plan (FAQ, troubleshooting guide)

Phase 1 (Development):
- [ ] Write unit tests for all new code (>90% coverage)
- [ ] Write integration tests (bridge ↔ Roam ↔ backend)
- [ ] Write load tests (100+ concurrent requests)
- [ ] Perform security audit of token handling
- [ ] Test database migrations on staging
- [ ] Test rollback procedure on staging
- [ ] Peer code review before merge

Phase 2 (Deployment):
- [ ] Deploy to staging environment
- [ ] Run full test suite on staging
- [ ] Manual testing of all happy paths
- [ ] Manual testing of all error paths
- [ ] Load test on staging (simulated traffic)
- [ ] Monitor staging for 24 hours
- [ ] Deploy to production during low-traffic window (e.g., 2 AM)
- [ ] Have deployment team on standby
- [ ] Monitor production metrics (response time, error rate, CPU, memory)
- [ ] Execute rollback if any issues detected within first hour

Phase 3 (Monitoring):
- [ ] Monitor error rates for 1 week
- [ ] Monitor performance metrics for 1 week
- [ ] Collect user feedback during pilot phase
- [ ] Monitor database performance (query times, lock contention)
- [ ] Review bridge logs for issues
- [ ] Adjust timeouts/retries based on real-world usage

---

## Summary

This comprehensive design provides:

1. ✓ **Complete architecture** showing how all components interact
2. ✓ **Browser flow** explaining user experience
3. ✓ **Local bridge flow** with state machine and request processing
4. ✓ **Backend flow** with decision logic and error handling
5. ✓ **API contracts** for all endpoints (browser↔backend, backend↔bridge)
6. ✓ **Endpoint analysis** - what changes, what stays, what's new
7. ✓ **CORS strategy** - why browser can't call bridge directly
8. ✓ **Authentication** - token-based with automatic refresh
9. ✓ **Error handling** - classified by severity with recovery
10. ✓ **Bridge installation** - step-by-step for teammates
11. ✓ **Configuration storage** - local files and database
12. ✓ **Logging strategy** - all layers with sensitive data masking
13. ✓ **Rollback strategy** - instant, per-user, and database-level
14. ✓ **Migration phases** - 5 phases over 6 weeks
15. ✓ **File changes** - 14 files modified, 24 files created
16. ✓ **Risk analysis** - detailed per file, mitigation strategies

**Next Step:** Schedule design review with stakeholders before proceeding to implementation phase.

