# Roam MCP Proof of Concept

**Goal**: Read actual data from your Roam graph using the MCP server.

**Time**: 10-15 minutes

---

## Setup

### 1. Get Your Local API Token

In Roam Desktop:
1. Settings → Graph → Local API Tokens
2. Click "New Token"
3. Click "Approve" in the dialog
4. Copy the token (looks like: `roam-graph-local-token-abc123...`)

Save this token - you'll need it below.

### 2. Get Your Graph Name

In Roam Desktop:
- Settings → Graph
- Your graph name (e.g., "Project_Kinergy")

### 3. Run the Proof of Concept Script

**macOS/Linux**:
```bash
chmod +x roam-mcp-poc.sh
./roam-mcp-poc.sh
```

**Windows (PowerShell)**:
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope CurrentUser
.\roam-mcp-poc.ps1
```

---

## What Happens

The script will:

1. **Install** roam-research-mcp globally
2. **Create** `.env` file with placeholders
3. **Ask you to edit** `.env` with your token and graph name
4. **Run again** after you edit
5. **Connect** to Roam Desktop
6. **Fetch** pages from your graph
7. **Show** the results

---

## Edit the .env File

The script creates `.env`:

```
ROAM_API_TOKEN=roam-graph-local-token-REPLACE_WITH_YOUR_TOKEN
ROAM_GRAPH_NAME=REPLACE_WITH_YOUR_GRAPH_NAME
```

**Replace these values**:
- `roam-graph-local-token-REPLACE_WITH_YOUR_TOKEN` → Your actual token from Step 1
- `REPLACE_WITH_YOUR_GRAPH_NAME` → Your graph name from Step 2

**Example:**
```
ROAM_API_TOKEN=roam-graph-local-token-abc123def456
ROAM_GRAPH_NAME=Project_Kinergy
```

---

## Expected Output

If successful, you'll see:

```
STEP 3: Checking Roam Desktop
✓ Connected to Roam Desktop

STEP 4: Read from Roam Graph
Fetching pages from your graph...
Command: roam search --query '[:find ?title :where [?p :node/title ?title]]' --limit 5

✓ SUCCESS - Data returned from Roam:

Home
Daily Notes
Test Cases
Project Roadmap
[...]

✓ Pages found: 5

================================================
✅ PROOF OF CONCEPT SUCCESSFUL
================================================

Your Roam graph is accessible via MCP
```

---

## If It Fails

| Error | Fix |
|-------|-----|
| `roam: command not found` | Try: `npm install -g roam-research-mcp` |
| `ECONNREFUSED` | Start Roam Desktop app |
| `Invalid token` | Copy token again from Roam Settings |
| `Graph not found` | Check graph name matches exactly |

---

## Next Step

Once this works, we'll integrate into QA Ops application code.
