# Scenario B Implementation - Executive Summary

**Status:** READY FOR APPROVAL  
**Goal:** Make QA Ops route requests through Desktop Connector bridge  
**Blocker:** Desktop Connector doesn't register with backend  

---

## 1. Overall Architecture (One Diagram)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      BRIDGE REGISTRATION ARCHITECTURE                │
└─────────────────────────────────────────────────────────────────────┘

Desktop Connector (localhost:7890)
    │
    ├─ Startup()
    │  ├─ Load Config (disk)
    │  ├─ Start Server (Express)
    │  ├─ Register OR Resume
    │  │  └─ HTTP POST /api/bridge/register (only if new)
    │  └─ Start Heartbeat (every 30s)
    │
    └─ Heartbeat Service (running)
       └─ POST /api/bridge/heartbeat (every 30s)
          │
          ↓ Creates & Updates
          │
QA Ops Backend (localhost:3000)
    │
    ├─ POST /api/bridge/register
    │  └─ Create BridgeToken + BridgeSession
    │
    ├─ POST /api/bridge/heartbeat
    │  └─ Update session status + timestamp
    │
    └─ GET /api/roam/* (routing decision)
       ├─ Check feature flag (ENABLED)
       ├─ Find BridgeSession in DB
       └─ Route to bridge if found ✓
          │
          ↓
Database (Prisma)
    │
    ├─ BridgeToken (1 per bridge)
    │  └─ token, status, expiresAt
    │
    ├─ BridgeSession (1 per user per bridge)
    │  └─ status, lastHealthCheckAt, expiresAt
    │
    └─ Keeps sessions alive via heartbeat
```

---

## 2. Startup Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│ Desktop Connector Startup Timeline                             │
└─────────────────────────────────────────────────────────────────┘

T+0ms    ┌─ startup() called
         │
T+10ms   ├─ configManager.load()
         │  ├─ Read ~/.qa-ops-bridge/config.json
         │  ├─ Parse JSON
         │  └─ Return config or null
         │
T+50ms   ├─ createServer()
         │  ├─ Create Express app
         │  └─ Setup routes/middleware
         │
T+100ms  ├─ server.start()
         │  └─ Listen on 127.0.0.1:7890
         │
T+150ms  ├─ waitForHealthCheck()
         │  └─ Poll GET /health until ready
         │
T+200ms  ├─ registerOrResumeSession()
         │  ├─ If no config: POST /api/bridge/register
         │  └─ If valid token: reuse (no HTTP)
         │
T+400ms  ├─ startHeartbeat()
         │  ├─ Send immediate POST /api/bridge/heartbeat
         │  └─ Schedule every 30s
         │
T+450ms  └─ ✅ READY
            └─ BridgeSession in database
              Heartbeat running
              QA Ops can route via bridge
```

---

## 3. Registration Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│ Registration: Desktop Connector → Backend → Database             │
└─────────────────────────────────────────────────────────────────┘

[1] Prepare Payload
    ├─ bridgeId: "bridge-550e8400-..." (UUID)
    ├─ graphName: "Project_Kinergy"
    ├─ version: "1.0.0"
    └─ os, hostname

[2] POST /api/bridge/register
    └─ timeout: 5 seconds

[3] Backend Validates
    ├─ Check format (bridgeId, graphName)
    ├─ Extract userId from auth
    └─ Check if already registered

[4] Backend Creates Token
    ├─ INSERT BridgeToken
    ├─ status: ACTIVE
    └─ expiresAt: now + 30 days

[5] Backend Creates Session
    ├─ INSERT BridgeSession
    ├─ status: CONNECTED
    └─ endpoint: http://localhost:7890

[6] Return 200 OK
    ├─ bridgeToken: "tok_abc123..."
    ├─ expiresAt: "2026-07-30T..."
    ├─ webhookUrl: "http://localhost:3000/api/bridge/heartbeat"
    └─ graphName: "Project_Kinergy"

[7] Desktop Connector Saves
    ├─ configManager.save({
    │    bridgeToken,
    │    tokenExpiresAt,
    │    backendUrl
    │  })
    └─ ~/.qa-ops-bridge/config.json

✅ Session Created in Database
   Ready for heartbeat
```

---

## 4. Heartbeat Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│ Heartbeat: Keep Session Fresh                                   │
└─────────────────────────────────────────────────────────────────┘

[IMMEDIATE] T+400ms (right after registration)
    │
    └─ Send first heartbeat
       ├─ POST /api/bridge/heartbeat
       ├─ Body: { bridgeId, token, status, uptime, requests, errors, roamStatus }
       └─ Backend updates: lastHealthCheckAt = now

[PERIODIC] Every 30 seconds
    │
    ├─ T+30s:  Send heartbeat → Update lastHealthCheckAt
    ├─ T+60s:  Send heartbeat → Update lastHealthCheckAt
    ├─ T+90s:  Send heartbeat → Update lastHealthCheckAt
    └─ T+Inf:  Continue until shutdown
       
[ON ERROR]
    │
    ├─ If 401 (token expired): Log warning, clear token
    ├─ If network error: Log warning, retry next cycle
    └─ If 5xx error: Log warning, retry next cycle
    
    (Desktop Connector continues, session doesn't die)

[ON SHUTDOWN]
    │
    └─ clearInterval() stops heartbeat
       (Session stays in DB with TTL, expires in 30 days)

Purpose:
    └─ Keep session marked CONNECTED
      Allow backend to detect connector is alive
      Update metrics (uptime, requests, errors)
```

---

## 5. Configuration Persistence Format

```json
{
  "version": "1.0.0",
  "bridgeId": "bridge-550e8400-e29b-41d4-a716-446655440000",
  "graphName": "Project_Kinergy",
  "bridgeToken": "tok_abc123def456ghi789jkl012mno345pqr",
  "backendUrl": "http://localhost:3000",
  "port": 7890,
  "endpoint": "http://127.0.0.1:7890",
  "registeredAt": "2026-06-30T18:30:00.000Z",
  "tokenExpiresAt": "2026-07-30T18:30:00.000Z",
  "autoStartEnabled": false
}
```

**File Location:**
- Linux/Mac: `~/.qa-ops-bridge/config.json`
- Windows: `C:\Users\username\.qa-ops-bridge\config.json`

**Operations:**
- **Read:** On startup, check if file exists and token valid
- **Write:** After successful registration
- **Validate:** Check tokenExpiresAt > now before using

---

## 6. Session Resume Behavior

```
┌─────────────────────────────────────────────────────────────────┐
│ Resume: Skip Registration if Token Still Valid                  │
└─────────────────────────────────────────────────────────────────┘

Startup: configManager.load()
    │
    ├─ [1] File exists?
    │  ├─ YES → [2]
    │  └─ NO → REGISTRATION PATH
    │
    ├─ [2] Parse JSON
    │  └─ Get bridgeToken, tokenExpiresAt
    │
    ├─ [3] Token expired?
    │  ├─ YES (expiresAt < now) → REGISTRATION PATH
    │  └─ NO (expiresAt > now) → [4]
    │
    └─ [4] RESUME PATH
       ├─ Use existing bridgeToken
       ├─ Do NOT call POST /api/bridge/register
       └─ No HTTP call needed
          └─ No duplicate BridgeSession created ✓

Result:
    └─ Same session in database
      Heartbeat refreshes lastHealthCheckAt
      No wasted API calls
```

---

## 7. Failure Handling Matrix

| Failure | Behavior | Recovery | Blocks Scenario B |
|---------|----------|----------|-------------------|
| **Backend unavailable** | Log warning, skip registration | Restart DC | ✅ YES |
| **Registration 400** | Log error, skip heartbeat | Check input format, restart | ✅ YES |
| **Registration 409** (duplicate) | Log error, skip heartbeat | Delete config, restart | ✅ YES |
| **Registration 500** | Log error, skip heartbeat | Manual retry when backend up | ✅ YES |
| **Network timeout** | Log error, continue startup | Retry on next startup | ✅ YES |
| **Heartbeat fail** | Log warning, retry automatically | Automatic retry every 30s | ❌ NO |
| **Token expired** | Log warning during heartbeat | Re-register on next startup | ❌ NO (30-day TTL) |
| **DC restart (graceful)** | Resume existing session | Config on disk, no duplicate | ❌ NO (handles well) |
| **DC crash** | Config persists on disk | Resume on restart | ❌ NO (handles well) |

**Legend:**
- ✅ YES = Blocks Scenario B from passing (no BridgeSession created)
- ❌ NO = Doesn't block (session exists or recovers automatically)

---

## 8. Exact Files to Modify

| File | Type | Change | Reason |
|------|------|--------|--------|
| `qa-ops-desktop-connector/src/config/manager.ts` | MODIFY | Replace placeholder, add file I/O | Persistent storage for token |
| `qa-ops-desktop-connector/src/index.ts` | MODIFY | Add registration/resume orchestration | Trigger registration after server starts |
| `qa-ops-desktop-connector/src/server.ts` | MODIFY | Add metrics counters | Track requests & errors for heartbeat |

---

## 9. New Files to Create

| File | Type | Lines | Reason |
|------|------|-------|--------|
| `qa-ops-desktop-connector/src/services/bridge-client.ts` | NEW | ~100 | HTTP client for POST /api/bridge/register |
| `qa-ops-desktop-connector/src/services/heartbeat-service.ts` | NEW | ~120 | Periodic heartbeat sender (every 30s) |

---

## 10. Estimated LOC Per File

| File | Type | Lines | Confidence |
|------|------|-------|------------|
| config/manager.ts | MODIFY | +50 (replace ~30 placeholder) | High |
| index.ts | MODIFY | +40 (after server.start()) | High |
| server.ts | MODIFY | +15 (metrics tracking) | High |
| bridge-client.ts | NEW | ~100 (registration HTTP) | Medium |
| heartbeat-service.ts | NEW | ~120 (heartbeat loop) | Medium |
| **TOTAL** | | **~325 LOC** | **HIGH** |

**Build Impact:**
- TypeScript compilation: ~2 minutes
- Desktop Connector rebuild: ~1 minute
- QA Ops rebuild: ~2 minutes (no changes)
- Test execution (Scenario B): ~5 minutes

---

## 11. Risks & Assumptions

### Assumptions (LOW RISK)
- ✅ `BACKEND_URL` env var is set (default: http://localhost:3000)
- ✅ `PORT` env var is set (default: 7890)
- ✅ Desktop Connector has write access to `~/.qa-ops-bridge/`
- ✅ Bridge startup takes < 5 seconds before health check available
- ✅ Backend registration API already exists and works (VERIFIED ✓)
- ✅ Routing logic already checks for BridgeSession (VERIFIED ✓)

### Risks (MITIGATED)

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Heartbeat never succeeds | Session goes offline in 30s | Log warning, retry auto, manual restart recovers |
| Config file corrupted | Registration fails | Error handling, re-register on next startup |
| Duplicate registrations | Multiple BridgeSessions created | Resume logic reuses token, check for duplicates |
| Token leak (plain text on disk) | Security issue | File permissions 0600, only on local machine |
| Rollback issues | Can't remove registration | Trivial rollback: delete 2 files, revert 3 files |

**Overall Risk Level:** LOW (framework already in place, small scope)

---

## 12. NOT Required for Scenario B (Defer to Later)

### Features to Defer to Milestone 4

1. **Token Refresh** (on heartbeat 401)
   - If token expires, re-register on next startup
   - Not needed for 30-day test
   - Defer: Later milestone

2. **Graceful Token Expiration**
   - Could refresh token at 25-day mark
   - Not needed for Scenario B
   - Defer: Later milestone

3. **Roam Connection Status**
   - Currently hardcoded: `roamStatus: "CONNECTED"`
   - Could query actual Roam status
   - Not needed for routing to work
   - Defer: Later milestone

4. **Metrics Precision**
   - Could track per-minute error rates
   - Currently: errors in last 30 seconds only
   - Not needed for basic heartbeat
   - Defer: Later milestone

5. **Setup Wizard Interactive Mode**
   - Could prompt user for graphName, API token
   - Currently: uses environment or existing config
   - Not needed for Scenario B (config is static)
   - Defer: Milestone 5+

6. **Config Encryption**
   - Currently: plain text token on disk
   - Could encrypt sensitive fields
   - Not needed for local development
   - Defer: Later (security hardening)

7. **Manual Bridge Unregister**
   - Could provide CLI command to clear session
   - Not needed for testing
   - Defer: Later

8. **Multi-Bridge Support**
   - Currently: 1 Desktop Connector per machine
   - Could support multiple bridges
   - Not needed for Scenario B
   - Defer: Later

---

## Minimum Viable Implementation (MVI)

### What's Required for Scenario B to Pass

**Requirement:** QA Ops routes requests through Desktop Connector (shows `_source: "BRIDGE"`)

**MVI Scope:**

```
┌─────────────────────────────────────────────────────────────────┐
│ MINIMUM VIABLE IMPLEMENTATION (MVI)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ✅ REQUIRED:                                                    │
│ ├─ Registration on startup (POST /api/bridge/register)         │
│ ├─ Save bridgeToken to disk                                    │
│ ├─ Resume from disk if token valid                             │
│ ├─ Immediate heartbeat after registration                      │
│ │  (proves session created in database)                         │
│ └─ Feature flag check + routing uses BridgeSession             │
│                                                                 │
│ ❌ NOT REQUIRED for Scenario B:                                │
│ ├─ Periodic heartbeat (one heartbeat is enough to prove)       │
│ ├─ Token refresh logic                                         │
│ ├─ Roam status detection                                       │
│ ├─ Config encryption                                           │
│ ├─ Setup wizard                                                │
│ └─ Advanced metrics                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### MVI Code Changes (Simplified)

| File | Type | Change | Lines | Why MVI |
|------|------|--------|-------|---------|
| config/manager.ts | MODIFY | File I/O only | ~40 | Need persistence |
| index.ts | MODIFY | Register call only | ~30 | Need orchestration |
| bridge-client.ts | NEW | Basic HTTP POST | ~80 | Need registration |
| heartbeat-service.ts | NEW | Send ONE heartbeat | ~60 | Prove session exists |

**MVI Total: ~210 LOC** (vs full: ~325 LOC)

**Simplifications:**
1. No periodic heartbeat loop (just send once)
2. Minimal error handling (log and continue)
3. No token refresh
4. No metrics tracking
5. Hardcoded roamStatus = "CONNECTED"

### MVI Execution Path

```
startup()
    ├─ configManager.load()
    ├─ createServer()
    ├─ server.start()
    ├─ registerBridge() or resumeSession()
    │  └─ Save token to disk
    ├─ Send one heartbeat (POST /api/bridge/heartbeat)
    │  └─ Update session status in database
    └─ ✅ READY
       └─ BridgeSession in database
         QA Ops will route via bridge
```

### Trade-offs (MVI vs Full)

| Aspect | MVI | Full |
|--------|-----|------|
| **Registration** | ✅ Yes | ✅ Yes |
| **Persistence** | ✅ Yes | ✅ Yes |
| **Initial heartbeat** | ✅ Yes | ✅ Yes |
| **Periodic heartbeat** | ❌ No | ✅ Yes |
| **Session keep-alive** | ✅ Via TTL | ✅ Via heartbeat |
| **Production ready** | ⚠️ Limited | ✅ Yes |
| **Scenario B pass** | ✅ Yes | ✅ Yes |
| **LOC** | ~210 | ~325 |
| **Build time** | ~4 min | ~5 min |

**Recommendation:** Start with MVI, add periodic heartbeat in follow-up if needed.

---

## Recommendation

### Proceed with MVI First

**Rationale:**
1. ✅ Sufficient to pass Scenario B (BridgeSession exists, routing works)
2. ✅ Minimal code (~210 LOC vs 325)
3. ✅ Faster implementation (~2 hours vs 3-4 hours)
4. ✅ Easier to review and debug
5. ✅ Session TTL (30 days) is enough for test period
6. ✅ Periodic heartbeat can be added in next milestone
7. ✅ Same rollback safety

### MVI Verification Checklist

```
After MVI implementation:

1. ✅ Desktop Connector starts successfully
2. ✅ Registration completes (no errors)
3. ✅ Config file created: ~/.qa-ops-bridge/config.json
4. ✅ Heartbeat sent once (HTTP POST to backend)
5. ✅ BridgeSession exists in database
   ├─ SELECT * FROM bridgeSession WHERE userId = ?
   └─ Should find 1 record with status=CONNECTED
6. ✅ QA Ops test-connection returns _source: "BRIDGE"
7. ✅ QA Ops search returns _source: "BRIDGE"
8. ✅ QA Ops page fetch returns _source: "BRIDGE"
9. ✅ Manual sync executes and returns _source: "BRIDGE"
10. ✅ No regressions (CLI still works when flag OFF)
```

### Next Steps After MVI Approval

1. **MVI Implementation** (this PR)
   - Registration + one-time heartbeat
   - Scenario B verification

2. **Periodic Heartbeat** (next PR)
   - Add heartbeat loop (every 30s)
   - Keep session fresh

3. **Advanced Features** (later)
   - Token refresh
   - Roam status detection
   - Config encryption
   - Setup wizard

---

## Executive Summary

| Item | Status | Detail |
|------|--------|--------|
| **Root Cause** | ✅ IDENTIFIED | Desktop Connector doesn't register |
| **Fix Scope** | ✅ SMALL | 5 files, ~210-325 LOC (MVI) |
| **Risk** | ✅ LOW | Graceful degradation, easy rollback |
| **Scenario B Viability** | ✅ YES | BridgeSession will exist, routing works |
| **MVI Recommended** | ✅ YES | Sufficient for Scenario B, defer enhancements |
| **Implementation Time** | 2-3 hours | Mostly straightforward, well-scoped |
| **Build + Test Time** | ~15 minutes | DC build + QA Ops build + Scenario B execution |

---

**Ready for approval to proceed with MVI implementation.**
