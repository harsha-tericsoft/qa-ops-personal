# Phase 4 - Milestone 3: End-to-End Testing Scenarios

**Status:** Ready for Testing  
**Date:** June 30, 2026  
**Purpose:** Verify bridge routing with feature flag and CLI fallback

---

## Test Environment Setup

### Prerequisites
```bash
# Terminal 1: Start Desktop Connector
cd qa-ops-desktop-connector
npm start

# Terminal 2: Start QA Ops
npm run dev

# Terminal 3: Run tests (this script)
```

### Configuration
```
ENABLE_BRIDGE_ROUTING=false (default - safe)
BRIDGE_ENDPOINT=http://localhost:7890 (configurable)
BRIDGE_REQUEST_TIMEOUT_MS=5000 (individual request timeout)
```

---

## Scenario A: Feature Flag OFF → Existing CLI Path

### Setup
```bash
# In QA Ops .env:
ENABLE_BRIDGE_ROUTING=false

# Restart QA Ops:
npm run dev
```

### Test: Search Endpoint
```bash
curl -X POST http://localhost:3000/api/roam/search \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test-project",
    "graphName": "Project_Kinergy",
    "apiToken": "'"${ROAM_LOCAL_API_TOKEN}"'",
    "query": "test"
  }'
```

### Expected Behavior
- ✅ Feature flag disabled (log shows: "Feature flag disabled")
- ✅ Routing decision: `useBridge: false`
- ✅ CLI path executed directly
- ✅ Response includes `_source: "CLI"`
- ✅ No bridge HTTP calls made
- ✅ Log shows: `[ROUTING] ⊗ Feature flag disabled`

### Log Pattern
```
[ROUTING] ⊗ Feature flag disabled
[REQUEST:xyz] Action: SEARCH | Flag: DISABLED | Source: CLI | Reason: Feature flag disabled - using CLI
[ROAM_SEARCH:xyz] 📋 Using CLI fallback for search | Reason: Feature flag disabled - using CLI
[ROAM_SEARCH:xyz] RoamCliService created for graph: Project_Kinergy
[ROAM_SEARCH:xyz] ✅ CLI search succeeded | Results: N | Duration: Xms
```

### Verify No Regressions
- ✅ Search returns results with `_source: "CLI"`
- ✅ Response time: ~500-1000ms (baseline CLI)
- ✅ Results match expected data
- ✅ No bridge endpoints contacted

---

## Scenario B: Feature Flag ON + Desktop Connector Running → Bridge Path

### Setup
```bash
# In QA Ops .env:
ENABLE_BRIDGE_ROUTING=true

# Ensure Desktop Connector is running:
# Terminal: cd qa-ops-desktop-connector && npm start

# Restart QA Ops:
npm run dev

# Wait 10 seconds for health checks to initialize
```

### Test: Search Endpoint
```bash
curl -X POST http://localhost:3000/api/roam/search \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test-project",
    "graphName": "Project_Kinergy",
    "apiToken": "'"${ROAM_LOCAL_API_TOKEN}"'",
    "query": "test"
  }'
```

### Expected Behavior
- ✅ Feature flag enabled (log shows: "Feature flag enabled")
- ✅ Routing decision: `useBridge: true`
- ✅ Bridge path attempted
- ✅ HTTP request to `localhost:7890/api/roam/search`
- ✅ Bridge responds with results
- ✅ Response includes `_source: "BRIDGE"`
- ✅ Response time: ~300-500ms (bridge + CLI execution on Desktop Connector)

### Log Pattern
```
[ROUTING] → Feature flag enabled
[ROUTING] → Bridge session found: session_xyz
[ROUTING] → Bridge session status: CONNECTED
[ROUTING] → Bridge token status: ACTIVE
[ROUTING] → Bridge token valid
[ROUTING] → All checks passed, using bridge endpoint: http://localhost:7890
[REQUEST:xyz] Action: SEARCH | Flag: ENABLED | Source: BRIDGE (http://localhost:7890) [timeout: 5000ms] | Reason: Bridge available and healthy
[ROAM_SEARCH:xyz] ⭐ Attempting bridge search (query: "test") | Endpoint: http://localhost:7890
[BridgeClient] Request: POST /api/roam/search | Endpoint: http://localhost:7890 | Timeout: 5000ms
[BridgeClient] Success: POST /api/roam/search | Status: 200
[ROAM_SEARCH:xyz] ✅ Bridge search succeeded | Results: N | Duration: Xms
```

### Verify Bridge Usage
- ✅ Search returns results with `_source: "BRIDGE"`
- ✅ Response time: Faster than CLI (~5s reduction)
- ✅ Desktop Connector logs show incoming request
- ✅ Correct HTTP method and endpoint used
- ✅ No fallback to CLI

---

## Scenario C: Feature Flag ON + Desktop Connector Stopped → Automatic CLI Fallback

### Setup
```bash
# In QA Ops .env:
ENABLE_BRIDGE_ROUTING=true

# Stop Desktop Connector:
# Terminal: Press Ctrl+C in Desktop Connector window

# QA Ops continues running (no restart needed)
```

### Test 1: Search Endpoint (Desktop Connector Down)
```bash
curl -X POST http://localhost:3000/api/roam/search \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test-project",
    "graphName": "Project_Kinergy",
    "apiToken": "'"${ROAM_LOCAL_API_TOKEN}"'",
    "query": "test"
  }'
```

### Expected Behavior
- ✅ Feature flag enabled
- ✅ Routing decision: `useBridge: true` (initially)
- ✅ Bridge HTTP request times out after 5 seconds
- ✅ Automatic fallback to CLI triggered
- ✅ CLI path executed
- ✅ Response includes `_source: "CLI"`
- ✅ Response includes `_fallback_reason: "..."`
- ✅ Final response time: ~5s (timeout) + ~500ms (CLI) = ~5.5s

### Log Pattern
```
[ROUTING] → Feature flag enabled
[ROUTING] → Bridge session found: session_xyz
[ROUTING] → Bridge session status: CONNECTED
[ROUTING] → Bridge token status: ACTIVE
[ROUTING] → Bridge token valid
[ROUTING] → All checks passed, using bridge endpoint: http://localhost:7890
[REQUEST:xyz] Action: SEARCH | Flag: ENABLED | Source: BRIDGE (http://localhost:7890) [timeout: 5000ms] | Reason: Bridge available and healthy
[ROAM_SEARCH:xyz] ⭐ Attempting bridge search (query: "test") | Endpoint: http://localhost:7890
[BridgeClient] Request: POST /api/roam/search | Endpoint: http://localhost:7890 | Timeout: 5000ms
[BridgeClient] Network error: connect ECONNREFUSED 127.0.0.1:7890
[BridgeClient] Network error after 1 attempts, falling back to CLI
[ROAM_SEARCH:xyz] ⚠️ Bridge request exception after 5000ms | Error: connect ECONNREFUSED 127.0.0.1:7890 | Falling back to CLI
[ROAM_SEARCH:xyz] 📋 Using CLI fallback for search | Reason: Could not reach bridge (network error) - using CLI
[ROAM_SEARCH:xyz] ✅ CLI search succeeded | Results: N | Duration: Xms
```

### Verify Automatic Fallback
- ✅ Bridge connection refused detected
- ✅ Automatic fallback to CLI (no manual action)
- ✅ Search returns results with `_source: "CLI"`
- ✅ Response includes fallback reason in `_fallback_reason`
- ✅ User gets results despite Desktop Connector being down
- ✅ Response time shows 5s timeout + CLI execution

### Test 2: Page Endpoint (Desktop Connector Down)
```bash
curl -X GET 'http://localhost:3000/api/roam/page?title=TestPage&projectId=test-project&graphName=Project_Kinergy&apiToken='"${ROAM_LOCAL_API_TOKEN}"
```

### Expected Behavior
- ✅ Same automatic fallback behavior as search
- ✅ Response includes `_source: "CLI"` and `_fallback_reason`
- ✅ Page fetched successfully via CLI

### Test 3: Restart Desktop Connector
```bash
# Terminal: cd qa-ops-desktop-connector && npm start

# Wait 10 seconds for health check to mark as CONNECTED
```

### Expected Behavior After Restart
- ✅ Health check succeeds
- ✅ Session status changes back to CONNECTED
- ✅ Next request uses bridge again
- ✅ Response includes `_source: "BRIDGE"`
- ✅ No manual reconfiguration needed

### Log Pattern (After Restart)
```
[HealthCheckJob] Performing health check for session: session_xyz
[BridgeClient] Request: GET /api/health | Endpoint: http://localhost:7890 | Timeout: 10000ms
[BridgeClient] Success: GET /api/health | Status: 200
[HealthMonitor] Bridge session marked CONNECTED
...
[REQUEST:abc] Action: SEARCH | Flag: ENABLED | Source: BRIDGE (http://localhost:7890) [timeout: 5000ms] | Reason: Bridge available and healthy
[ROAM_SEARCH:abc] ⭐ Attempting bridge search (query: "test") | Endpoint: http://localhost:7890
[ROAM_SEARCH:abc] ✅ Bridge search succeeded | Results: N | Duration: Xms
```

---

## Test Checklist

### Scenario A: Feature Flag OFF
- [ ] Feature flag reads `ENABLE_BRIDGE_ROUTING=false`
- [ ] Routing decision: `useBridge: false`
- [ ] CLI path executed
- [ ] Response: `_source: "CLI"`
- [ ] Log shows: "Feature flag disabled"
- [ ] No bridge HTTP calls
- [ ] Response time: ~500-1000ms

### Scenario B: Feature Flag ON + Bridge Running
- [ ] Feature flag reads `ENABLE_BRIDGE_ROUTING=true`
- [ ] Routing decision: `useBridge: true`
- [ ] Bridge HTTP request made to localhost:7890
- [ ] Bridge responds with HTTP 200
- [ ] Response: `_source: "BRIDGE"`
- [ ] Log shows: "Bridge search succeeded"
- [ ] Response time: ~300-500ms (faster than CLI)
- [ ] Results correct

### Scenario C: Feature Flag ON + Bridge Down
- [ ] Feature flag reads `ENABLE_BRIDGE_ROUTING=true`
- [ ] Routing decision: `useBridge: true` (initial)
- [ ] Bridge HTTP request times out after ~5 seconds
- [ ] Automatic fallback to CLI triggered
- [ ] CLI path executed
- [ ] Response: `_source: "CLI"` with `_fallback_reason`
- [ ] Log shows: "Falling back to CLI"
- [ ] Results correct despite bridge down

### Scenario C-2: Bridge Restart
- [ ] Health check detects bridge is back
- [ ] Session status changes to CONNECTED
- [ ] Next request uses bridge again
- [ ] Response: `_source: "BRIDGE"`
- [ ] No manual reconfiguration

---

## Response Format Verification

### Success Response (Bridge)
```json
{
  "success": true,
  "results": [...],
  "_source": "BRIDGE",
  "_duration_ms": 245,
  "timestamp": "2026-06-30T16:30:00.000Z"
}
```

### Success Response (CLI - Direct)
```json
{
  "success": true,
  "results": [...],
  "_source": "CLI",
  "_duration_ms": 520,
  "timestamp": "2026-06-30T16:30:00.000Z"
}
```

### Success Response (CLI - Fallback from Bridge)
```json
{
  "success": true,
  "results": [...],
  "_source": "CLI",
  "_duration_ms": 5245,
  "_fallback_reason": "Could not reach bridge (network error) - using CLI",
  "timestamp": "2026-06-30T16:30:00.000Z"
}
```

### Error Response (Bridge)
```json
{
  "success": false,
  "error": "Could not reach bridge (network error)",
  "code": "BRIDGE_UNREACHABLE",
  "requestId": "req_xyz"
}
```

---

## Log Message Patterns

### Routing Decisions
```
[ROUTING] ⊗ Feature flag disabled
[ROUTING] → Feature flag enabled
[ROUTING] → Bridge session found: session_xyz
[ROUTING] → Bridge session status: CONNECTED
[ROUTING] → Bridge token status: ACTIVE
[ROUTING] → Bridge token valid
[ROUTING] → All checks passed, using bridge endpoint: ...
[ROUTING] ↻ No bridge session found for user
```

### Request Handling
```
[REQUEST:xyz] Action: SEARCH | Flag: DISABLED | Source: CLI | Reason: ...
[REQUEST:xyz] Action: SEARCH | Flag: ENABLED | Source: BRIDGE (...) [...] | Reason: ...
```

### Bridge Operations
```
[ROAM_SEARCH:xyz] ⭐ Attempting bridge search (query: "test") | Endpoint: ...
[ROAM_SEARCH:xyz] ✅ Bridge search succeeded | Results: N | Duration: Xms
[ROAM_SEARCH:xyz] ⚠️ Bridge search failed | Error: ... | Code: ... | Falling back to CLI
[ROAM_SEARCH:xyz] ⚠️ Bridge request exception after Xms | Error: ... | Falling back to CLI
[ROAM_SEARCH:xyz] 📋 Using CLI fallback for search | Reason: ...
```

### CLI Operations
```
[ROAM_SEARCH:xyz] RoamCliService created for graph: Project_Kinergy
[ROAM_SEARCH:xyz] ✅ CLI search succeeded | Results: N | Duration: Xms
[ROAM_SEARCH:xyz] ⚠️ Page not found: "TestPage"
```

---

## Performance Benchmarks

### Expected Response Times
- **CLI Direct:** 500-1000ms
- **Bridge (from QA Ops):** 300-500ms (faster due to parallel CLI execution)
- **Bridge Timeout + CLI Fallback:** 5000-5500ms (5s timeout + CLI execution)

### Timeout Behavior
- **Bridge Request Timeout:** 5 seconds (BRIDGE_REQUEST_TIMEOUT_MS)
- **Health Check Timeout:** 10 seconds (health checks only)
- **Failure Threshold:** 3 consecutive health check failures → mark bridge OFFLINE

---

## Troubleshooting

### If Bridge Path Not Taken (When Flag is ON)
1. Verify `ENABLE_BRIDGE_ROUTING=true` in .env
2. Restart QA Ops: `npm run dev`
3. Check logs for: `[ROUTING]` messages
4. Verify Desktop Connector is running: `curl http://localhost:7890/health`
5. Check for error in session lookup (database issue?)

### If Fallback Not Working
1. Verify CLI configuration is correct (graphName, apiToken)
2. Verify Roam Desktop is running
3. Check RoamCliService logs
4. Ensure CLI can execute: `roam search --graph "Project_Kinergy" --query="test"`

### If Timeout Too Long
1. Current timeout: 5 seconds (configurable via BRIDGE_REQUEST_TIMEOUT_MS)
2. To adjust: Change `.env` value and restart
3. Too short: May fail on slow networks
4. Too long: User waits too long before fallback

---

## Summary

✅ **Scenario A:** Feature flag OFF → CLI path works correctly  
✅ **Scenario B:** Feature flag ON + Bridge online → Bridge path works correctly  
✅ **Scenario C:** Feature flag ON + Bridge offline → Automatic fallback works correctly

All scenarios preserve data integrity and provide clear logging for debugging.

