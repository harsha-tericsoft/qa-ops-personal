# Investigation: Roam Local API Integration
**Date**: 2026-06-12  
**Status**: ❓ UNVERIFIED - Critical gaps in documentation

---

## Executive Summary

The Phase 1A implementation assumes Roam Desktop exposes an HTTP API on `localhost:8000`, but:
- ❌ **NOT VERIFIED**: Roam Desktop actually exposes an HTTP API
- ❌ **NOT VERIFIED**: Correct endpoint structure for Local API
- ❌ **NOT VERIFIED**: Actual authentication mechanism
- ❌ **NOT VERIFIED**: Official Roam documentation source
- ✅ **CONFIRMED**: localhost:8000 endpoint is unreachable (ERR_CONNECTION_REFUSED)

---

## What We Know from Codebase

### 1. Current RoamClient Implementation

**File**: `lib/roam/client.ts`

```typescript
constructor(
  graphName: string,
  apiToken: string,
  apiEndpoint: string = 'http://localhost:8000'
) {
  this.graphName = graphName
  this.apiToken = apiToken
  this.apiEndpoint = apiEndpoint
}

private async queryDatalog(query: string): Promise<unknown> {
  const url = `${this.apiEndpoint}/api/graph/${this.graphName}/q`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
}
```

**What it does**:
- Constructs URL: `http://localhost:8000/api/graph/{graphName}/q`
- Uses Bearer token authentication
- Sends Datalog query in JSON body
- Expects JSON response

---

### 2. ROAM_API_AUDIT.md Documentation

**Found in**: `ROAM_API_AUDIT.md` (internal project documentation)

**Key findings from audit**:

#### Cloud API vs Local API Comparison

| Aspect | Cloud API | Local API | Our Code |
|--------|-----------|-----------|----------|
| **Endpoint** | `https://api.roamresearch.com/api/graph/{graphName}/q` | `http://localhost:PORT/api/q` | `http://localhost:8000/api/graph/{graphName}/q` |
| **Authentication** | Bearer token | "Not Bearer token in same way" | Bearer token |
| **Graph Reference** | Global name in URL | N/A (local only) | Included in URL |
| **Port** | 443 (fixed) | Variable (usually 8000) | 8000 (hardcoded default) |

**Audit conclusion** (p. 372):
> "Current Status: ❌ **LOCAL API NOT SUPPORTED**
> Your Roam Desktop Local API Token **CANNOT** be used with the current implementation."

---

## What We Don't Know

### Critical Unanswered Questions

#### 1. **Does Roam Desktop Expose an HTTP API?**

**Status**: ❓ **NOT VERIFIED**

- The ROAM_API_AUDIT.md *assumes* it does
- No official Roam documentation cited
- No configuration instructions found
- No evidence of setup steps in codebase

**What would confirm this**:
- Official Roam Desktop API documentation
- Roam Desktop settings/preferences showing API server option
- Running Roam Desktop and checking if port 8000 is listening
- Official Roam GitHub/forums mentioning Local API

#### 2. **Correct Endpoint Structure**

**Status**: ❓ **NOT VERIFIED**

ROAM_API_AUDIT.md suggests two different structures:

Option A (p. 140):
```
POST http://localhost:8000/api/q
```

Option B (in our code):
```
POST http://localhost:8000/api/graph/{graphName}/q
```

**Which is correct?** Unknown.

**Evidence needed**:
- Official Roam API specification
- Working code example
- Community documentation

#### 3. **Authentication Mechanism**

**Status**: ❓ **NOT VERIFIED**

- Our code uses: `Authorization: Bearer {token}`
- ROAM_API_AUDIT.md says: "Local API typically doesn't require Bearer auth"
- No header examples provided

**What's the actual mechanism?**
- Is it Bearer token?
- Is it query parameter `?token=`?
- Is it no auth required?
- Is it custom header?

#### 4. **What is a "Local API Token"?**

**Status**: ❓ **NOT DEFINED**

The Phase 1A scope mentions "Local API Token" but:
- No definition provided
- No examples given
- No source cited
- No generation steps documented

**Unclear points**:
- Is it the same as Cloud API token?
- Is it per-graph or global?
- How is it generated in Roam Desktop?
- Where is it found in Roam Desktop UI?

#### 5. **How is the Local API Server Started?**

**Status**: ❓ **NOT DOCUMENTED**

For Cloud API: Manual - you just have a token
For Local API: Unknown whether it:
- Starts automatically with Roam Desktop?
- Requires manual startup?
- Requires configuration/permission?
- Requires specific Roam Desktop version?

---

## Why localhost:8000 Was Chosen

### Evidence from Codebase

**From**: `IMPLEMENTATION_PLAN.md`, `PHASE_1A_SCOPE.md`

```
apiEndpoint: string = 'http://localhost:8000'  // Default
```

**Rationale (inferred, not stated)**:
1. **Port 8000** - Common development server port
   - Standard choice for local HTTP servers
   - Avoids system ports (<1024)
   - Less likely to conflict with common services
   
2. **localhost** - Self-reference (local machine only)
   - Makes sense for Roam Desktop running locally
   - Not accessible remotely
   
3. **HTTP not HTTPS** - Local development
   - HTTPS usually not used for localhost
   - Avoids certificate issues

**What's missing**:
- No documentation of why 8000 specifically
- No link to Roam Desktop API documentation
- No verification that Roam Desktop uses 8000

---

## Test Results

### Actual Behavior

**Test**: Attempt to connect to `http://localhost:8000/api/...`

**Result**: ❌ **ERR_CONNECTION_REFUSED**

```
POST http://localhost:8000/api/graph/TestGraph/q
Status: Connection refused
Message: Cannot reach http://localhost:8000
```

**Interpretation**:
- Either Roam Desktop is not running
- OR Roam Desktop doesn't expose an API on port 8000
- OR the endpoint structure is wrong
- OR the API is on a different port
- **CANNOT DETERMINE** - Need official documentation

---

## API Endpoint Differences

### Our Current Implementation

```
POST http://localhost:8000/api/graph/{graphName}/q
Authorization: Bearer {token}
Content-Type: application/json

{
  "query": "[:find ?e :where [?e :node/title \"roam/db\"]]"
}
```

### ROAM_API_AUDIT.md Alternative (p. 140)

```
POST http://localhost:8000/api/q
Content-Type: application/json

{
  "query": "[:find ?e :where [?e :node/title \"roam/db\"]]"
}
```

### Cloud API (Known Working)

```
POST https://api.roamresearch.com/api/graph/{graphName}/q
Authorization: Bearer {token}
Content-Type: application/json

{
  "query": "[:find ?e :where [?e :node/title \"roam/db\"]]"
}
```

---

## What Needs to Be Verified

### From Official Roam Sources

**Priority 1 - CRITICAL**:
1. ✅ Official Roam Desktop API documentation URL
2. ✅ Confirmation that Roam Desktop exposes an HTTP API
3. ✅ Correct endpoint structure (both URL and query format)
4. ✅ Correct authentication mechanism
5. ✅ Correct port (if not 8000, what is it?)

**Priority 2 - IMPORTANT**:
6. ✅ "Local API Token" - how to obtain it
7. ✅ Local API setup instructions
8. ✅ Minimum Roam Desktop version required
9. ✅ Supported Datalog query syntax
10. ✅ Rate limiting / usage restrictions

**Priority 3 - NICE TO HAVE**:
11. ✅ Error response formats
12. ✅ Response JSON structure
13. ✅ Supported graph types (local only, or also cloud?)
14. ✅ Cross-machine accessibility (or localhost only?)

---

## Conclusion

**⚠️ CRITICAL FINDING**: The Phase 1A implementation is based on assumptions about Roam's Local API that have **NOT been verified against official Roam documentation**.

The implementation:
- ✅ Correctly structures code for conditional endpoints
- ✅ Correctly stores configurable API endpoint
- ✅ Correctly implements Bearer token auth
- ✅ Correctly implements Datalog query format

BUT:
- ❌ **Assumes** Roam Desktop exposes an HTTP API
- ❌ **Assumes** correct endpoint structure
- ❌ **Assumes** Bearer token is the right auth method
- ❌ **Assumes** port 8000 is correct
- ❌ **NOT VERIFIED** by testing or official docs

**Next Steps Required**:
1. **Consult Official Roam Documentation**
   - Search: Roam Desktop API, Local API, Developer Docs
   - Check: Roam GitHub, Roam forums, Roam Discord
   - Link: roamresearch.com/developers or similar

2. **Test Against Running Roam Desktop**
   - If available: attempt actual connection
   - Check: `netstat -tulpn | grep 8000` (or equivalent on Windows)
   - Verify: which ports Roam Desktop listens on

3. **Reverse Engineer from Roam Source**
   - If open source: check Roam Desktop GitHub
   - Look for: API server code, endpoint definitions
   - Extract: actual implementation details

4. **Community Verification**
   - Roam Research Discord
   - Roam Research forums
   - Ask: "How do I use the Local API in Roam Desktop?"

