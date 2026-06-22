# Route Conflict Analysis - Execution Versioning MVP

**Error**: `You cannot use different slug names for the same dynamic path ('cycleId' !== 'id')`

---

## ROOT CAUSE

Two conflicting dynamic route segments exist under the same parent path:

```
/api/execution-cycles/
├── [id]/          ← EXISTING (uses 'id' parameter)
│   └── route.ts
└── [cycleId]/     ← NEW (uses 'cycleId' parameter)
    └── versions/
        ├── route.ts
        └── [versionId]/
            └── route.ts
```

**Problem**: Next.js requires all dynamic segments at the same level to use the same parameter name. These two directories conflict because:
- `/api/execution-cycles/[id]/` expects routes like `/api/execution-cycles/{SOME_ID}`
- `/api/execution-cycles/[cycleId]/` expects routes like `/api/execution-cycles/{SOME_CYCLE_ID}`

Both are trying to match the same URL pattern segment but with different parameter names.

---

## CONFLICTING ROUTES

### Existing Routes (using `[id]`)

**File**: `app/api/execution-cycles/[id]/route.ts`

```
GET  /api/execution-cycles/{id}
     └─ Fetches cycle with metrics

PATCH /api/execution-cycles/{id}
      └─ Updates cycle status
```

**Parameter**: `id` (cycleId)  
**Operations**: Get cycle, update cycle status

### New Routes (using `[cycleId]`)

**File**: `app/api/execution-cycles/[cycleId]/versions/route.ts`

```
GET  /api/execution-cycles/{cycleId}/versions
     └─ List all versions for a cycle

POST /api/execution-cycles/{cycleId}/versions
     └─ Create new version
```

**File**: `app/api/execution-cycles/[cycleId]/versions/[versionId]/route.ts`

```
GET  /api/execution-cycles/{cycleId}/versions/{versionId}
     └─ Get version details

PATCH /api/execution-cycles/{cycleId}/versions/{versionId}
      └─ Update version status
```

**Parameter**: `cycleId`  
**Operations**: Version management

---

## COMPLETE ROUTE TREE

```
app/
├── api/
│   ├── codeRepositories/
│   │   └── [id]/                    ← Uses 'id'
│   │       └── route.ts
│   ├── execution-cycles/
│   │   ├── [id]/                    ← CONFLICT: Uses 'id' ⚠
│   │   │   └── route.ts
│   │   │       • GET /api/execution-cycles/{id}
│   │   │       • PATCH /api/execution-cycles/{id}
│   │   │
│   │   └── [cycleId]/               ← CONFLICT: Uses 'cycleId' ⚠
│   │       └── versions/
│   │           ├── route.ts
│   │           │   • GET /api/execution-cycles/{cycleId}/versions
│   │           │   • POST /api/execution-cycles/{cycleId}/versions
│   │           │
│   │           └── [versionId]/
│   │               └── route.ts
│   │                   • GET /api/execution-cycles/{cycleId}/versions/{versionId}
│   │                   • PATCH /api/execution-cycles/{cycleId}/versions/{versionId}
│   │
│   ├── projects/
│   │   └── [id]/                    ← Uses 'id'
│   │       └── route.ts
│   ├── test-runs/
│   │   └── [id]/                    ← Uses 'id'
│   │       └── route.ts
│   └── test-suites/
│       └── [id]/                    ← Uses 'id'
│           └── route.ts
│
└── projects/
    └── [id]/                        ← Uses 'id'
        └── route.ts
```

---

## URL PATTERN CONFLICT

### Existing [id] Route
```
Pattern: /api/execution-cycles/{ANY_VALUE}
Examples:
  /api/execution-cycles/123
  /api/execution-cycles/abc-def-ghi
  /api/execution-cycles/cycle-001

Handler: GET, PATCH from [id]/route.ts
Parameter: id
```

### New [cycleId] Route
```
Pattern: /api/execution-cycles/{ANY_VALUE}
Examples:
  /api/execution-cycles/123
  /api/execution-cycles/abc-def-ghi
  /api/execution-cycles/cycle-001

Handler: Subfolder routing to /versions/
Parameter: cycleId
```

**CONFLICT**: Both patterns match the same URL structure but use different parameter names.

---

## WHICH PARAMETER NAME TO USE?

### Analysis

**Existing code uses**: `[id]`
- Used in: `codeRepositories/[id]`, `projects/[id]`, `test-runs/[id]`, `test-suites/[id]`
- Convention: Generic `id` parameter for all resources

**New code uses**: `[cycleId]`
- More explicit but inconsistent with existing patterns
- Creates the conflict

### Recommendation

**Use `[id]` everywhere** (canonical name)

**Reason**:
1. ✓ Matches existing codebase convention
2. ✓ All other resources use `[id]`
3. ✓ Simpler and more standard
4. ✓ No conflict with existing routes
5. ✓ Version routes become `/api/execution-cycles/{id}/versions`

---

## FILES TO MODIFY

To fix the conflict, rename `[cycleId]` → `[id]`:

### 1. Directory Rename
```
Before:
  app/api/execution-cycles/[cycleId]/

After:
  app/api/execution-cycles/[id]/versions/
  └─ This merges with existing [id]/ folder
```

Wait - this creates a problem. The existing `[id]/route.ts` handles GET and PATCH at that level. Adding a `versions/` subfolder would conflict.

### REVISED SOLUTION

**Option A: Keep both but use same parameter name**

```
app/api/execution-cycles/[id]/
├── route.ts                    ← Existing GET/PATCH
└── versions/
    ├── route.ts                ← New GET/POST
    └── [versionId]/
        └── route.ts            ← New GET/PATCH
```

**Rename these files:**
1. `app/api/execution-cycles/[cycleId]/versions/route.ts` 
   → Update parameter from `cycleId` to `id`

2. `app/api/execution-cycles/[cycleId]/versions/[versionId]/route.ts`
   → Update parameter from `cycleId` to `id`

3. Delete: `app/api/execution-cycles/[cycleId]/` folder (empty after moving)

4. Move `versions/` subfolder to `app/api/execution-cycles/[id]/versions/`

---

## SUMMARY

| Aspect | Details |
|--------|---------|
| **Conflict** | Two dynamic segments `[id]` and `[cycleId]` at same level |
| **Location** | `app/api/execution-cycles/` |
| **Root Cause** | New code used `[cycleId]`, existing code uses `[id]` |
| **Impact** | Dev server fails to start |
| **Fix** | Rename `[cycleId]` to `[id]` and restructure folder |
| **Files Affected** | 2 route files, 1 folder move |
| **Backward Compat** | No - all routes will use `id` parameter |

---

## MINIMAL FIX STEPS

1. **Update** `app/api/execution-cycles/[cycleId]/versions/route.ts`
   - Change `cycleId` → `id` in type definition
   - Change `const { cycleId }` → `const { id }`
   - All `cycleId` → `id`

2. **Update** `app/api/execution-cycles/[cycleId]/versions/[versionId]/route.ts`
   - Change `cycleId` → `id` in type definition
   - Change `const { cycleId }` → `const { id }`
   - All `cycleId` → `id`

3. **Move folder**
   - Move `app/api/execution-cycles/[cycleId]/versions/` → `app/api/execution-cycles/[id]/versions/`

4. **Delete empty folder**
   - Delete `app/api/execution-cycles/[cycleId]/`

5. **Update API calls in cycles.page.tsx**
   - All API calls using `/api/execution-cycles/{cycleId}/versions` still work
   - Parameter name change is internal to route handlers only

---

## AWAITING APPROVAL

Do NOT make changes yet. Is this analysis correct?

**Approve to:**
1. Change `cycleId` → `id` in 2 route files
2. Move `versions/` folder to `[id]/`
3. Delete `[cycleId]/` folder
4. Update API parameter references

Proceed? YES / NO

