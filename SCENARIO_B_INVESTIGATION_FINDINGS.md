# Scenario B Blocker: Investigation & Analysis

**Date:** June 30, 2026  
**Status:** ✅ **INVESTIGATION COMPLETE**  
**Blocker:** No bridge session registered (routing correctly refuses bridge usage)

---

## Executive Summary

Scenario B is blocked because **QA Ops is NOT routing requests through the Desktop Connector**, even though:
- ✅ Feature flag is enabled (`ENABLE_BRIDGE_ROUTING=true`)
- ✅ Desktop Connector is running and healthy
- ✅ Bridge routing logic is correctly implemented
- ✅ CLI fallback is working safely

**Root Cause:** The Desktop Connector **never registers a BridgeSession** with QA Ops during startup.

The routing layer correctly refuses to use the bridge because no valid session exists in the database. This is safe behavior, not a bug.

---

## Investigation Questions & Answers

### 1. How is a BridgeSession supposed to be created?

**Answer:** Via the **Backend API Registration Endpoint** (`POST /api/bridge/register`)

The backend creates both `BridgeToken` and `BridgeSession` together:

```
POST /api/bridge/register
├─ Input: bridgeId, graphName, version, os, hostname
├─ Backend creates BridgeToken
├─ Backend creates BridgeSession (with status=CONNECTED)
└─ Returns: bridgeToken, expiresAt, webhookUrl
```

**Implementation Location:** `app/api/bridge/register/route.ts` (lines 105-151)

```typescript
// Create bridge token
const tokenResult = await createBridgeToken(userId, body.bridgeId, body.graphName)

// Create bridge session
await prisma.bridgeSession.create({
  data: {
    userId,
    bridgeTokenId: bridgeToken.id,
    endpoint: 'http://localhost:7890',
    status: BridgeSessionStatusEnum.CONNECTED,
    expiresAt: tokenResult.expiresAt,
  },
})
```

---

### 2. Which API is responsible for registration?

**Answer:** The **QA Ops Backend** at `POST /api/bridge/register`

**Endpoint Details:**
- **URL:** `http://localhost:3000/api/bridge/register`
- **Method:** POST
- **Required Fields:**
  - `bridgeId`: UUID format (e.g., `bridge-550e8400-e29b-41d4-a716-446655440000`)
  - `graphName`: Roam graph name (e.g., `Project_Kinergy`)
  - `version`: Connector version (e.g., `1.0.0`)
- **Optional Fields:**
  - `os`: Operating system
  - `hostname`: Machine hostname

**Response:**
```json
{
  "success": true,
  "bridgeToken": "tok_...",
  "expiresAt": "2026-07-30T...",
  "webhookUrl": "http://localhost:3000/api/bridge/heartbeat",
  "graphName": "Project_Kinergy"
}
```

**Implementation File:** `app/api/bridge/register/route.ts`

---

### 3. What component should call that API?

**Answer:** The **Desktop Connector** should call the registration API during startup.

**Current Startup Flow:**
```
Desktop Connector (index.ts) 
├─ startup() called
├─ configManager.load() - tries to read existing config
├─ createServer() - Express server created
├─ server.start() - starts listening on port 7890
└─ ✅ DONE (no registration happens here)
```

**Expected Startup Flow (for Scenario B to work):**
```
Desktop Connector (index.ts)
├─ startup() called
├─ configManager.load() - read existing config or generate bridgeId
├─ registerWithBackend() 
│  └─ POST /api/bridge/register 
│     ├─ Send: bridgeId, graphName, version
│     └─ Receive: bridgeToken, webhookUrl
├─ configManager.save() - store bridgeToken
├─ createServer() - Express server created
├─ server.start() - start listening
└─ startHeartbeat() - send periodic updates to webhookUrl
```

**Missing Component:** The registration logic needs to be added to Desktop Connector startup sequence.

---

### 4. Is registration currently missing?

**Answer:** ✅ **YES - Registration is completely missing from Desktop Connector**

**Evidence:**

1. **Setup module is a placeholder** (`qa-ops-desktop-connector/src/cli/setup.ts`, lines 17-25):
```typescript
logger.info('Setup wizard framework is ready for Milestone 2')
logger.info('')
logger.info('In Milestone 2, this will:')
logger.info('  1. Prompt for Roam graph name')
logger.info('  2. Prompt for API token')
logger.info('  3. Prompt for bridge port (default 7890)')
logger.info('  4. Prompt for backend URL')
logger.info('  5. Register with backend')  // ← Planned but not implemented
logger.info('  6. Save configuration')
```

2. **Config manager is a framework** (`qa-ops-desktop-connector/src/config/manager.ts`, lines 40-43):
```typescript
load(): ConnectorConfig | null {
  try {
    logger.info(`Loading config from ${this.configPath}`)
    // In Milestone 1, we're just setting up the framework
    // Actual file I/O will be implemented in future milestones
    this.config = null
    return this.config
```

3. **No registration call in startup** (`qa-ops-desktop-connector/src/index.ts`, lines 38-40):
```typescript
// Create and start server
server = createServer({ port, host, env })
await server.start()
// ← Server starts, but NO registration happens
```

---

### 5. Is registration implemented but never executed?

**Answer:** ✅ **PARTIAL - Backend API is implemented, Desktop Connector doesn't call it**

**Backend Registration API:** ✅ **Fully Implemented**
- Location: `app/api/bridge/register/route.ts`
- Creates BridgeToken and BridgeSession
- Validates input parameters
- Handles errors correctly
- Ready to use

**Desktop Connector Registration:** ❌ **NOT Implemented**
- No HTTP client for registration
- No call to POST /api/bridge/register
- No handling of registration response
- No token storage logic
- No heartbeat implementation

---

### 6. Is there a configuration issue?

**Answer:** ✅ **NO - Configuration is not the problem**

**What works:**
- ✅ Backend URL can be configured via `BACKEND_URL` env var
- ✅ Bridge port can be configured via `PORT` env var
- ✅ Bridge endpoint is correctly read by routing layer

**What's not the issue:**
- Feature flag is working correctly
- Routing logic is correct
- Bridge endpoint is accessible

**The problem is purely missing code** - the Desktop Connector was never taught how to register itself.

---

### 7. Is there a bug in the routing logic?

**Answer:** ✅ **NO - Routing logic is correct and safe**

**Verification:**

1. **Feature flag check works** (lib/bridge/routing.ts, lines 50-57):
```typescript
if (!featureFlagEnabled) {
  logRoutingStep('Feature flag disabled', 'SKIP')
  return {
    useBridge: false,
    reason: 'Feature flag disabled - using CLI',
  }
}
```

2. **Session search works** (lib/bridge/routing.ts, lines 62-79):
```typescript
const session = await prisma.bridgeSession.findFirst({
  where: {
    userId,
    expiresAt: { gt: new Date() },
  },
  include: {
    bridgeToken: true,
  },
})

if (!session) {
  logRoutingStep('No bridge session found for user', 'FALLBACK')
  return {
    useBridge: false,
    reason: 'No bridge session found - using CLI',
  }
}
```

3. **Fallback is working correctly**
- When no session exists → correctly uses CLI
- When session is offline → correctly uses CLI
- When token expired → correctly uses CLI

**The routing logic is safe and correct.**

---

### 8. Expected Registration Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Desktop Connector Startup (index.ts)                         │
├─────────────────────────────────────────────────────────────┤
│ ✅ Load or generate bridgeId                                 │
│ ✅ Get graphName from config                                 │
│ ✅ Prepare registration payload                              │
│ ├─ bridgeId: "bridge-550e8400..."                            │
│ ├─ graphName: "Project_Kinergy"                              │
│ ├─ version: "1.0.0"                                          │
│ └─ os: "win32", hostname: "harsha-laptop"                    │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│ HTTP POST /api/bridge/register                              │
│ Host: localhost:3000                                         │
│ Authorization: Bearer user_token (or app token)              │
├─────────────────────────────────────────────────────────────┤
│ Body:                                                        │
│ {                                                            │
│   "bridgeId": "bridge-550e8400...",                          │
│   "graphName": "Project_Kinergy",                            │
│   "version": "1.0.0",                                        │
│   "os": "win32",                                             │
│   "hostname": "harsha-laptop"                                │
│ }                                                            │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│ QA Ops Backend Processing                                    │
├─────────────────────────────────────────────────────────────┤
│ 1. Validate input parameters                                │
│ 2. Extract userId from auth header                          │
│ 3. Check if bridge already registered                       │
│ 4. Create BridgeToken                                       │
│    ├─ token: generated JWT or random                        │
│    ├─ status: ACTIVE                                        │
│    └─ expiresAt: 30 days from now                           │
│ 5. Create BridgeSession                                     │
│    ├─ userId: from auth                                     │
│    ├─ bridgeTokenId: linking to token                       │
│    ├─ endpoint: "http://localhost:7890"                     │
│    ├─ status: CONNECTED                                     │
│    └─ expiresAt: same as token                              │
│ 6. Prepare response                                         │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│ HTTP 200 OK Response                                         │
├─────────────────────────────────────────────────────────────┤
│ {                                                            │
│   "success": true,                                           │
│   "bridgeToken": "tok_abc123...",                            │
│   "expiresAt": "2026-07-30T18:30:00.000Z",                   │
│   "webhookUrl": "http://localhost:3000/api/bridge/heartbeat",│
│   "graphName": "Project_Kinergy"                             │
│ }                                                            │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│ Desktop Connector Receipt                                    │
├─────────────────────────────────────────────────────────────┤
│ ✅ Extract bridgeToken from response                         │
│ ✅ Extract webhookUrl from response                          │
│ ✅ Save to config: configManager.save({                      │
│    bridgeToken: "tok_abc123...",                             │
│    tokenExpiresAt: "2026-07-30T18:30:00.000Z",               │
│    backendUrl: "http://localhost:3000"                       │
│   })                                                         │
│ ✅ Start heartbeat timer                                     │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│ Periodic Heartbeat (every 30 seconds)                        │
├─────────────────────────────────────────────────────────────┤
│ POST /api/bridge/heartbeat                                   │
│ {                                                            │
│   "bridgeId": "bridge-550e8400...",                          │
│   "status": "CONNECTED",                                     │
│   "uptime": 125,                                             │
│   "requestsProcessed": 42,                                   │
│   "errorsInLast30s": 0,                                      │
│   "roamStatus": "CONNECTED"                                  │
│ }                                                            │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│ Bridge Ready for QA Ops                                      │
├─────────────────────────────────────────────────────────────┤
│ Database state:                                              │
│ BridgeToken: {                                               │
│   id: "token_123",                                           │
│   userId: "user_placeholder",                                │
│   bridgeId: "bridge-550e8400...",                            │
│   token: "tok_abc123...",                                    │
│   status: "ACTIVE",                                          │
│   expiresAt: "2026-07-30T18:30:00.000Z"                      │
│ }                                                            │
│                                                              │
│ BridgeSession: {                                             │
│   id: "session_456",                                         │
│   userId: "user_placeholder",                                │
│   bridgeTokenId: "token_123",                                │
│   endpoint: "http://localhost:7890",                         │
│   status: "CONNECTED",                                       │
│   expiresAt: "2026-07-30T18:30:00.000Z"                      │
│ }                                                            │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│ Next QA Ops Request (Test Connection, Search, etc.)         │
├─────────────────────────────────────────────────────────────┤
│ 1. Check feature flag: ✅ ENABLED                            │
│ 2. Search for bridge session: ✅ FOUND                       │
│ 3. Validate session status: ✅ CONNECTED                     │
│ 4. Check token status: ✅ ACTIVE & not expired              │
│ 5. BRIDGE WILL BE USED ✅                                   │
│ 6. HTTP POST to http://localhost:7890/api/roam/test-connection
│ 7. Desktop Connector processes request via Roam CLI          │
│ 8. Response includes: _source: "BRIDGE"                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary of Findings

| Question | Answer | Evidence |
|----------|--------|----------|
| How is BridgeSession created? | Via POST /api/bridge/register | app/api/bridge/register/route.ts |
| Which API is responsible? | QA Ops backend | Backend implementation exists |
| What should call it? | Desktop Connector | Setup.ts says "for Milestone 2" |
| Is registration missing? | YES | Desktop Connector never calls API |
| Is it implemented but not called? | YES (partially) | Backend API implemented, DC doesn't call |
| Configuration issue? | NO | All configs work correctly |
| Bug in routing logic? | NO | Routing is correct and safe |
| Expected flow? | See detailed diagram | Registration → Session → Bridge use |

---

## Why Scenario B is Blocked

**The error message** "No bridge session has been registered" is **correct and expected**.

**Sequence of Events:**

1. Desktop Connector starts ✅
2. No registration code in Desktop Connector
3. BridgeSession NOT created in database
4. QA Ops receives request with `ENABLE_BRIDGE_ROUTING=true`
5. Routing checks database for BridgeSession
6. No session found → CLI fallback ✅ (safe)
7. Request processes via CLI
8. Response shows `_source: "CLI"` (not BRIDGE)
9. **Scenario B requirement NOT met:** QA Ops should route via Bridge

---

## Fix Required

**Missing Implementation:** Desktop Connector bridge registration during startup

**Scope:** Add registration flow to Desktop Connector (NOT QA Ops backend - that's already done)

**Components to implement:**
1. HTTP client for registration
2. Call to POST /api/bridge/register during startup
3. Extract and save bridgeToken
4. Start heartbeat timer
5. Handle registration errors gracefully

---

## Impact Assessment

- ✅ QA Ops routing logic: Working correctly
- ✅ Backend registration API: Fully implemented
- ✅ Desktop Connector health: Running and accessible
- ❌ Desktop Connector registration: Missing
- ❌ Bridge session creation: Not happening
- ❌ Scenario B verification: Blocked on this

**Effort:** This is a straightforward implementation - add registration flow to Desktop Connector startup.

**Risk:** LOW - This is new code, doesn't modify existing working code.

---

**Status:** Investigation complete. Ready for implementation.
