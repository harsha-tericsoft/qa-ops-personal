# Roam Integration Audit: Cloud API vs Local API

**Audit Date**: 2026-06-11  
**Finding**: ⚠️ **CRITICAL INCOMPATIBILITY** - Implementation is designed for Roam Cloud API ONLY

---

## 1. Is Implementation Designed for Cloud API or Local API?

### ANSWER: **CLOUD API ONLY** ☁️

**Evidence - RoamClient (lib/roam/client.ts, line 16):**

```typescript
export class RoamClient {
  private graphName: string
  private apiKey: string
  private baseUrl = 'https://api.roamresearch.com/api/graph'  // ☁️ CLOUD API
}
```

**The endpoint being used:**
```typescript
// From line 49 in queryDatalog():
const url = `${this.baseUrl}/${this.graphName}/q`

// Actual URL called:
https://api.roamresearch.com/api/graph/PROJECT_KINERGY/q
```

**This is the Roam Cloud API v0 endpoint**, documented at:
- https://roamresearch.com/api/v0 (Cloud API)
- Uses graph name as a parameter (PROJECT_KINERGY)
- Expects global Roam Cloud hosted graphs

---

## 2. Can Local API Token Be Used With Current Implementation?

### ANSWER: **NO - WILL NOT WORK** ❌

### Why It Fails:

**Your Local API Token Setup:**
- 📍 Running on: `http://localhost:8000` (or similar local port)
- 🔐 Authentication: Not Bearer token in same way
- 📊 Database: Local Roam Desktop database (Project_Kinergy)
- 🌐 Scope: Only accessible from your machine

**Current Implementation Limitations:**

| Requirement | Cloud API | Local API | Current Code |
|-------------|-----------|-----------|--------------|
| **Endpoint** | https://api.roamresearch.com/api/graph | http://localhost:PORT/api | ❌ Hard-coded to Cloud |
| **Graph Reference** | Global graph name | Local database name | ✅ Uses name (but wrong endpoint) |
| **Authentication** | Bearer token | Custom auth/no auth | ❌ Only Bearer token |
| **Port** | Fixed (443/https) | Variable (usually 8000) | ❌ Hard-coded https endpoint |
| **Scope** | Requires Roam Cloud account | Roam Desktop local only | ❌ Cloud-only design |

**What Happens When You Try:**

1. Code attempts: `POST https://api.roamresearch.com/api/graph/Project_Kinergy/q`
2. Result: ❌ **404 Not Found** or **401 Unauthorized**
3. Error: "Graph not found" (because Graph doesn't exist on Roam Cloud)

---

## 3. What Changes Are Required?

### Required Changes:

#### A. **Support Multiple API Types**

Add `apiType` field to distinguish:
```typescript
// New schema field needed:
type RoamApiType = 'CLOUD' | 'LOCAL'

// In RoamConfig model (schema.prisma):
apiType    RoamApiType   @default(CLOUD)  // NEW
localPort  Int?          // NEW - for local API (e.g., 8000)
```

#### B. **Conditional URL Construction**

```typescript
// lib/roam/client.ts needs to detect API type:

if (apiType === 'LOCAL') {
  baseUrl = `http://localhost:${localPort}/api`
} else {
  baseUrl = 'https://api.roamresearch.com/api/graph'
}
```

#### C. **Authentication Handling**

```typescript
// Local API might use different auth:
if (apiType === 'LOCAL') {
  // Local API typically doesn't require Bearer auth
  // Or uses different auth mechanism
  headers = { 'Content-Type': 'application/json' }
} else {
  // Cloud API requires Bearer
  headers = {
    'Authorization': `Bearer ${this.apiKey}`,
    'Content-Type': 'application/json',
  }
}
```

#### D. **Update Forms**

- Add dropdown: "API Type: Cloud / Local"
- Conditionally show:
  - Cloud API: Graph URL field + API Key field
  - Local API: Port field + Local Graph Name field

#### E. **Update API Endpoints**

- `/api/roam/test-connection` - detect API type
- `/api/roam/config` - validate based on API type
- Handle different validation per type

---

## 4. What Endpoint Would Be Called Using Local API Token?

### Local API Endpoint Structure:

**Roam Local API (Desktop) uses:**

```
http://localhost:8000/api/...
```

For Datalog queries:
```
POST http://localhost:8000/api/q
Content-Type: application/json

{
  "query": "[:find ?e :where [?e :node/title \"roam/db\"]]"
}
```

**Equivalent to Cloud API but on localhost:**

| API Type | Query Endpoint | Auth |
|----------|---|---|
| **Cloud** | `https://api.roamresearch.com/api/graph/{graphName}/q` | Bearer token |
| **Local** | `http://localhost:{PORT}/api/q` | None (or custom) |

**Key Difference:**
- Cloud: Graph name in URL path
- Local: Graph is implicit (only one database running locally)

---

## 5. Can Application Fetch Live Test Cases From Local Graph?

### ANSWER: **YES - But requires changes above**

**Current limitation:** Code hard-codes Cloud API endpoint

**With Local API support:** ✅ YES

**How it would work:**

```
User's Machine:
┌─────────────────────────────┐
│  Roam Desktop App           │
│  Database: Project_Kinergy  │
│  Local API: localhost:8000  │
└────────────┬────────────────┘
             │
             │ (HTTP to localhost)
             ▼
┌─────────────────────────────┐
│  QA Ops Application         │
│  RoamClient configured for  │
│  Local API mode             │
└────────────┬────────────────┘
             │
             │ Live test cases
             ▼
┌─────────────────────────────┐
│  QA Ops Database            │
│  Repository nodes created   │
└─────────────────────────────┘
```

**Process (same as Cloud, different endpoint):**

1. ✅ Test connection to `http://localhost:8000/api/q`
2. ✅ Execute Datalog query to fetch all pages
3. ✅ Import into Repository table
4. ✅ Create/update test cases
5. ✅ Sync on schedule

---

## 6. Does Application Need Graph URL for Local API Mode?

### ANSWER: **NO - Not in current form**

**For Cloud API:** ✅ NEEDED
```
URL: https://roamresearch.com/#/app/PROJECT_KINERGY
Extracted: PROJECT_KINERGY (graph name)
```

**For Local API:** ❌ NOT NEEDED

Because:
- Local API is always `http://localhost:{PORT}`
- Graph name is not needed (only one database)
- Just need port number (e.g., 8000)

**What you'd need instead for Local API:**

| Field | Cloud API | Local API |
|-------|-----------|-----------|
| Graph URL | ✅ https://roamresearch.com/#/app/... | ❌ Not used |
| Graph Name | ✅ Extracted from URL | ✅ Still useful (for display) |
| API Key | ✅ Bearer token required | ❌ Usually not needed |
| Port | ❌ Not applicable | ✅ localhost:PORT |
| Local Path | ❌ Not applicable | ✅ Optional (if needed) |

**Better form for Local API:**

```
API Type: ○ Cloud  ● Local

[Local API Configuration]
Graph Name: [Project_Kinergy______]  (for display/logging)
Local Port: [8000__]                 (default: 8000)
API Key:    [____________]           (optional, if local API requires auth)
```

---

## 7. Should Local API and Cloud API Be Separate Connection Types?

### ANSWER: **YES - STRONGLY RECOMMENDED** ✅

### Why Separate Types:

| Aspect | Cloud API | Local API | Unified? |
|--------|-----------|-----------|----------|
| **Endpoint URL** | https://api... | http://localhost... | ❌ Different |
| **Graph Reference** | Graph name required in URL | Not in URL | ❌ Different |
| **Authentication** | Bearer token mandatory | Optional/different | ❌ Different |
| **Port** | Fixed 443 | Variable | ❌ Different |
| **Scope** | Requires Roam Cloud | Requires Roam Desktop | ❌ Different |
| **Availability** | 24/7 cloud | Only when Desktop app running | ❌ Different |
| **Datalog Query** | Same Datalog syntax | Same Datalog syntax | ✅ Same |

### Recommended Implementation:

**Option A: Separate Models (RECOMMENDED)**

```prisma
model RoamCloudConfig {
  id          String @id @default(cuid())
  projectId   String @unique
  graphName   String
  graphUrl    String
  apiKey      String
  syncEnabled Boolean @default(false)
  // ... other fields
}

model RoamLocalConfig {
  id          String @id @default(cuid())
  projectId   String @unique
  graphName   String           // Optional, for display
  localPort   Int @default(8000)
  apiKey      String?          // Optional if local API needs auth
  syncEnabled Boolean @default(false)
  // ... other fields
}
```

**Option B: Single Model with Type (FLEXIBLE)**

```prisma
model RoamConfig {
  id          String @id @default(cuid())
  projectId   String @unique
  apiType     String  // "CLOUD" | "LOCAL"
  graphName   String
  graphUrl    String?         // Only for Cloud
  localPort   Int?            // Only for Local
  apiKey      String
  syncEnabled Boolean @default(false)
  // ... validation must check based on apiType
}
```

### UI Implementation:

```
[Select API Type]
┌─────────────────────────────────────┐
│ ○ Roam Cloud API                   │
│   - Requires graph URL              │
│   - Requires API Key (Bearer token) │
│   - Graph must be on Roam Cloud     │
│                                     │
│ ● Roam Local Desktop API           │
│   - Requires local Roam Desktop    │
│   - Local port (default 8000)      │
│   - Optional API key               │
└─────────────────────────────────────┘

[Show appropriate form fields based on selection]
```

---

## Current Implementation Summary

| Component | Current State | Status |
|-----------|---------------|--------|
| **RoamClient** | Hard-coded Cloud API endpoint | ❌ Not compatible |
| **baseUrl** | `https://api.roamresearch.com/api/graph` | ❌ Cloud only |
| **Authentication** | Bearer token only | ❌ Local doesn't support |
| **Graph Reference** | Via URL extraction + name param | ⚠️ Works for Cloud, not Local |
| **Config Storage** | Single RoamConfig model | ⚠️ Needs API type field |
| **Forms** | Cloud API focused | ❌ No Local API option |
| **Test Connection** | Tests Cloud endpoint only | ❌ Fails on Local |
| **Validation Regex** | `/\/app\/([a-z0-9-]+)$/i` | ❌ Only for Cloud URLs |

---

## What Needs to Happen for Local API Support

### Phase 1: Core Changes
1. ✏️ Add `apiType` field to RoamConfig
2. ✏️ Add `localPort` field to RoamConfig
3. 🔧 Modify RoamClient to support both endpoints
4. 🔧 Conditional authentication handling

### Phase 2: Form Updates
1. 🎨 Add API type selector (Cloud/Local)
2. 🎨 Conditional form fields
3. 🎨 Different validation per type

### Phase 3: Validation Updates
1. 🔍 Different regex for URL vs port validation
2. 🔍 Different error messages
3. 🔍 Connection test for both types

### Phase 4: Documentation
1. 📖 Add Local API setup instructions
2. 📖 Add Local API troubleshooting
3. 📖 Explain API type selection

---

## Conclusion

**Current Status:** ❌ **LOCAL API NOT SUPPORTED**

Your Roam Desktop Local API Token **CANNOT** be used with the current implementation.

The application is exclusively designed for Roam Cloud API which:
- Requires a Roam Cloud account
- Uses `https://api.roamresearch.com/api/graph/{graphName}/q` endpoint
- Authenticates with Bearer token
- Requires globally accessible Roam graphs

To use your Local API Token, the code requires significant changes to support a separate Local API configuration type with different endpoints, authentication, and validation.

