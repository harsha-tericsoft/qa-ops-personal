# Roam MCP Verification - Quick Start Checklist
**Time to Complete**: 30-45 minutes  
**What You'll Prove**: Your Roam graph is accessible via MCP and local API works

---

## ✅ Before You Start

```bash
# 1. Verify Node.js is installed
node --version
# Expected: v18.0.0 or higher

# 2. Verify Roam Desktop is running
# macOS: Look for Roam icon in menu bar
# Windows: Look for Roam in system tray
# It should be open and logged in
```

---

## 🔑 Step 1: Get Your Local API Token (2 minutes)

**In Roam Desktop App**:
1. Click **Settings** (gear icon)
2. Go to **Graph** tab
3. Look for **Local API Tokens** section
4. Click **"New Token"**
5. A dialog will appear - click **"Approve"**
6. **Copy the token** (it looks like: `roam-graph-local-token-abc123...`)
7. Save it somewhere safe - you'll need it in Step 3

**Note**: Keep this token secret - it's like a password!

---

## 📦 Step 2: Install MCP Server (3 minutes)

```bash
# Open terminal/PowerShell and run:
npm install -g roam-research-mcp

# Verify it installed
roam --version
# Should show: roam-research-mcp v2.19.1 (or similar)
```

**If this fails**:
- Ensure Node.js v18+ is installed
- On macOS/Linux, might need: `sudo npm install -g roam-research-mcp`
- On Windows, might need to run PowerShell as Administrator

---

## ⚙️ Step 3: Configure Environment (2 minutes)

**Create `.env` file** in your working directory:

### Option A: macOS/Linux
```bash
cat > .env << 'EOF'
ROAM_API_TOKEN=roam-graph-local-token-paste-your-token-here
ROAM_GRAPH_NAME=your-graph-name
EOF
```

### Option B: Windows PowerShell
```powershell
"ROAM_API_TOKEN=roam-graph-local-token-paste-your-token-here" | Out-File .env
"ROAM_GRAPH_NAME=your-graph-name" | Out-File .env -Append
```

### Option C: Manual
1. Create a file named `.env`
2. Add these two lines:
   ```
   ROAM_API_TOKEN=roam-graph-local-token-paste-your-token-here
   ROAM_GRAPH_NAME=your-graph-name
   ```

**Fill in your values**:
- Replace `roam-graph-local-token-paste-your-token-here` with token from Step 1
- Replace `your-graph-name` with your actual Roam graph name (e.g., "Project_Kinergy")

**Find your graph name**:
- In Roam Desktop, check Settings → Graph
- Should be the name of your database

---

## 🔗 Step 4: Test Connection (2 minutes)

```bash
# Verify connection works
roam status

# Expected output:
# ✓ Connected to graph: your-graph-name
# ✓ MCP Server: Ready
# ✓ Local API Token: ••••••••••••••••
```

**If this fails**: See troubleshooting section at bottom

---

## 📖 Step 5: Read Data (10 minutes)

Run these commands one by one. **Save the output** - you'll need it for the report.

### Test A: List Pages
```bash
roam search --query '[:find ?title :where [?p :node/title ?title]]' --limit 10
```
✅ **Success if**: You see a list of page names from your Roam graph

### Test B: Count Total Blocks
```bash
roam search --query '[:find (count ?b) :where [?b :block/string]]'
```
✅ **Success if**: You see a number (total block count)

### Test C: Search Content
```bash
roam search --text "test" --limit 5
```
✅ **Success if**: You see blocks containing the word "test"

### Test D: Search by Tag
```bash
# Replace "qa-ops" with a tag that exists in your graph
roam search --tag "qa-ops" --limit 5
```
✅ **Success if**: You see blocks with that tag (or "no results")

---

## ✏️ Step 6: Write & Delete Data (10 minutes)

### Test A: Create Test Page
```bash
roam create --title "MCP_VERIFICATION_TEST_TEMP"
```
✅ **Success if**: You see a UID returned (looks like: `abc123-def456...`)

**SAVE THIS UID** - you'll need it for cleanup!

### Test B: Append Block
```bash
roam add-block --parent-title "MCP_VERIFICATION_TEST_TEMP" --content "This is a test block"
```
✅ **Success if**: Another UID is returned

### Test C: Verify Write Worked
```bash
roam fetch --title "MCP_VERIFICATION_TEST_TEMP" --children
```
✅ **Success if**: You see your test page with the block you just added

### Test D: Clean Up (Delete Test Page)
```bash
# Replace abc123-def456... with the UID from Test A
roam delete --uid "abc123-def456..."
```
✅ **Success if**: You see a success message

---

## 📋 Step 7: Fill in Evidence Report (5 minutes)

1. **Open** `ROAM_VERIFICATION_RESULTS_TEMPLATE.md`
2. **Fill in all fields** based on your test results above
3. **Copy-paste exact output** from terminal into report
4. **Save as** `ROAM_VERIFICATION_RESULTS.md`

---

## ✅ Success Criteria

**You've successfully verified if**:

- [ ] ✅ `roam status` shows "Connected"
- [ ] ✅ Test A returned page names
- [ ] ✅ Test B returned a number
- [ ] ✅ Test C returned search results
- [ ] ✅ Test D created a page with UID
- [ ] ✅ Test E appended a block
- [ ] ✅ Test F verified block visible
- [ ] ✅ Test G deleted page successfully
- [ ] ✅ Evidence report completed

**If 7-8 tests pass** → ✅ **READY FOR QA OPS IMPLEMENTATION**

---

## ❌ Troubleshooting

| Problem | Solution |
|---------|----------|
| `roam: command not found` | Run: `npm install -g roam-research-mcp` |
| `ECONNREFUSED` | Start Roam Desktop app |
| `Invalid token` | Copy token again from Roam Settings |
| `Graph not found` | Verify graph name matches Roam exactly |
| `Permission denied` | Use `sudo npm install -g roam-research-mcp` (macOS/Linux) |
| No results on search | Normal - depends on content in your graph |

---

## 📧 What to Submit

After completing verification:

1. **Save output** to `ROAM_VERIFICATION_RESULTS.md`
2. **Include**:
   - All test results (copy-paste exact output)
   - Page titles returned
   - Block count
   - Sample content
   - Write operation success/failure
   - Overall conclusion (Ready/Not Ready)

**DO NOT INCLUDE** in report:
- ❌ Your actual Local API Token value
- ❌ Real page content (use sample data)
- ❌ Any private/sensitive information

---

## ⏱️ Time Breakdown

| Step | Time | Activity |
|------|------|----------|
| 1 | 2 min | Get Local API Token |
| 2 | 3 min | Install MCP server |
| 3 | 2 min | Configure .env |
| 4 | 2 min | Test connection |
| 5 | 10 min | Run read tests |
| 6 | 10 min | Run write/delete tests |
| 7 | 5 min | Fill in report |
| **Total** | **~34 min** | **Full verification** |

---

## 🎯 Next Steps

### After Successful Verification ✅

1. Submit evidence report `ROAM_VERIFICATION_RESULTS.md`
2. Get approval to proceed
3. Begin QA Ops implementation:
   - Install MCP client in QA Ops
   - Create API routes to access Roam
   - Build UI components
   - Test end-to-end

### If Verification Fails ❌

1. Review troubleshooting section
2. Rerun failed tests
3. Update report with new results
4. Resubmit

---

## 💡 Important Notes

1. **Roam Desktop must be running** - Keep app open during verification
2. **Token is sensitive** - Treat like a password, don't share
3. **Test data will be created** - You'll clean it up automatically
4. **Graph won't be modified** - Only adds/removes test data
5. **Verify can be repeated** - Run multiple times if needed

---

## 📞 Need Help?

If something fails:

1. **Check troubleshooting** section above
2. **Re-read the full guide**: `ROAM_MCP_VERIFICATION_GUIDE.md`
3. **Check GitHub issues**: https://github.com/2b3pro/roam-research-mcp/issues
4. **Document the error** exactly and include in report

---

## ✨ Ready to Start?

1. ✅ Open Roam Desktop app
2. ✅ Get Local API Token (Step 1)
3. ✅ Run verification (Steps 2-6)
4. ✅ Fill in report (Step 7)
5. ✅ Submit evidence

**Estimated total time: 30-45 minutes**

Good luck! 🚀
