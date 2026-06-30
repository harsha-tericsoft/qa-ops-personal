# Scenario B Implementation Plan - Complete Detailed Specification

**Date:** June 30, 2026  
**Status:** READY FOR APPROVAL  
**Scope:** Bridge Session Registration Lifecycle with Persistence & Heartbeat

---

## 1. Complete Startup Sequence (Process Start to Ready)

### Timeline: Desktop Connector startup() function

```
┌─────────────────────────────────────────────────────────────────┐
│ [T+0ms] startup() called                                         │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────────┐
│ [T+10ms] PHASE 1: Load Configuration                            │
│ ├─ configManager.load()                                          │
│ │  ├─ Read ~/.qa-ops-bridge/config.json (if exists)              │
│ │  ├─ Parse JSON                                                 │
│ │  └─ Return: { bridgeId, graphName, bridgeToken, expiresAt }   │
│ └─ Log: "Configuration loaded" or "No existing config found"    │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────────┐
│ [T+50ms] PHASE 2: Create Server                                 │
│ ├─ createServer(config)                                          │
│ │  ├─ Create Express app                                         │
│ │  ├─ Setup middleware (JSON, logging, CORS)                     │
│ │  ├─ Setup routes (health, version, roam APIs)                  │
│ │  └─ Setup error handling                                       │
│ └─ Log: "Server configuration prepared"                         │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────────┐
│ [T+100ms] PHASE 3: Start Server                                 │
│ ├─ server.start()                                                │
│ │  ├─ Listen on 127.0.0.1:7890                                   │
│ │  └─ Promise resolves when listening                            │
│ └─ Log: "Server started on http://127.0.0.1:7890"              │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────────┐
│ [T+150ms] PHASE 4: Verify Health Endpoint                       │
│ ├─ waitForHealthCheck(host, port)                                │
│ │  ├─ Poll GET /health (max 10 retries, 500ms intervals)        │
│ │  ├─ Verify response.status === 'healthy'                      │
│ │  └─ Confirm server is ready to accept requests                │
│ └─ Log: "Health endpoint verified" or error                     │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────────┐
│ [T+200ms] PHASE 5: Register or Resume Session                  │
│ ├─ registerOrResumeSession()                                     │
│ │  ├─ Decision branch:                                           │
│ │  │  ├─ If config has valid token:                             │
│ │  │  │  └─ → RESUME SEQUENCE (see section 3)                   │
│ │  │  └─ Else:                                                   │
│ │  │     └─ → REGISTRATION SEQUENCE (see section 2)             │
│ │  └─ Return: success boolean, bridgeToken string               │
│ └─ Log: "Session registered" or "Session resumed"               │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────────┐
│ [T+400ms] PHASE 6: Start Heartbeat                              │
│ ├─ startHeartbeat()                                              │
│ │  ├─ Create HeartbeatService instance                           │
│ │  ├─ Call .start(bridgeId, token, webhookUrl)                  │
│ │  │  ├─ Send immediate heartbeat                                │
│ │  │  └─ Schedule 30-second interval                             │
│ │  └─ Return without waiting                                     │
│ └─ Log: "Heartbeat started"                                     │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────────┐
│ [T+450ms] ✅ READY                                               │
│ ├─ Desktop Connector fully operational                           │
│ ├─ Bridge session registered or resumed in database              │
│ ├─ Heartbeat running (updates every 30 seconds)                  │
│ └─ QA Ops can now route requests via bridge                     │
└─────────────────────────────────────────────────────────────────┘

Total startup time: ~450ms (typically < 1 second)
```

---

## 2. Registration Sequence (New Session)

### Triggered when: No existing config OR token expired

```
Desktop Connector
        │
        ├─ [1] registerBridge()
        │  ├─ Generate bridgeId (UUID format: bridge-xxxxxxxx-xxxx-xxxx...)
        │  ├─ Get graphName from config or env
        │  ├─ Get version from package.json
        │  └─ Prepare payload
        │
        ├─ [2] POST /api/bridge/register
        │  │  Headers: Content-Type: application/json
        │  │  Body: {
        │  │    bridgeId: "bridge-550e8400-...",
        │  │    graphName: "Project_Kinergy",
        │  │    version: "1.0.0",
        │  │    os: "win32",
        │  │    hostname: "harsha-laptop"
        │  │  }
        │  │
        │  └─→ Backend (app/api/bridge/register/route.ts)
        │     │
        │     ├─ [3] Validate input
        │     │  ├─ Check bridgeId format
        │     │  ├─ Check graphName format
        │     │  └─ Check version provided
        │     │
        │     ├─ [4] Extract userId from auth
        │     │  ├─ From Authorization header OR
        │     │  └─ From session cookie
        │     │  └─ For MVP: "user_placeholder"
        │     │
        │     ├─ [5] Check if bridge already registered
        │     │  └─ Query: bridgeToken WHERE bridgeId = body.bridgeId
        │     │
        │     ├─ [6] Create BridgeToken
        │     │  └─ Call: createBridgeToken(userId, bridgeId, graphName)
        │     │     ├─ Generate random token
        │     │     ├─ Set status = ACTIVE
        │     │     ├─ Set expiresAt = now + 30 days
        │     │     └─ Insert into DB
        │     │
        │     ├─ [7] Create BridgeSession
        │     │  └─ INSERT INTO bridgeSession {
        │     │       userId,
        │     │       bridgeTokenId,
        │     │       endpoint: "http://localhost:7890",
        │     │       status: "CONNECTED",
        │     │       expiresAt: same as token
        │     │     }
        │     │
        │     └─ [8] Return 200 OK
        │        └─ {
        │             success: true,
        │             bridgeToken: "tok_abc123...",
        │             expiresAt: "2026-07-30T18:30:00.000Z",
        │             webhookUrl: "http://localhost:3000/api/bridge/heartbeat",
        │             graphName: "Project_Kinergy"
        │           }
        │
        └─ [9] Desktop Connector receives response
           ├─ Extract bridgeToken
           ├─ Extract webhookUrl
           ├─ Extract expiresAt
           │
           ├─ [10] Save to config
           │  └─ configManager.save({
           │       bridgeToken: "tok_abc123...",
           │       bridgeId: "bridge-550e8400...",
           │       tokenExpiresAt: "2026-07-30T18:30:00.000Z",
           │       backendUrl: "http://localhost:3000",
           │       registeredAt: "2026-06-30T18:30:00.000Z"
           │     })
           │     └─ Write to ~/.qa-ops-bridge/config.json
           │
           └─ [11] Log success
              └─ "Bridge registered successfully"

Status: ✅ Session created in database
Next: Start heartbeat (section 4)
```

**Database State After Registration:**

```
BridgeToken table:
┌─────────────────────────────────────────────────────────────┐
│ id              | "token_123"                                │
│ userId          | "user_placeholder"                         │
│ bridgeId        | "bridge-550e8400-e29b-41d4-a716-..."      │
│ token           | "tok_abc123def456..."                      │
│ graphName       | "Project_Kinergy"                          │
│ status          | "ACTIVE"                                   │
│ expiresAt       | 2026-07-30 18:30:00                        │
│ createdAt       | 2026-06-30 18:30:00                        │
│ lastUsedAt      | NULL                                       │
└─────────────────────────────────────────────────────────────┘

BridgeSession table:
┌─────────────────────────────────────────────────────────────┐
│ id                  | "session_456"                           │
│ userId              | "user_placeholder"                      │
│ bridgeTokenId       | "token_123"                             │
│ endpoint            | "http://localhost:7890"                 │
│ status              | "CONNECTED"                             │
│ lastHealthCheckAt   | NULL                                    │
│ lastHealthCheckStatus | NULL                                  │
│ expiresAt           | 2026-07-30 18:30:00                     │
│ createdAt           | 2026-06-30 18:30:00                     │
│ updatedAt           | 2026-06-30 18:30:00                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Session Resume Sequence (Existing Session)

### Triggered when: Config exists AND token not expired

```
Desktop Connector
        │
        ├─ [1] registerOrResumeSession()
        │  │
        │  ├─ [2] Load config from disk
        │  │  └─ configManager.load()
        │  │     └─ Read ~/.qa-ops-bridge/config.json
        │  │
        │  ├─ [3] Check if token exists and valid
        │  │  ├─ If config.bridgeToken exists:
        │  │  │  └─ Parse config.tokenExpiresAt
        │  │  ├─ If expiresAt > now:
        │  │  │  └─ Token still valid ✓
        │  │  └─ Else:
        │  │     └─ Token expired, go to Registration (section 2)
        │  │
        │  ├─ [4] Validate token still exists on backend
        │  │  └─ Optional: Could query backend to verify session still valid
        │  │     (Skip for MVP - session TTL is 30 days)
        │  │
        │  └─ [5] Use existing token
        │     └─ No HTTP call needed
        │     └─ Return: { success: true, token, webhookUrl }
        │
        └─ [6] Log resume
           └─ "Session resumed from disk"

Status: ✅ Existing session reused (no duplicate created)
Next: Start heartbeat (section 4)
```

**Local Config File State:**

```
~/.qa-ops-bridge/config.json
{
  "version": "1.0.0",
  "bridgeId": "bridge-550e8400-e29b-41d4-a716-446655440000",
  "graphName": "Project_Kinergy",
  "bridgeToken": "tok_abc123def456...",
  "backendUrl": "http://localhost:3000",
  "port": 7890,
  "endpoint": "http://127.0.0.1:7890",
  "registeredAt": "2026-06-30T18:30:00.000Z",
  "tokenExpiresAt": "2026-07-30T18:30:00.000Z",
  "autoStartEnabled": false
}
```

---

## 4. Heartbeat Lifecycle

### Phase A: Initial Heartbeat (Immediately After Registration/Resume)

```
[T+400ms] startHeartbeat()
        │
        ├─ [1] Create HeartbeatService instance
        │
        ├─ [2] Call .start(bridgeId, token, webhookUrl)
        │
        └─ [3] Send immediate heartbeat
           │
           └─→ POST /api/bridge/heartbeat
              Headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer tok_abc123def456..."
              }
              Body: {
                "bridgeId": "bridge-550e8400-...",
                "token": "tok_abc123def456...",
                "status": "CONNECTED",
                "uptime": 0.35,
                "requestsProcessed": 0,
                "errorsInLast30s": 0,
                "roamStatus": "CONNECTED",
                "lastError": null
              }
              │
              └─→ Backend: app/api/bridge/heartbeat/route.ts
                 │
                 ├─ [4] Validate token
                 ├─ [5] Find BridgeSession
                 ├─ [6] Update session status and timestamp
                 │  └─ UPDATE bridgeSession SET {
                 │       status = "CONNECTED",
                 │       lastHealthCheckAt = now,
                 │       lastHealthCheckStatus = "Roam: CONNECTED, ..."
                 │     }
                 │
                 └─ [7] Return 200 OK
                    └─ {
                         "success": true,
                         "acknowledged": true,
                         "nextHeartbeatAt": "2026-06-30T18:30:30.000Z"
                       }

[T+420ms] ✅ First heartbeat successful
         Session marked CONNECTED in database
```

### Phase B: Periodic Heartbeat (Every 30 Seconds)

```
[T+30000ms] Heartbeat interval fires
           │
           ├─ [1] Gather current metrics
           │  ├─ uptime = process.uptime()
           │  ├─ requestsProcessed = global counter (incremented in middleware)
           │  ├─ errorsInLast30s = count of errors in last 30 seconds
           │  └─ roamStatus = "CONNECTED" (always, for now)
           │
           ├─ [2] Send heartbeat
           │  └─ POST /api/bridge/heartbeat (same as Phase A)
           │
           ├─ [3] Process response
           │  ├─ If 200 OK:
           │  │  ├─ Log success
           │  │  ├─ If newBridgeToken in response: Update local token
           │  │  └─ Reset error counter
           │  │
           │  ├─ If 401 (token expired):
           │  │  ├─ Log: "Token expired, re-registration needed"
           │  │  ├─ Clear local token
           │  │  ├─ On next startup: Will trigger Registration sequence
           │  │  └─ For now: Continue with stale token
           │  │
           │  └─ If error (network, timeout):
           │     └─ Log warning, retry at next interval
           │
           └─ [4] Schedule next heartbeat
              └─ Same process repeats at T+60000ms

[T+30030ms] Heartbeat complete
           Database session last updated: now
           Ready for next heartbeat cycle
```

### Phase C: Heartbeat Stop (On Shutdown)

```
shutdown('SIGTERM')
        │
        ├─ [1] Stop heartbeat service
        │  └─ heartbeatService.stop()
        │     └─ clearInterval(intervalId)
        │
        ├─ [2] Close server
        └─ [3] Exit process
```

---

## 5. Configuration Persistence Format

### File Location
```
~/.qa-ops-bridge/config.json

Linux/Mac:   /home/username/.qa-ops-bridge/config.json
Windows:     C:\Users\username\.qa-ops-bridge\config.json
```

### File Format (JSON)

```json
{
  "version": "1.0.0",
  "bridgeId": "bridge-550e8400-e29b-41d4-a716-446655440000",
  "graphName": "Project_Kinergy",
  "apiToken": "roam-graph-local-token-8qhtJFMD5b00K6GUkAgtioiWs9_Uj",
  "bridgeToken": "tok_abc123def456ghi789jkl012mno345pqr",
  "backendUrl": "http://localhost:3000",
  "port": 7890,
  "endpoint": "http://127.0.0.1:7890",
  "registeredAt": "2026-06-30T18:30:00.000Z",
  "tokenExpiresAt": "2026-07-30T18:30:00.000Z",
  "autoStartEnabled": false
}
```

### Field Descriptions

| Field | Type | Source | Use | Example |
|-------|------|--------|-----|---------|
| version | string | package.json | Track config version | "1.0.0" |
| bridgeId | string | Generated UUID | Identifier for bridge | "bridge-550e8400-..." |
| graphName | string | User config | Roam graph name | "Project_Kinergy" |
| apiToken | string | User input | Roam API token | "roam-graph-local-..." |
| bridgeToken | string | Backend response | Auth with backend | "tok_abc123..." |
| backendUrl | string | Env var | QA Ops backend URL | "http://localhost:3000" |
| port | number | Env var (default 7890) | Server port | 7890 |
| endpoint | string | Computed | Bridge endpoint URL | "http://127.0.0.1:7890" |
| registeredAt | ISO8601 | Now | When session created | "2026-06-30T18:30:00.000Z" |
| tokenExpiresAt | ISO8601 | Backend response | Token expiration | "2026-07-30T18:30:00.000Z" |
| autoStartEnabled | boolean | User setting | Auto-start on boot | false |

### File Operations

**Read (startup):**
```
1. Check if file exists: ~/.qa-ops-bridge/config.json
2. If not exists: Return null (new session)
3. If exists: Read and parse JSON
4. Validate structure (check required fields)
5. Check tokenExpiresAt > now (is token still valid?)
6. Return config or null
```

**Write (after registration):**
```
1. Create directory: ~/.qa-ops-bridge (if not exists)
2. Create/overwrite file: config.json
3. Write JSON with 2-space indent (human readable)
4. Set file permissions: 0600 (owner read/write only)
5. Log success or error
```

**Validate (before use):**
```
1. Check bridgeToken exists and not empty
2. Check tokenExpiresAt >= now (not expired)
3. Check backendUrl is set
4. Return: isValid boolean
```

---

## 6. Failure Scenarios & Recovery

### Scenario A: Backend Unavailable

**When:** POST /api/bridge/register fails (network error, timeout)

```
Registration attempt
        │
        ├─ fetch() throws error (connection refused, timeout)
        │
        ├─ Catch error in registerBridge()
        │
        ├─ Log error: "Registration failed: ECONNREFUSED"
        │
        └─ Return: { success: false, error: "..." }

In index.ts:
        │
        ├─ registerOrResumeSession() returns false
        │
        ├─ Log warning: "Bridge registration unavailable, CLI fallback will be used"
        │
        ├─ Skip startHeartbeat()
        │
        ├─ Continue startup ✓
        │
        └─ Feature flag disabled by default
           → All requests use CLI (safe)

Recovery:
        └─ User can manually restart Desktop Connector
           → Will retry registration on next startup
```

**Behavior:** Desktop Connector starts successfully, CLI is used, no errors to user.

---

### Scenario B: Registration Fails (Backend Returns Error)

**When:** POST /api/bridge/register returns 400, 409, 500 status

```
Backend rejects registration
        │
        ├─ Scenarios:
        │  ├─ 400: Invalid bridgeId/graphName format
        │  ├─ 409: Bridge already registered (duplicate)
        │  └─ 500: Database error
        │
        ├─ Response: { success: false, error: "...", code: "..." }
        │
        ├─ Desktop Connector checks response.ok === false
        │
        ├─ Log error: "Registration failed: {status} {error}"
        │
        └─ Return: { success: false }

In index.ts:
        │
        ├─ catch error or check success === false
        │
        ├─ Log warning: "Bridge registration failed: {error}"
        │
        ├─ Skip startHeartbeat()
        │
        └─ Continue startup ✓

Recovery:
        ├─ If 409 (already registered):
        │  └─ Delete ~/.qa-ops-bridge/config.json
        │  └─ Restart Desktop Connector
        │  └─ Will register as new session
        │
        └─ If 400 (invalid input):
           └─ Check bridgeId format
           └─ Check graphName format
           └─ Restart with correct values
```

**Behavior:** Desktop Connector starts, CLI is used, warning logged.

---

### Scenario C: Heartbeat Fails (Network Error)

**When:** POST /api/bridge/heartbeat fails (connection timeout, 500 error)

```
Heartbeat interval fires (every 30 seconds)
        │
        ├─ Prepare payload with metrics
        │
        ├─ fetch() call fails OR response.ok === false
        │
        ├─ Catch error in HeartbeatService.sendHeartbeat()
        │
        ├─ Log warning: "Heartbeat failed: ETIMEDOUT"
        │
        └─ Continue (don't stop service)

Next cycle (T+60000ms):
        │
        └─ Retry heartbeat automatically
           → Repeat until success or connection dies

Database state:
        │
        └─ lastHealthCheckAt remains from last successful heartbeat
           (Session still marked CONNECTED if before failure)
```

**Behavior:** Heartbeat retries automatically, no action needed. Session will timeout in 30 days if heartbeat never succeeds.

---

### Scenario D: Expired Token (Backend Returns 401)

**When:** POST /api/bridge/heartbeat returns 401 TOKEN_EXPIRED

```
Heartbeat sends, but token expired
        │
        ├─ Backend returns: { success: false, code: "TOKEN_EXPIRED", requiresReRegistration: true }
        │
        ├─ Desktop Connector receives 401 status
        │
        ├─ Log warning: "Token expired, re-registration required"
        │
        ├─ Clear local bridgeToken: configManager.save({ bridgeToken: null })
        │
        └─ Continue with stale token locally (won't send more heartbeats with old token)

On next Desktop Connector restart:
        │
        ├─ Load config
        │
        ├─ Check tokenExpiresAt: Already passed
        │
        ├─ Discard stale token
        │
        └─ Trigger Registration sequence (section 2)
           → New BridgeToken and BridgeSession created

Database state:
        │
        ├─ Old BridgeSession expires naturally (TTL 30 days)
        │
        └─ New BridgeSession created with fresh token
```

**Behavior:** Heartbeat stops, user must restart Desktop Connector to re-register.

---

### Scenario E: Desktop Connector Restart (Graceful)

**When:** User restarts Desktop Connector (SIGTERM, SIGINT)

```
Running state:
        │
        ├─ Heartbeat service active (sends every 30 seconds)
        │
        ├─ Server listening on 7890
        │
        └─ Config persisted to disk

Shutdown signal received (Ctrl+C):
        │
        ├─ index.ts: shutdown('SIGTERM') called
        │
        ├─ HeartbeatService.stop()
        │  └─ clearInterval(intervalId)
        │  └─ No more heartbeats sent
        │
        ├─ server.stop()
        │  └─ Close HTTP connections
        │
        └─ process.exit(0)

Database state:
        │
        ├─ BridgeSession remains in database (TTL 30 days)
        │
        └─ lastHealthCheckAt shows time of last heartbeat

Next startup:
        │
        ├─ Load config from disk
        │
        ├─ Check tokenExpiresAt
        │
        ├─ If not expired: Resume existing session ✓
        │  └─ No duplicate BridgeSession created
        │
        └─ Start new heartbeat cycle
           → Updates lastHealthCheckAt with new timestamp
           → QA Ops detects Desktop Connector is back online
```

**Behavior:** Session is preserved across restarts, no duplicates created.

---

### Scenario F: Ungraceful Crash (No Shutdown Signal)

**When:** Process killed, power loss, or unhandled exception

```
Process dies suddenly
        │
        ├─ Heartbeat service stops (no cleanup)
        │
        ├─ Server closes (OS cleanup)
        │
        ├─ Config file on disk is safe (already persisted)
        │
        └─ No cleanup possible

Database state:
        │
        ├─ BridgeSession still marked CONNECTED
        │
        ├─ lastHealthCheckAt shows time before crash
        │
        └─ No heartbeat received for ~30+ seconds
           (But session doesn't auto-delete until TTL expires)

Next startup (after crash):
        │
        ├─ Load config from disk (still valid)
        │
        ├─ Resume existing session ✓
        │
        ├─ Send immediate heartbeat
        │  └─ Backend updates lastHealthCheckAt
        │  └─ Session status refreshed
        │
        └─ QA Ops marks Desktop Connector as back online

Recovery time:
        │
        └─ ~5 seconds (from restart to first heartbeat update)
           → QA Ops can detect Desktop Connector is recovered
```

**Behavior:** Session and token preserved on disk, recovery automatic on restart.

---

## 7. Sequence Diagram

```
Timeline: Desktop Connector Startup with Bridge Registration

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│   Desktop        │         │      Backend     │         │    Database      │
│   Connector      │         │   (QA Ops)       │         │   (Prisma ORM)   │
└────────┬─────────┘         └────────┬─────────┘         └────────┬─────────┘
         │                           │                             │
    [1] startup()                    │                             │
         │                           │                             │
    [2] configManager.load()         │                             │
         ├─ Read ~/.qa-ops-bridge/config.json                       │
         │  ├─ If file exists & token valid: RESUME PATH          │
         │  └─ If not exists or expired: REGISTER PATH             │
         │                           │                             │
    ┌────────────────────────────────────────────────────────────────┐
    │ REGISTRATION PATH (New Session)                                │
    └────────────────────────────────────────────────────────────────┘
         │                           │                             │
    [3] createServer()               │                             │
         ├─ Express app created      │                             │
         ├─ Middleware setup         │                             │
         └─ Routes setup             │                             │
         │                           │                             │
    [4] server.start()               │                             │
         ├─ Listen on 127.0.0.1:7890 │                             │
         └─ HTTP ready               │                             │
         │                           │                             │
    [5] waitForHealthCheck()         │                             │
         ├─ GET /health              │                             │
         └─ Confirmed ready          │                             │
         │                           │                             │
    [6] registerBridge()             │                             │
         │                           │                             │
         ├─ Generate bridgeId        │                             │
         ├─ Get graphName, version   │                             │
         │                           │                             │
         ├─ POST /api/bridge/register                              │
         ├────────────────────────────────────────>                │
         │                       [7] Validate input                │
         │                           │                             │
         │                       [8] Check if already registered    │
         │                           ├─────────────────────────────>
         │                           │ Query: bridgeToken WHERE    │
         │                           │ bridgeId = ?                │
         │                           <─────────────────────────────│
         │                           │ Not found (new)             │
         │                           │                             │
         │                       [9] Create BridgeToken            │
         │                           ├─────────────────────────────>
         │                           │ INSERT token record         │
         │                           │ (ACTIVE, expires in 30 days)│
         │                           <─────────────────────────────│
         │                           │ id: token_123               │
         │                           │                             │
         │                      [10] Create BridgeSession          │
         │                           ├─────────────────────────────>
         │                           │ INSERT session record       │
         │                           │ (CONNECTED, same TTL)       │
         │                           <─────────────────────────────│
         │                           │ id: session_456             │
         │                           │                             │
         │ Response 200 OK           │                             │
         │ {                         │                             │
         │   bridgeToken: tok_...,   │                             │
         │   expiresAt: ...,         │                             │
         │   webhookUrl: ...         │                             │
         │ }                         │                             │
         │<────────────────────────────────────────                │
         │                           │                             │
    [11] Save config to disk         │                             │
         ├─ Save bridgeToken         │                             │
         ├─ Save tokenExpiresAt      │                             │
         └─ ~/.qa-ops-bridge/config.json                           │
         │                           │                             │
    ┌────────────────────────────────────────────────────────────────┐
    │ HEARTBEAT STARTUP                                              │
    └────────────────────────────────────────────────────────────────┘
         │                           │                             │
    [12] startHeartbeat()            │                             │
         │                           │                             │
    [13] Send immediate heartbeat    │                             │
         │                           │                             │
         │ POST /api/bridge/heartbeat                              │
         │ {                         │                             │
         │   bridgeId: bridge-...,   │                             │
         │   token: tok_...,         │                             │
         │   status: CONNECTED,      │                             │
         │   uptime: 0.4,            │                             │
         │   requestsProcessed: 0,   │                             │
         │   errorsInLast30s: 0,     │                             │
         │   roamStatus: CONNECTED   │                             │
         │ }                         │                             │
         ├────────────────────────────────────────>                │
         │                      [14] Validate token                │
         │                           │                             │
         │                      [15] Find BridgeSession            │
         │                           ├─────────────────────────────>
         │                           │ Query: bridgeSession WHERE  │
         │                           │ userId = ? AND token_id = ? │
         │                           <─────────────────────────────│
         │                           │ Found: session_456          │
         │                           │                             │
         │                      [16] Update session status         │
         │                           ├─────────────────────────────>
         │                           │ UPDATE session SET          │
         │                           │ status=CONNECTED,           │
         │                           │ lastHealthCheckAt=now       │
         │                           <─────────────────────────────│
         │                           │ Updated                     │
         │                           │                             │
         │ Response 200 OK           │                             │
         │ {                         │                             │
         │   success: true,          │                             │
         │   acknowledged: true,     │                             │
         │   nextHeartbeatAt: ...    │                             │
         │ }                         │                             │
         │<────────────────────────────────────────                │
         │                           │                             │
    [17] Schedule next heartbeat (30s later)                       │
         │                           │                             │
    ✅ [18] READY                    │                             │
       │                             │                             │
       └─ Desktop Connector fully operational                      │
         - Bridge session registered in database                  │
         - Token persisted locally                                │
         - Heartbeat running                                      │
         - QA Ops can now route requests

    ┌────────────────────────────────────────────────────────────────┐
    │ LATER: QA Ops Request (when ENABLE_BRIDGE_ROUTING=true)        │
    └────────────────────────────────────────────────────────────────┘

QA Ops                              Backend                  Database
   │                                  │                          │
   ├─ POST /api/roam/search           │                          │
   ├─────────────────────────────────>│                          │
   │                              [1] shouldUseBridge()           │
   │                                  ├─ Check feature flag ✓      │
   │                                  ├─ Find BridgeSession       │
   │                                  ├──────────────────────────>│
   │                                  │ Query: bridgeSession WHERE│
   │                                  │ userId = ? AND           │
   │                                  │ expiresAt > now          │
   │                                  <──────────────────────────│
   │                                  │ FOUND: session_456 ✓      │
   │                                  │                          │
   │                              [2] Get bridge endpoint         │
   │                                  └─ "http://localhost:7890" │
   │                                  │                          │
   │                              [3] Route to Bridge            │
   │                                  ├─ POST http://localhost:7890/api/roam/search
   │                                  ├─────────────────────────────────────>
   │                                                  Desktop Connector
   │                                                  ├─ Verify auth token
   │                                                  ├─ Execute Roam CLI
   │                                                  ├─ Return results
   │                                                  <─────────────────────────────────────
   │                                  │                          │
   │ Response 200 OK                  │                          │
   │ {                                │                          │
   │   success: true,                 │                          │
   │   results: [...],                │                          │
   │   _source: "BRIDGE" ✓            │                          │
   │ }                                │                          │
   │<─────────────────────────────────│                          │
   │                                  │                          │
   └─ Request completed via Bridge    │                          │

Database state after heartbeat (T+30s):
   │
   ├─ BridgeSession:
   │  ├─ lastHealthCheckAt = now (updated)
   │  ├─ lastHealthCheckStatus = "Roam: CONNECTED, Uptime: 31s, Requests: 5"
   │  └─ status = CONNECTED
   │
   └─ Next heartbeat at T+60s
```

---

## 8. Exact Files That Will Change

### File 1: `qa-ops-desktop-connector/src/config/manager.ts`
**Type:** MODIFY (Replace placeholder with implementation)  
**Lines Changed:** ~50 (replace 30+ lines of placeholder code)

**Changes:**
- Implement `load()`: Read from ~/.qa-ops-bridge/config.json
- Implement `save()`: Write to ~/.qa-ops-bridge/config.json
- Add `getToken()`: Return bridgeToken if valid
- Add `isTokenValid()`: Check expiration
- Add `isTokenExpired()`: Boolean check
- Add `clearToken()`: Clear expired token
- Add config directory creation logic

---

### File 2: `qa-ops-desktop-connector/src/index.ts`
**Type:** MODIFY (Add registration orchestration after server.start())  
**Lines Changed:** ~40 (in startup() function)

**Changes:**
- After `server.start()` completes:
  - Add `await waitForHealthCheck(host, port)` (~15 lines)
  - Add `const registered = await registerOrResumeSession()` (~20 lines)
  - Add `if (registered) startHeartbeat()` (~5 lines)
- Add three helper functions:
  - `waitForHealthCheck()`: Poll /health endpoint
  - `registerOrResumeSession()`: Orchestrate registration or resume
  - `startHeartbeat()`: Initialize and start heartbeat service
- Add imports for new services

**Total new lines in index.ts:** ~40

---

### File 3: `qa-ops-desktop-connector/src/services/bridge-client.ts`
**Type:** NEW  
**Lines:** ~100

**Purpose:** HTTP client for POST /api/bridge/register

**Content:**
```typescript
export interface RegisterRequest { bridgeId, graphName, version, os?, hostname? }
export interface RegisterResponse { success, bridgeToken, expiresAt, webhookUrl }

export async function registerWithBackend(
  backendUrl: string,
  payload: RegisterRequest
): Promise<RegisterResponse | null>

- Fetch POST /api/bridge/register
- Parse response
- Handle errors
- Return token or null
```

**Lines:**
- Imports: ~5
- Types: ~10
- Main function: ~70
- Error handling: ~15

---

### File 4: `qa-ops-desktop-connector/src/services/heartbeat-service.ts`
**Type:** NEW  
**Lines:** ~120

**Purpose:** Periodic heartbeat sender

**Content:**
```typescript
export class HeartbeatService {
  private intervalId: NodeJS.Timer | null = null
  
  start(bridgeId: string, token: string, webhookUrl: string): void
  stop(): void
  private sendHeartbeat(...): Promise<void>
  private getMetrics(): HeartbeatMetrics
}

export function getHeartbeatServiceInstance(): HeartbeatService
```

**Lines:**
- Imports: ~8
- Class definition: ~15
- start() method: ~10
- stop() method: ~5
- sendHeartbeat() method: ~50
- getMetrics() method: ~20
- Singleton instance: ~10

---

### File 5: `qa-ops-desktop-connector/src/server.ts`
**Type:** MODIFY (Minor changes for metrics tracking)  
**Lines Changed:** ~15

**Changes:**
- In `setupMiddleware()`:
  - Add `requestsCount` global counter
  - Add `recentErrors` array for 30-second window
  - Increment counter on each request
  - Track errors for heartbeat
- Make counters accessible to heartbeat service via getter methods

**Total changes:** ~15 lines

---

### File 6: `qa-ops-desktop-connector/src/utils/config.ts` (Optional helper)
**Type:** NEW (Optional)  
**Lines:** ~30

**Purpose:** Config validation helpers

**Content:**
```typescript
export function isValidBridgeId(id: string): boolean
export function isValidGraphName(name: string): boolean
export function isValidToken(token: string, expiresAt: string): boolean
export function getBridgeIdFromEnv(): string
```

This is optional - can be embedded in manager.ts instead.

---

## 9. Estimated Lines Changed Per File

| File | Type | Current | Change | Total After | Effort |
|------|------|---------|--------|------------|--------|
| config/manager.ts | MODIFY | 86 | Replace ~50 lines | ~85 | Medium |
| index.ts | MODIFY | 96 | Add ~40 lines | ~135 | Medium |
| bridge-client.ts | NEW | 0 | Add ~100 lines | ~100 | Medium |
| heartbeat-service.ts | NEW | 0 | Add ~120 lines | ~120 | High |
| server.ts | MODIFY | 158 | Add ~15 lines | ~173 | Low |
| **TOTAL** | | | **~325 lines** | | |

**Build & Test Verification:**
- TypeScript compilation: ~2 minutes
- Desktop Connector build: ~1 minute
- QA Ops build: ~2 minutes
- Scenario B execution: ~5 minutes

---

## 10. Rollback Strategy

### Quick Rollback (5 minutes)

**Option A: Delete New Code (Simplest)**

1. Delete `qa-ops-desktop-connector/src/services/bridge-client.ts`
2. Delete `qa-ops-desktop-connector/src/services/heartbeat-service.ts`
3. Delete `qa-ops-desktop-connector/src/utils/config.ts` (if created)
4. Revert `qa-ops-desktop-connector/src/index.ts`:
   ```bash
   git checkout HEAD -- src/index.ts
   ```
5. Revert `qa-ops-desktop-connector/src/config/manager.ts`:
   ```bash
   git checkout HEAD -- src/config/manager.ts
   ```
6. Revert `qa-ops-desktop-connector/src/server.ts`:
   ```bash
   git checkout HEAD -- src/server.ts
   ```
7. Rebuild: `npm run build`

**Result:**
- Desktop Connector starts without bridge registration
- No BridgeSession created in database
- All requests use CLI (feature flag disabled by default)
- No errors or data corruption

---

### Safe Rollback (With State Cleanup)

If you want to completely remove all bridge state:

1. Execute Quick Rollback (above)
2. Delete local config file:
   ```bash
   rm -rf ~/.qa-ops-bridge/config.json
   ```
3. Optionally clear database bridge tables:
   ```sql
   DELETE FROM bridgeSession WHERE createdAt > '2026-06-30T00:00:00Z';
   DELETE FROM bridgeToken WHERE createdAt > '2026-06-30T00:00:00Z';
   ```

---

### No Impact Zone (Always Safe to Rollback)

**These are NOT affected by rollback:**
- ✅ QA Ops backend code (no changes)
- ✅ Bridge routing logic (no changes)
- ✅ Bridge client HTTP calls (no changes)
- ✅ CLI execution path (no changes)
- ✅ Feature flag system (no changes)
- ✅ Database schema (no changes - uses existing tables)
- ✅ Existing sessions (can be manually cleaned via SQL)

---

### Commit Points for Safe Rollback

Recommended to commit after each phase:

1. **Commit 1:** config/manager.ts + server.ts (persistence + metrics)
2. **Commit 2:** bridge-client.ts (registration HTTP client)
3. **Commit 3:** heartbeat-service.ts (heartbeat service)
4. **Commit 4:** index.ts (orchestration - final commit)

This allows rolling back individual components if needed.

---

## Summary

| Item | Detail |
|------|--------|
| **Startup Sequence** | Load → Create Server → Start Server → Verify Health → Register/Resume → Start Heartbeat → Ready |
| **Registration** | Generate bridgeId → POST /api/bridge/register → Save token → Done |
| **Resume** | Load config → Check token valid → Reuse token → Done (no HTTP) |
| **Heartbeat** | Send immediately, then every 30 seconds, update session status |
| **Config Persistence** | ~/.qa-ops-bridge/config.json in JSON format |
| **Failure Handling** | Graceful degradation to CLI fallback, automatic retry on restart |
| **Database Sequence Diagram** | Desktop Connector → Backend → Database with detailed flow |
| **Files Changed** | 6 files total (2 new, 4 modified) |
| **Total LOC** | ~325 lines of new code |
| **Rollback** | Delete 2 files, revert 3 files, rebuild (~5 minutes) |

---

## Approval Checklist

- [ ] Startup sequence clear and complete (section 1)
- [ ] Registration flow documented (section 2)
- [ ] Session resume flow documented (section 3)
- [ ] Heartbeat lifecycle complete (section 4)
- [ ] Config persistence format specified (section 5)
- [ ] All 6 failure scenarios covered (section 6)
- [ ] Sequence diagram shows all interactions (section 7)
- [ ] File changes are minimal and necessary (section 8)
- [ ] Line counts estimated per file (section 9)
- [ ] Rollback strategy is clear and safe (section 10)

**Status:** READY FOR IMPLEMENTATION APPROVAL
