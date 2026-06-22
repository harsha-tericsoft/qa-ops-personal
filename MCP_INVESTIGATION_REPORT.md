# Roam MCP Investigation Report

**Date:** 2026-06-21  
**Question:** Can MCP replace the current roam-cli implementation?  
**Status:** Investigation Complete

---

## 1. MCP Client Availability in Codebase

### Search Results:

✅ **MCP SDK IS installed:**
- Package: `@modelcontextprotocol/sdk` (version >=1.26.0 <2.0.0)
- Location: `node_modules/@modelcontextprotocol/sdk`
- Status: Installed as transitive dependency

❌ **MCP is NOT being used for Roam:**
- No Roam MCP client code found
- No Roam MCP configuration found
- No `.mcp.json` configuration file exists

### Files Found:

| File | Purpose | MCP Status |
|------|---------|-----------|
| `lib/roam/mcp-sync-simple.ts` | "MCP" sync attempt | ❌ STILL USES roam-cli |
| `app/api/roam/sync-simple/route.ts` | Calls mcp-sync-simple | ❌ Calls cli-based implementation |
| `node_modules/next/dist/docs/mcp.md` | Next.js MCP docs | ℹ️ For dev tools only |

---

## 2. Roam MCP Server Availability

### Official Roam Support:

**Finding:** No official Roam MCP server exists.

Evidence:
- Roam packages installed:
  - `@roam-research/roam-cli` v0.7.4 (devDependencies)
  - `@roam-research/roam-tools-core` v0.7.5 (devDependencies)
  - `@roam-research/roam-tools-local` v0.7.4 (devDependencies)

- None of these packages provide MCP server capabilities
- No MCP references in official Roam documentation
- The roam-cli is the official integration method

### What exists:

✅ Roam Local API (via roam-cli)
- Command: `roam get-page`
- Command: `roam update-block`
- Command: `roam search`
- Authentication: ROAM_LOCAL_API_TOKEN environment variable
- Performance: ~10 minutes per block (as discovered in testing)

❌ Roam MCP Server:
- No official server
- No community server found in npm registry
- Would need to be built custom

---

## 3. Could We Build a Roam MCP Server?

### Technical Feasibility:

**YES - theoretically possible, but:**

1. **Build Requirements:**
   - Wrap roam-cli commands in MCP protocol
   - Implement MCP server interface from SDK
   - Handle authentication (ROAM_LOCAL_API_TOKEN)
   - Implement resource and tool definitions
   - Host as separate process

2. **Performance Impact:**
   - MCP adds protocol overhead (JSON-RPC via stdio)
   - Still uses roam-cli underneath
   - **Would NOT improve the 10-minute-per-block issue**
   - Would actually ADD latency due to serialization

3. **Development Cost:**
   - ~200-400 lines of MCP boilerplate
   - ~100 lines of resource/tool definitions
   - Testing and debugging
   - Maintenance of separate MCP server

---

## 4. Recommendation

### ❌ DO NOT MIGRATE TO MCP

**Reasoning:**

| Factor | Roam-CLI | MCP |
|--------|----------|-----|
| **Performance** | 10min/block | 10min/block + overhead |
| **Complexity** | Simple exec() | Extra process + protocol |
| **Official Support** | ✅ Yes (Roam) | ❌ No (custom build) |
| **Stability** | ✅ Proven | ⚠️ Would need testing |
| **Maintenance** | ✅ Roam maintains | ⚠️ We maintain |
| **Root Issue** | roam-cli hangs | Same issue exists |

**Key Finding:** The 10-minute response time is NOT due to CLI overhead - it's because Roam Desktop is slow to respond or unresponsive. MCP won't fix this.

---

## 5. The Real Problem (Not MCP-solvable)

### Root Cause of Sync Failures:

From earlier diagnostics:
- roam-cli commands hang/timeout
- Even with token set, CLI is unresponsive
- Not a CLI architecture issue - system connectivity issue

**Evidence:**
- `roam search` times out after 10+ seconds
- `roam get-page` times out after 10+ seconds
- `roam get-block` returns empty JSON
- MCP would still face same timeouts

### Solutions That WOULD Help:

1. **Fix #1: Reconnect roam-cli to Roam Desktop**
   - Roam Desktop might have crashed
   - Local API might be disabled
   - Token might be expired

2. **Fix #2: Fix the parentId bug in sync.ts** (primary issue)
   - This is why hierarchy is broken
   - Not related to CLI performance
   - Can be fixed in code

3. **Fix #3: Optimize sync batch size**
   - Current: 557 blocks sequentially × 10min each = 93 hours
   - Better: Batch requests in parallel
   - roam-cli supports this already

---

## 6. Actual MCP Situation in This Codebase

### The "MCP" Sync:

File: `lib/roam/mcp-sync-simple.ts`

```typescript
// Line 10 - Still uses roam-cli!
const { stdout } = await execAsync(
  `roam search --graph "${graphName}" --query="Test::"`,
  { timeout: 30000 }
);
```

**Conclusion:** Despite the file name, this is NOT an MCP implementation. It's a simplified CLI-based sync that:
- Only searches for "Test::" blocks
- Limits to 31 results (line 27)
- Creates flat structure without hierarchy
- Doesn't solve the parentId problem

---

## 7. Final Recommendation

### Keep roam-cli. Fix the sync logic instead.

**Action Plan:**

1. ✅ **DO NOT** build a Roam MCP server
2. ✅ **DO** fix the parentId bug in lib/roam/sync.ts
3. ✅ **DO** verify roam-cli is connected to Roam Desktop
4. ✅ **DO** consider parallelizing batch requests if performance is critical

**Why:**
- No performance gain from MCP
- Additional complexity
- Official roam-cli is maintained by Roam
- Real issue is the sync logic, not the CLI

---

## Summary Table

| Aspect | CLI (Current) | MCP (Proposed) | Recommendation |
|--------|---------------|---|---|
| Roam Official Support | ✅ Yes | ❌ No | **CLI** |
| Performance | Slow (10min/block) | Slower (+ overhead) | **CLI** |
| Complexity | Low | High | **CLI** |
| Maintenance | By Roam | By us | **CLI** |
| Fixes parentId bug | No | No | **Fix code instead** |
| Fixes CLI hangs | No | No | **Reconnect Roam Desktop** |

**Conclusion:** Migrate to MCP would increase complexity without solving any problems. The issues are in sync.ts logic and Roam Desktop connectivity, not the CLI transport layer.
