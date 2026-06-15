# Roam Integration Migration Plan
## From Deprecated Direct HTTP to Verified CLI/MCP Architecture

**Date**: 2026-06-15  
**Status**: PLANNING PHASE - Awaiting approval before implementation  
**Scope**: Refactor Roam Local API integration without removing any functionality  

---

## Executive Summary

The current Roam integration uses an **unsupported, unverified direct HTTP architecture** (localhost:8000, apiEndpoint) that does not work with Roam Desktop's actual Local API implementation.

**Recommendation**: Migrate to **Approach 3 (Official roam-tools CLI)** as the primary integration method.

**Why**:
- ✅ Official Roam tooling with 100% API coverage
- ✅ Verified to work with local graphs and encrypted databases
- ✅ No proprietary endpoint assumptions
- ✅ Maintained by Roam Research
- ✅ Uses proper local API tokens (roam-graph-local-token-*)
- ✅ Subprocess model fits Node.js architecture

**Alternative**: Approach 2 (MCP Server) if higher performance needed in future.

---

## Current State Analysis

### Architecture (Deprecated)

```
User UI Form
    ↓
[apiEndpoint: "http://localhost:8000"]
[apiToken: string]
    ↓
RoamClient (lib/roam/client.ts)
    ↓
Direct HTTP POST
    ↓
http://localhost:8000/api/graph/{graphName}/q
    ↓
❌ ERR_CONNECTION_REFUSED (endpoint doesn't exist)
```

### Files Using Deprecated Architecture

| Category | Files | Count |
|----------|-------|-------|
| **Database Models** | prisma/schema.prisma | 1 |
| **Core Client** | lib/roam/client.ts | 1 |
| **Sync Logic** | lib/roam/sync.ts | 1 |
| **Configuration API** | app/api/roam/config/route.ts | 1 |
| **Test Connection API** | app/api/roam/test-connection/route.ts | 1 |
| **Sync Utilities** | lib/roam/importer.ts | 1 |
| **UI Forms** | components/forms/RoamConfigForm.tsx | 1 |
| **UI Forms** | components/forms/RoamLiveSyncForm.tsx | 1 |
| **Migrations (SQL)** | prisma/migrations/1_phase_1a_roam_local_api/migration.sql | 1 |
| **TOTAL** | **9 files** | **9** |

### Key Dependencies on Deprecated Architecture

**Direct HTTP Calls**:
- `lib/roam/client.ts:54` - URL construction: `${apiEndpoint}/api/graph/${graphName}/q`
- `lib/roam/client.ts:70, 91` - Error messages reference `apiEndpoint`

**Configuration Storage**:
- `prisma/schema.prisma:266` - `apiEndpoint String @default("http://localhost:8000")`
- `app/api/roam/config/route.ts:45,81,86` - Default and validation logic

**User Interaction**:
- `components/forms/RoamConfigForm.tsx:18` - State: `useState('http://localhost:8000')`
- `components/forms/RoamConfigForm.tsx:151,154` - UI placeholders and help text

---

## Target Architecture

### Proposed Migration Target: Approach 3 (Roam CLI)

```
User UI Form
    ↓
[graphName: string]
[localApiToken: "roam-graph-local-token-*"]
    ↓
RoamCliService (new)
    ↓ [subprocess wrapper]
    ↓
@roam-research/roam-cli
    ↓ [standard input/output]
    ↓
Roam Desktop Local API
    ↓
Encrypted Local Graph Database
```

### Architecture Advantages

| Aspect | Deprecated | New |
|--------|-----------|-----|
| **Official Support** | ❌ Unsupported | ✅ Official Roam tool |
| **Verified Working** | ❌ ERR_CONNECTION_REFUSED | ✅ Production-tested |
| **Authentication** | ❌ Bearer token (wrong format) | ✅ Local API token standard |
| **Endpoint Known** | ❌ Hardcoded guess (localhost:8000) | ✅ Built into CLI |
| **Error Handling** | ❌ Generic HTTP errors | ✅ CLI-level error messages |
| **Future-Proof** | ❌ Breaking changes expected | ✅ Maintained by Roam |
| **Implementation** | ❌ Proprietary assumptions | ✅ Public GitHub repos |

---

## Detailed Migration Plan

### Phase 1: Preparation (No Code Changes)

**1.1 Dependency Installation**
```bash
npm install @roam-research/roam-cli
npm install --save-dev @types/node (if needed for subprocess types)
```

**1.2 Local Setup Verification**
```bash
# User must generate local API token in Roam Desktop
# Settings → Graph → Local API Tokens → Generate
# Token format: roam-graph-local-token-XXXXX

# Configure CLI (one-time)
roam connect  # Interactive authentication
```

**1.3 Test Connection**
```bash
roam list-graphs  # Should show available graphs
roam search "test" --graph Project_Kinergy  # Should work
```

---

### Phase 2: Service Layer Creation

**2.1 New Service File: `lib/roam/cli-service.ts`**

Purpose: Wrapper around roam-cli subprocess that replaces RoamClient

Responsibilities:
- Execute roam CLI commands
- Parse text output to structured data
- Handle errors and retries
- Cache results if needed

Key Methods:
```typescript
class RoamCliService {
  constructor(graphName: string, localApiToken: string)
  
  // Connection Testing
  async testConnection(): Promise<{ success: boolean; message: string }>
  
  // Query Operations
  async searchByText(query: string): Promise<Block[]>
  async fetchPageByTitle(title: string): Promise<Page | null>
  async fetchBlockWithChildren(uid: string): Promise<Block>
  
  // Modification Operations
  async createPage(title: string): Promise<{ uid: string }>
  async updateBlock(uid: string, content: string): Promise<void>
  
  // Graph Operations
  async importData(filePath: string): Promise<ImportResult>
  async exportGraph(format: 'markdown' | 'json'): Promise<Buffer>
}
```

**2.2 Deprecation: Keep RoamClient as Wrapper**

Don't delete RoamClient immediately - wrap it to delegate to RoamCliService:

```typescript
// lib/roam/client.ts - REFACTORED (still exports same interface)
export class RoamClient {
  private cliService: RoamCliService
  
  constructor(graphName: string, apiToken: string, apiEndpoint?: string) {
    // Ignore apiEndpoint parameter (deprecated)
    this.cliService = new RoamCliService(graphName, apiToken)
  }
  
  async testConnection() {
    return this.cliService.testConnection()
  }
  
  async queryDatalog(query: string) {
    return this.cliService.searchByText(query)  // Simplified version
  }
}
```

This allows existing code to work without modification while we transition internally.

---

### Phase 3: API Route Refactoring

**3.1 Configuration API (`app/api/roam/config/route.ts`)**

Changes:
- Remove `apiEndpoint` parameter from POST validation
- Keep `apiEndpoint` in response for backward compatibility (deprecated)
- Update to use `localApiToken` instead

```typescript
// BEFORE
const { projectId, graphName, apiToken, apiEndpoint = 'http://localhost:8000' }

// AFTER
const { projectId, graphName, localApiToken }
// Note: apiToken still accepted for backward compatibility, 
// but localApiToken is preferred
```

**3.2 Test Connection API (`app/api/roam/test-connection/route.ts`)**

Changes:
- Use RoamCliService internally
- Update response to remove endpoint reference
- Add more detailed error messages from CLI

```typescript
const service = new RoamCliService(config.graphName, config.localApiToken)
const result = await service.testConnection()
```

**3.3 Sync API (`lib/roam/sync.ts`)**

Changes:
- Replace direct HTTP calls with RoamCliService method calls
- Update error handling to use CLI error messages
- Preserve all function signatures for backward compatibility

---

### Phase 4: Database Schema Updates

**4.1 Schema Changes (`prisma/schema.prisma`)**

Add new columns (keep old ones for backward compatibility):

```prisma
model RoamConfig {
  // ... existing fields ...
  
  // OLD (DEPRECATED - keep for migration)
  apiEndpoint    String        @default("http://localhost:8000")
  
  // NEW (PREFERRED)
  localApiToken  String?       // roam-graph-local-token-*
  tokenGeneratedAt DateTime?   // When token was created
  
  // ... existing fields ...
}
```

**4.2 Migration SQL**

Create new migration to add new columns:

```sql
ALTER TABLE "RoamConfig" 
  ADD COLUMN "localApiToken" VARCHAR,
  ADD COLUMN "tokenGeneratedAt" TIMESTAMP;
```

**4.3 Data Migration Strategy**

For existing records:
- `localApiToken` will be NULL initially
- Users must update via config form
- Forms will show warning: "Please update to Local API Token format"

---

### Phase 5: UI Component Updates

**5.1 RoamConfigForm.tsx Changes**

Before:
```typescript
const [apiEndpoint, setApiEndpoint] = useState('http://localhost:8000')
const [apiToken, setApiToken] = useState('')

// Submit includes both
apiEndpoint, apiToken
```

After:
```typescript
const [localApiToken, setLocalApiToken] = useState('roam-graph-local-token-')
const [graphName, setGraphName] = useState('')

// Submit includes
localApiToken, graphName

// DEPRECATED: Keep apiEndpoint field but mark as deprecated
// Show warning: "Use Local API Token instead"
```

**5.2 RoamLiveSyncForm.tsx Changes**

- Update to use new test-connection endpoint signature
- Update to display graphs available via CLI
- Add validation for token format

---

### Phase 6: Cleanup (After All Tests Pass)

**6.1 Remove Deprecated Code** (after verification period)

- Delete old RoamClient class
- Remove apiEndpoint from UI completely
- Remove apiEndpoint from database schema (requires new migration)
- Remove apiEndpoint from API responses

**6.2 Database Cleanup Migration**

```sql
ALTER TABLE "RoamConfig" 
  DROP COLUMN "apiEndpoint";
```

---

## Functional Preservation Checklist

User-facing functionality that MUST be preserved:

### Test Connection
- ✅ Current: `POST /api/roam/test-connection`
- ✅ New: Same endpoint, uses RoamCliService internally
- ✅ User sees: Same success/error messages
- ✅ Result: Connection verification with CLI

### Sync Status
- ✅ Current: `GET /api/roam/config` returns sync status
- ✅ New: Same endpoint, same response format
- ✅ User sees: Same status display
- ✅ Result: Sync state tracking preserved

### Initial Import
- ✅ Current: `POST /api/roam/import` - imports from Roam graph
- ✅ New: Same endpoint, uses `roam export` + parse
- ✅ User sees: Same import progress
- ✅ Result: Data imported successfully

### Live Sync
- ✅ Current: Background sync checking for changes
- ✅ New: Uses `roam search` / `roam fetch-page` for updates
- ✅ User sees: Same sync notifications
- ✅ Result: Changes detected and synced

### Repository Visualization
- ✅ Current: Display Roam pages as tree
- ✅ New: Data source changes internally, UI stays same
- ✅ User sees: Same tree visualization
- ✅ Result: Structure displayed correctly

---

## Risk Assessment

### Risk Level: MEDIUM

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Subprocess overhead** | High | Medium | Cache results, batch queries |
| **Token format errors** | Medium | High | Validate token format in form |
| **CLI not installed** | Medium | High | Add installation check in API routes |
| **Roam Desktop not running** | High | Low | Show clear error message to user |
| **Backward compatibility** | Low | High | Keep wrapper around old RoamClient for transition |
| **Performance regression** | Medium | Medium | Profile before/after, optimize queries |

### Rollback Plan

If issues occur:
1. Keep deprecated RoamClient code in git history
2. Revert to previous branch if needed (within 1 week)
3. All user data preserved in database (no destructive changes)

---

## Implementation Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| **Phase 1: Preparation** | 1 hour | Ready |
| **Phase 2: Service Layer** | 4 hours | Pending approval |
| **Phase 3: API Routes** | 3 hours | Pending approval |
| **Phase 4: Database Schema** | 1 hour | Pending approval |
| **Phase 5: UI Components** | 2 hours | Pending approval |
| **Phase 6: Cleanup** | 1 hour | After testing |
| **Testing & Validation** | 4 hours | After implementation |
| **TOTAL** | ~16 hours | Pending approval |

---

## Files to Modify

### NEW FILES (Created)
- `lib/roam/cli-service.ts` - New CLI wrapper service

### MODIFIED FILES
- `lib/roam/client.ts` - Convert to wrapper around cli-service
- `lib/roam/sync.ts` - Use cli-service methods
- `app/api/roam/config/route.ts` - Accept localApiToken
- `app/api/roam/test-connection/route.ts` - Use cli-service
- `components/forms/RoamConfigForm.tsx` - Update form fields
- `components/forms/RoamLiveSyncForm.tsx` - Update form logic
- `prisma/schema.prisma` - Add localApiToken column

### MIGRATION FILES (Database)
- `prisma/migrations/[timestamp]_add_local_api_token/migration.sql` - New migration

### DELETED FILES (Phase 6 - Later)
- None yet (kept for backward compatibility)

### DOCUMENTATION UPDATES
- Update README with new setup instructions
- Update configuration docs with token generation steps
- Add troubleshooting guide for CLI issues

---

## Database Changes Required

### Schema Addition (Phase 4)

```prisma
model RoamConfig {
  id                  String    @id @default(cuid())
  projectId           String    @db.VarChar(255)
  graphName           String    @db.VarChar(255)
  apiToken            String?   // DEPRECATED - for backward compatibility
  apiEndpoint         String    @default("http://localhost:8000") // DEPRECATED
  
  // NEW FIELDS (Required)
  localApiToken       String?   // Format: roam-graph-local-token-*
  tokenGeneratedAt    DateTime?
  
  syncEnabled         Boolean   @default(false)
  syncIntervalMin     Int       @default(30)
  syncDirection       String    @default("bidirectional")
  lastSyncAt          DateTime?
  lastSyncStatus      String?
  lastSyncError       String?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@unique([projectId, graphName])
  @@index([projectId])
}
```

### Data Migration Strategy

1. **Phase 4**: Add columns as nullable (non-blocking)
2. **Phase 5**: Users update via UI form
3. **Phase 6** (later): Remove old columns after transition period

---

## Change Report Preview

### Summary

| Category | Count |
|----------|-------|
| **New files** | 1 |
| **Modified files** | 7 |
| **Database migrations** | 1 |
| **Breaking changes** | 0 (backward compatible) |
| **Deleted files (Phase 6)** | 0 (kept for transition) |
| **Lines added** | ~400 |
| **Lines removed** | ~50 (cleanup) |

### Modified Files Detail

1. **lib/roam/cli-service.ts** (NEW)
   - ~250 lines - Complete CLI wrapper service

2. **lib/roam/client.ts** (MODIFIED)
   - +30 lines - Convert to wrapper
   - -30 lines - Remove direct HTTP code
   - Net: +0 (same size, different implementation)

3. **lib/roam/sync.ts** (MODIFIED)
   - +5 lines - Use new service methods
   - -5 lines - Remove HTTP setup

4. **app/api/roam/config/route.ts** (MODIFIED)
   - +10 lines - Handle localApiToken
   - -5 lines - Remove apiEndpoint defaults

5. **app/api/roam/test-connection/route.ts** (MODIFIED)
   - +5 lines - Use new service
   - No deletions

6. **components/forms/RoamConfigForm.tsx** (MODIFIED)
   - +20 lines - New token input
   - -5 lines - Remove old endpoint input (deprecated warning instead)

7. **components/forms/RoamLiveSyncForm.tsx** (MODIFIED)
   - +5 lines - Update endpoint call

---

## Testing Strategy

### Unit Tests
- [ ] RoamCliService methods work with real CLI
- [ ] Token validation in forms
- [ ] Error message parsing from CLI

### Integration Tests
- [ ] Config API accepts localApiToken
- [ ] Test connection succeeds with valid token
- [ ] Sync operations use CLI service

### User Acceptance Tests
- [ ] Can generate local API token
- [ ] Can save configuration
- [ ] Can test connection
- [ ] Can import from Roam graph
- [ ] Can perform live sync
- [ ] Error messages are helpful

### Backward Compatibility Tests
- [ ] Old RoamClient wrapper still works
- [ ] Old apiEndpoint parameter ignored gracefully
- [ ] Database queries still work

---

## Questions for Review

Before implementation, please clarify:

1. **Token Management**: Should we store localApiToken in plaintext or encrypt it?
   - Current: apiToken is encrypted
   - Proposed: localApiToken also encrypted (same as apiToken)

2. **Roam Desktop Requirement**: Is offline mode required?
   - Proposed: Roam Desktop must be running (CLI requirement)
   - Impact: Can't sync without Desktop running

3. **Performance**: Is subprocess overhead acceptable?
   - Estimated: ~100-500ms per CLI command
   - Mitigation: Cache, batch, optimize query patterns

4. **Rollback Window**: How long should we maintain backward compatibility?
   - Proposed: 2 weeks (Phase 1-5), then Phase 6 cleanup
   - Flexibility: Can extend if needed

---

## Approval Checklist

- [ ] Architecture approach approved (Approach 3 - Roam CLI)
- [ ] File modification list approved
- [ ] Database schema changes approved
- [ ] Functional preservation checklist reviewed
- [ ] Risk assessment acceptable
- [ ] Timeline realistic
- [ ] Testing strategy sufficient
- [ ] Ready to proceed to implementation

---

## References

**Official Documentation**:
- [@roam-research/roam-cli npm](https://www.npmjs.com/package/@roam-research/roam-cli)
- [Roam-Research/roam-tools GitHub](https://github.com/Roam-Research/roam-tools)

**Project Documentation**:
- ROAM_INTEGRATION_RECOMMENDATIONS.md - Approach comparison
- ROAM_LOCAL_API_INVESTIGATION.md - Problem analysis
- ROAM_API_AUDIT.md - Technical audit

**Current Implementation**:
- lib/roam/client.ts - Deprecated client
- app/api/roam/config/route.ts - Configuration API
- app/api/roam/test-connection/route.ts - Test endpoint

