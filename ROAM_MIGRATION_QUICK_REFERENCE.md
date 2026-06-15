# Roam Migration - Quick Reference

**Status**: MIGRATION PLAN READY - Awaiting Approval

---

## The Problem

Current implementation tries to use **unsupported direct HTTP** to `localhost:8000` which doesn't exist:
```
❌ http://localhost:8000/api/graph/Project_Kinergy/q
   Error: ERR_CONNECTION_REFUSED
```

---

## The Solution

Use **Official Roam CLI Tool** (`@roam-research/roam-cli`):
```
✅ roam fetch-page "Page Title" --graph Project_Kinergy
   Result: Proper JSON output
```

---

## Why This Works

| Aspect | Old (Broken) | New (Works) |
|--------|------|---|
| Official Support | ❌ None | ✅ Roam Research |
| Authentication | ❌ Unknown format | ✅ Local API token standard |
| Error Handling | ❌ Guessing | ✅ Real error messages |
| Verification | ❌ Endpoint doesn't exist | ✅ CLI tested & working |

---

## What Changes for Users

### Before Migration
1. User inputs: `API Endpoint` + `API Token`
2. System tries: `http://localhost:8000/api/...` ❌ Fails

### After Migration  
1. User inputs: `Local API Token` (roam-graph-local-token-*)
2. System uses: Official `roam` CLI command ✅ Works

**User sees the same UI**, but under the hood uses verified approach.

---

## Files Modified (7 total)

| File | Type | Change |
|------|------|--------|
| `lib/roam/cli-service.ts` | NEW | CLI wrapper service |
| `lib/roam/client.ts` | MOD | Wrapper around cli-service |
| `lib/roam/sync.ts` | MOD | Use cli-service |
| `app/api/roam/config/route.ts` | MOD | Accept localApiToken |
| `app/api/roam/test-connection/route.ts` | MOD | Use cli-service |
| `components/forms/RoamConfigForm.tsx` | MOD | New token input |
| `prisma/schema.prisma` | MOD | Add localApiToken column |

**No deletions yet** - keeping old code for transition period.

---

## Database Changes

Add new columns to RoamConfig (keep old ones for migration):
```prisma
localApiToken      String?  // roam-graph-local-token-*
tokenGeneratedAt   DateTime?
```

---

## All User Features Preserved

- ✅ Test Connection
- ✅ Sync Status  
- ✅ Initial Import
- ✅ Live Sync
- ✅ Repository Visualization

Same functionality, working correctly.

---

## Risk Level: MEDIUM

**Risks**: Subprocess overhead, token format errors, Roam Desktop requirement  
**Mitigation**: Validation, error messages, documentation  
**Rollback**: Simple - keep old code, revert if needed  

---

## Implementation Time

**Total**: ~16 hours (over 2-3 days)

- Phase 1: Setup (1h)
- Phase 2: CLI service (4h)
- Phase 3: API routes (3h)
- Phase 4: Database (1h)
- Phase 5: UI forms (2h)
- Phase 6: Testing (4h)

---

## Next Steps

1. **Review** this plan
2. **Approve** the approach
3. **Implement** Phase 1-5 (features preserved)
4. **Test** with actual Roam graph
5. **Deploy** with full backward compatibility
6. **Monitor** for 2 weeks
7. **Cleanup** old code (Phase 6)

---

## Questions Before Approval?

See full ROAM_MIGRATION_PLAN.md for:
- Detailed architecture diagrams
- Code examples
- Risk assessment table
- Testing strategy
- Approval checklist

