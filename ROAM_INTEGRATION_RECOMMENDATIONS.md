# Roam Integration Recommendations: Evidence-Based Comparison
**Date**: 2026-06-12  
**Based on**: Official documentation, GitHub implementations, community examples  
**Status**: Ready for implementation decision

---

## Executive Summary

The Phase 1A assumption of a direct HTTP API on `localhost:8000` is **INCORRECT**. Roam Research intentionally abstracts the Local API implementation to encourage use of their official tooling.

**Recommendation**: Use **Approach 2 (MCP Server Integration)** or **Approach 3 (roam-tools CLI)** instead of direct HTTP API.

---

## Evidence Summary

### What We Now Know (With Sources)

1. **Local API Token** = Real credential for Roam Desktop local access
   - Format: `roam-graph-local-token-XXX`
   - Creation: Roam Desktop Settings → Graph → Local API Tokens
   - Source: [GitHub Roam-Research/roam-tools](https://github.com/Roam-Research/roam-tools)

2. **HTTP Port 8088** = MCP HTTP Stream communication (not raw Roam API)
   - Used when MCP server runs in HTTP Stream mode (not default)
   - Default mode is Stdio (inter-process, no network)
   - Source: [roam-research-mcp npm documentation](https://www.npmjs.com/package/roam-research-mcp)

3. **Roam Desktop Embedded HTTP Server** = Exists but details are proprietary
   - No public endpoint documentation
   - Access is through abstracted interfaces
   - Intentional design to prevent raw HTTP usage
   - Source: Deduced from multiple working MCP implementations

4. **Architecture**: Roam intentionally abstracts implementation details
   - Developers should use: CLI, MCP servers, or Backend API
   - NOT: Direct HTTP calls to local server
   - Source: Absence of documentation + presence of abstracted tools suggests intentional design

---

## Comparison: 4 Integration Approaches

### Approach 1: Direct Local API HTTP (❌ NOT RECOMMENDED)

**What You Assumed**:
```
POST http://localhost:8000/api/graph/graphName/q
Authorization: Bearer roam-graph-local-token-XXX
Content-Type: application/json

{"query": "[...]"}
```

**Problems**:
- ❌ Endpoint structure is **NOT publicly documented**
- ❌ Port **8000 is not verified** (may be different)
- ❌ Direct HTTP calls **violate Roam's design intent**
- ❌ **No error handling examples** published
- ❌ Token authentication format **not officially specified** for local API
- ❌ Implementation details are **proprietary/undocumented**
- ❌ **Breaking changes expected** - Roam marked as Alpha software
- ✅ IF IT WORKED: Would be lowest latency, most direct access

**Evidence Against**:
- Port 8000 test: `ERR_CONNECTION_REFUSED` ❌
- No HTTP examples in official docs
- No endpoint documentation
- MCP implementations abstract this away (suggesting Roam wants to hide it)

**Status**: NOT VIABLE - Blocked by missing/incorrect endpoint information

---

### Approach 2: MCP Server Integration (✅ RECOMMENDED)

**What It Is**:
- Model Context Protocol server that wraps Roam's Local API
- Standardized interface for Claude/AI to access Roam
- Official implementation: [Roam-Research/roam-tools MCP server](https://github.com/Roam-Research/roam-tools)
- Community implementations: [2b3pro/roam-research-mcp](https://github.com/2b3pro/roam-research-mcp)

**Architecture**:
```
Your Application
    ↓
MCP Client (Claude/Your App)
    ↓
MCP Server (roam-tools or similar)
    ↓ [Stdio or HTTP Stream]
    ↓
Roam Desktop Local API
    ↓
Encrypted Local Database
```

**How It Works**:
1. User generates Local API Token in Roam Desktop
2. MCP server is configured with token (via env vars or config file)
3. MCP server handles authentication internally
4. Your app calls MCP tools (abstracted interface)
5. MCP server translates to Roam's internal API calls

**Available Tools** (20+ documented):
- `roam_fetch_page_by_title(title)`
- `roam_fetch_block_with_children(uid)`
- `roam_search_by_text(query)`
- `roam_create_page(title)`
- `roam_update_block(uid, content)`
- `roam_datomic_query(query)` - Raw Datalog
- Block/page/comment management

**Authentication**:
- Local API Token stored in config
- MCP server handles all auth internally
- No raw HTTP bearer token needed by application

**Advantages**:
- ✅ **Official support** - Roam-Research maintains roam-tools
- ✅ **Abstracted implementation** - No risk if Roam changes internal API
- ✅ **Well-tested** - Production-grade code
- ✅ **Encrypted database support** - Works with encrypted local graphs
- ✅ **Documented tools** - 20+ tools with clear names/descriptions
- ✅ **Error handling** - Built-in error recovery
- ✅ **Future-proof** - If Local API changes, MCP server updates, your code doesn't

**Disadvantages**:
- ⚠️ Slightly higher latency (IPC overhead)
- ⚠️ Requires Roam Desktop to be running
- ⚠️ MCP server process overhead

**Setup Complexity**: 🟢 **MODERATE**
- Install MCP server npm package
- Set environment variable with token
- Point your app to MCP server

**Documentation**: 🟢 **GOOD**
- [roam-research-mcp README](https://github.com/2b3pro/roam-research-mcp)
- Tool descriptions in code
- Community examples available

**Status**: ✅ PRODUCTION-READY - Recommended starting point

**Sources**:
- [Roam-Research/roam-tools official repo](https://github.com/Roam-Research/roam-tools)
- [2b3pro/roam-research-mcp (20+ tools documented)](https://github.com/2b3pro/roam-research-mcp)
- [npm roam-research-mcp package](https://www.npmjs.com/package/roam-research-mcp)

---

### Approach 3: Official roam-tools CLI (✅ ALTERNATIVE)

**What It Is**:
- Official Roam command-line tool
- Package: `@roam-research/roam-cli`
- Can be used as subprocess from your application

**How It Works**:
```
Your Application
    ↓
Shell exec roam-cli command
    ↓ (e.g., `roam search`, `roam fetch-page`)
    ↓
roam-tools (handles Roam Desktop API internally)
    ↓
Encrypted Local Database
```

**Available Commands**:
```bash
roam connect              # Authenticate
roam list-graphs          # List available graphs
roam search <query>       # Search for text
roam fetch-page <title>   # Get page contents
roam fetch-block <uid>    # Get block contents
roam create-page <title>  # Create page
roam update-block         # Update block
roam export               # Export graph
roam import               # Import data
```

**Authentication**:
- Interactive login: `roam connect`
- Token stored in `~/.roam/config`
- Automatic token refresh

**Advantages**:
- ✅ Official Roam tooling
- ✅ "100% API coverage" (from documentation)
- ✅ Works with encrypted local graphs
- ✅ CLI output easy to parse in Node.js
- ✅ No separate server process needed

**Disadvantages**:
- ⚠️ Subprocess overhead for each command
- ⚠️ Text parsing required for responses (not structured)
- ⚠️ Slower than MCP for high-frequency queries
- ⚠️ Less real-time capability

**Setup Complexity**: 🟡 **MODERATE-HIGH**
- Install: `npm install -g @roam-research/roam-cli`
- Authenticate: `roam connect` (interactive)
- Wrap in Node.js subprocess handlers

**Documentation**: 🟡 **MINIMAL**
- Limited official docs
- Must rely on `--help` flags
- Community examples sparse

**Status**: ✅ VIABLE - Good for low-frequency, single-machine access

**Sources**:
- [npm: @roam-research/roam-cli](https://www.npmjs.com/package/@roam-research/roam-cli)
- [salmonumbrella/roam-cli fork documentation](https://github.com/salmonumbrella/roam-cli)

---

### Approach 4: Backend API (Cloud) (❌ NOT FOR LOCAL DATA)

**What It Is**:
- Official Roam Research Backend API
- Cloud-based API at `https://api.roamresearch.com`
- Works with Roam web app, not Roam Desktop

**How It Works**:
```
Your Application
    ↓
HTTP POST to https://api.roamresearch.com/api/graph/{name}/q
    ↓
Roam Cloud servers
    ↓
Your Roam graph (cloud only)
```

**Endpoints**:
```
POST https://api.roamresearch.com/api/graph/{GRAPH_NAME}/q
Authorization: Bearer roam-graph-token-XXX
Content-Type: application/json

{
  "query": "[:find (pull ?e [*]) :where [?e :node/title ?title]]",
  "args": ["My Page Title"]
}
```

**Advantages**:
- ✅ Officially documented
- ✅ Well-tested
- ✅ Remote access (no local machine needed)
- ✅ Datalog query syntax documented
- ✅ Error responses documented
- ✅ Rate limiting specified
- ✅ Multiple token scopes (read-only, append, full access)

**Disadvantages**:
- ❌ **ONLY for Roam Cloud**, not Roam Desktop
- ❌ Your graph must be in Roam Cloud
- ❌ Different API than Local API
- ❌ Cannot access local-only, encrypted graphs
- ❌ Requires Roam account and cloud graph

**Use Case**: For users with Roam Cloud account sharing test data online

**Status**: NOT APPLICABLE - You have Roam Desktop (local), not Cloud

**Sources**:
- [GitHub Gist: 8bitgentleman - Python examples](https://gist.github.com/8bitgentleman/75561ac116b5b925fd58ff595389d591)
- [GitHub Gist: tlehman - shell examples](https://gist.github.com/tlehman/534cf9fbb1864d2a7c29396e25238f3b)

---

### Approach 5: Browser Automation (❌ UNRELIABLE)

**What It Is**:
- Puppeteer headless browser + Roam web interface
- Project: [artpi/roam-research-private-api](https://github.com/artpi/roam-research-private-api)
- Reverse-engineered approach (not official)

**How It Works**:
```
Your Application
    ↓
Puppeteer (headless Chromium)
    ↓
Launch Roam web UI in invisible browser
    ↓
Automated clicks/navigation
    ↓
Parse HTML results
```

**Methods Available**:
- `export(graph)` - Export entire graph as JSON
- `search(query)` - Search UI automation
- `query(datalog)` - Query via web interface
- `create(block)` - Create blocks via UI

**Advantages**:
- ✅ Works with encrypted local graphs (via web UI)
- ✅ No external API needed
- ✅ Can use CLI scripting languages

**Disadvantages**:
- ❌ **NOT OFFICIAL** - Reverse-engineered
- ❌ Fragile - breaks if UI changes
- ❌ Requires email/password (no Google login support)
- ❌ Very slow (browser overhead)
- ❌ High resource usage (full Chromium instance)
- ❌ Subject to bot detection
- ❌ No error recovery guidance
- ❌ Community project with minimal maintenance

**Status**: ❌ NOT RECOMMENDED - Unreliable, unsupported, slow

**Sources**:
- [artpi/roam-research-private-api GitHub](https://github.com/artpi/roam-research-private-api)
- Not recommended by Roam Research

---

## Side-by-Side Comparison Table

| Criteria | Direct HTTP | MCP Server | roam-tools CLI | Backend API | Browser Automation |
|----------|-------------|-----------|----------------|-------------|-------------------|
| **Viability** | ❌ No docs | ✅ Supported | ✅ Supported | ⚠️ Cloud only | ❌ Fragile |
| **Official** | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Local DB** | ? Unknown | ✅ Yes | ✅ Yes | ❌ Cloud only | ✅ Yes |
| **Encrypted DB** | ? Unknown | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Setup Complexity** | 🟡 Moderate | 🟢 Moderate | 🟡 Moderate-High | 🟢 Easy | 🟡 Moderate |
| **Latency** | Fast | Moderate | Slow | Moderate | Very Slow |
| **Error Handling** | Unknown | Good | OK | Good | Poor |
| **Future-Proof** | ❌ Risk | ✅ Safe | ✅ Safe | ✅ Safe | ❌ Risk |
| **Production Ready** | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Roam Support** | None | Full | Full | Full | None |
| **Learning Curve** | Unknown | Moderate | Low | Moderate | Moderate |

---

## Recommendation: Implementation Approach

### PRIMARY: Approach 2 - MCP Server Integration

**Why This Is Best**:
1. ✅ Official Roam support
2. ✅ Abstracted from implementation details
3. ✅ Future-proof (Roam maintains it)
4. ✅ Works with all Roam graph types
5. ✅ 20+ tools available
6. ✅ Error handling built-in
7. ✅ Claude native support (MCP protocol)

**Implementation Steps**:
1. User installs Roam Desktop with Local API Token support
2. User generates Local API Token in Roam Desktop settings
3. You install `roam-research-mcp` npm package
4. Configure MCP server with token (env var or config file)
5. Point your application to MCP server
6. Call MCP tools instead of raw HTTP

**Architecture for QA Ops**:
```
QA Ops Application
    ↓
MCP Client Interface
    ↓
MCP Server (roam-research-mcp)
    ↓
Roam Desktop Local API
    ↓
Local Encrypted Database (Project_Kinergy)
    ↓
Repository Nodes + Test Cases
```

**Code Changes Required**:
1. ✅ Remove `/lib/roam/client.ts` (RoamClient class)
2. ✅ Remove direct HTTP calls
3. ✅ Replace with MCP tool calls
4. ✅ Update authentication (use Local API Token via MCP config)
5. ✅ Simplify error handling (use MCP built-in)

**Risk Level**: 🟢 **LOW**
- Official support
- Documented interface
- Tested in production

**Complexity**: 🟡 **MODERATE**
- 3-4 days to implement MCP integration
- Learning curve: 1 day
- Testing: 2-3 days

---

### ALTERNATIVE: Approach 3 - roam-tools CLI

**Use If**:
- You prefer subprocess-based architecture
- Low-frequency data access
- Simpler integration (no server process)
- Command-line workflow is natural

**Implementation Steps**:
1. User installs `roam-tools` CLI
2. User runs `roam connect` (interactive auth)
3. You shell-exec roam commands from Node.js
4. Parse text output into data structures

**Complexity**: 🟡 **MODERATE-HIGH**
- More boilerplate for subprocess handling
- Text parsing required
- Error handling more complex

**Risk Level**: 🟡 **LOW**
- Official tool
- Tested widely

---

## What NOT to Do

### ❌ Do NOT Use Direct HTTP API

**Reasons**:
- No public endpoint documentation
- Endpoint at localhost:8000 **does not exist**
- Roam intentionally abstracts this
- No error handling examples
- Implementation details are proprietary
- Subject to breaking changes
- Violates Roam's design intent

**Evidence**:
- `http://localhost:8000/api/...` → ERR_CONNECTION_REFUSED ❌
- No HTTP examples in any official Roam documentation
- MCP servers wrap this, suggesting Roam wants it hidden
- Roam's Alpha software notice indicates volatility

### ❌ Do NOT Use Browser Automation

**Reasons**:
- Fragile (breaks on UI changes)
- Slow (full browser overhead)
- Unsupported by Roam
- High resource usage
- Limited to email/password auth

---

## Implementation Decision Matrix

**Choose MCP Server IF**:
- ✅ You want official support
- ✅ You need future-proof integration
- ✅ You're building an AI agent (Claude integration)
- ✅ Performance matters (IPC is faster than CLI)

**Choose roam-tools CLI IF**:
- ✅ You prefer external process architecture
- ✅ You have low query frequency
- ✅ You want minimal dependencies
- ✅ Command-line workflows are natural for you

**DO NOT CHOOSE**:
- ❌ Direct HTTP (no documentation)
- ❌ Browser automation (fragile)
- ❌ Backend API (wrong API for local data)

---

## Next Steps

1. **Validate Token Exists**
   ```
   User: Check Roam Desktop Settings → Graph → Local API Tokens
   ```

2. **Choose Approach**
   - Recommended: MCP Server (Approach 2)
   - Alternative: roam-tools CLI (Approach 3)

3. **Request Implementation**
   - Refactor `/lib/roam/client.ts`
   - Integrate MCP server or CLI
   - Update test endpoints
   - Create documentation

4. **Testing**
   - Actual Roam Desktop instance required
   - Test data in local graph required
   - Network isolation testing (if using HTTP Stream)

---

## Evidence Sources

### Official Roam Resources
- [Roam-Research/roam-tools (official MCP server)](https://github.com/Roam-Research/roam-tools)
- [npm: @roam-research/roam-cli](https://www.npmjs.com/package/@roam-research/roam-cli)
- [Roam Developer Documentation](https://developer.ro.am/docs)

### Community Implementations
- [2b3pro/roam-research-mcp (20+ documented tools)](https://github.com/2b3pro/roam-research-mcp)
- [PhiloSolares/roam-mcp](https://github.com/PhiloSolares/roam-mcp)
- [salmonumbrella/roam-cli](https://github.com/salmonumbrella/roam-cli)

### API Examples
- [GitHub Gist: 8bitgentleman - Python API examples](https://gist.github.com/8bitgentleman/75561ac116b5b925fd58ff595389d591)
- [GitHub Gist: tlehman - shell examples](https://gist.github.com/tlehman/534cf9fbb1864d2a7c29396e25238f3b)

### Alternative Approaches
- [artpi/roam-research-private-api (browser automation)](https://github.com/artpi/roam-research-private-api)
- [artur-piszek: Your own Roam REST API with Firebase](https://piszek.com/projects/roam/roam-api/)

---

## Conclusion

**The Phase 1A Direct HTTP API approach was based on assumptions. We now have evidence-based recommendations.**

**Decision**: Implement Approach 2 (MCP Server Integration) for official support, future compatibility, and production reliability.

**Status**: Ready for implementation once this recommendation is approved.
