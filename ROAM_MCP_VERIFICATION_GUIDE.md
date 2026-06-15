# Roam MCP End-to-End Verification Guide
**Date**: 2026-06-12  
**Purpose**: Verify MCP server works with your actual Local API Token  
**Expected Duration**: 30-45 minutes

---

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] Roam Desktop application installed and working
- [ ] Node.js v18 or later: `node --version` (should be v18+)
- [ ] npm: `npm --version` (should be v9+)
- [ ] One test page in your Roam graph with sample content
- [ ] Local API Token generated (see Step 1)

---

## Step 1: Generate Local API Token (if not already done)

**In Roam Desktop Application**:

1. Open Roam Desktop app (ensure it's logged in)
2. Navigate to **Settings** (gear icon)
3. Go to **Graph** tab → **Local API Tokens**
4. Click **"New Token"**
5. A dialog will appear asking to approve the new token
6. **Click "Approve"** in the dialog
7. Copy the generated token (format: `roam-graph-local-token-XXXXXX`)
8. **Save this token** - you'll need it in Step 3

**Screenshot Location**: Should show in Roam Settings → Graph → Local API Tokens

---

## Step 2: Verify Prerequisites

Open terminal/PowerShell and run:

```bash
# Check Node.js version (need v18+)
node --version
# Expected: v18.0.0 or higher

# Check npm version (need v9+)
npm --version
# Expected: v9.0.0 or higher

# Check Roam Desktop is running
# macOS: Look for Roam in menu bar
# Windows: Look for Roam in system tray
# Linux: `ps aux | grep -i roam`
```

If Node.js is not v18+, install/upgrade it from nodejs.org

---

## Step 3: Install MCP Server

```bash
# Install globally (recommended)
npm install -g roam-research-mcp

# Verify installation
roam --version
# Expected output: roam-research-mcp v2.19.1 (or similar)

# Check installation location
npm list -g roam-research-mcp
# Should show the package location
```

**If installation fails**:
```bash
# Try with elevated permissions (Windows)
npm install -g roam-research-mcp --allow-global

# Or install locally in a project directory
mkdir roam-test
cd roam-test
npm init -y
npm install roam-research-mcp
```

---

## Step 4: Configure Environment Variables

Create a `.env` file in your working directory:

```bash
# Option A: Create .env file manually
cat > .env << 'EOF'
ROAM_API_TOKEN=roam-graph-local-token-XXXXXX
ROAM_GRAPH_NAME=your-graph-name
EOF

# Option B: Using PowerShell (Windows)
echo 'ROAM_API_TOKEN=roam-graph-local-token-XXXXXX' > .env
echo 'ROAM_GRAPH_NAME=your-graph-name' >> .env

# Option C: Set as environment variables (temporary, for this session only)
export ROAM_API_TOKEN="roam-graph-local-token-XXXXXX"
export ROAM_GRAPH_NAME="your-graph-name"
```

**Fill in your values**:
- Replace `roam-graph-local-token-XXXXXX` with your actual token from Step 1
- Replace `your-graph-name` with your actual Roam graph name (e.g., "Project_Kinergy")

**Find your graph name**:
- In Roam Desktop, look at the window title or Settings → Graph
- Should be visible in the URL or as the database name

---

## Step 5: Verify Connection

```bash
# Test basic connection
roam status

# Expected output:
# ✓ Connected to graph: your-graph-name
# ✓ MCP Server Ready
# ✓ Local API Token: ••••••••••••••••
```

**If connection fails**:

| Error | Cause | Solution |
|-------|-------|----------|
| `ECONNREFUSED` | Roam Desktop not running | Start Roam Desktop app |
| `Invalid token` | Wrong token format | Check token from Step 1 |
| `Graph not found` | Wrong graph name | Verify graph name in Roam |
| `Permission denied` | Token not approved | Generate new token, approve dialog |

---

## Step 6: Execute Test Queries

### Test 6A: List All Pages

```bash
# Get all page titles
roam search --query '[:find ?title :where [?p :node/title ?title]]' --limit 10
```

**Expected output**: List of page titles from your graph
```
Found 10 pages:
- Home
- Daily Notes
- Test Cases
- Project Roadmap
[...]
```

**Save this output** - you'll need it for the report.

### Test 6B: Count All Blocks

```bash
# Count total blocks in graph
roam search --query '[:find (count ?b) :where [?b :block/string]]'
```

**Expected output**: Single number representing total block count
```
Total blocks: 2,345
```

### Test 6C: Search for Content

If you have test data in Roam, search for it:

```bash
# Replace "test" with a word from your actual content
roam search --text "test" --limit 5
```

**Expected output**: Blocks containing that text
```
Results matching "test":
1. uid-123: "This is a test block"
2. uid-456: "Test case: login flow"
[...]
```

### Test 6D: Search by Tag (if you have tagged content)

```bash
# Search for blocks with specific tag
roam search --tag "qa-ops" --limit 5
# Or: roam search --tag "test" --limit 5
```

**Expected output**: Blocks with that tag
```
Results with tag "#qa-ops":
1. uid-789: "Test case for login"
[...]
```

---

## Step 7: Verify Write Permissions

### Test 7A: Create Temporary Test Page

```bash
# Create a temporary page for testing
roam create --title "MCP_VERIFICATION_TEST_$(date +%s)"
```

**Expected output**: 
```
✓ Page created
UID: page-uid-12345
Title: MCP_VERIFICATION_TEST_1718205600
URL: roam-graph://page-uid-12345
```

**Save the UID** - you'll need it to delete this page later.

### Test 7B: Append Test Block to the Page

```bash
# Append a block to the test page
roam add-block \
  --parent-title "MCP_VERIFICATION_TEST_*" \
  --content "This is a verification test block created via MCP - $(date)"
```

**Expected output**:
```
✓ Block appended
UID: block-uid-67890
Parent: MCP_VERIFICATION_TEST_1718205600
Content: This is a verification test block created via MCP - 2026-06-12
```

### Test 7C: Verify Write Succeeded

```bash
# Fetch the page you just created
roam fetch --title "MCP_VERIFICATION_TEST_*" --children

# Should show your page with the appended block
```

**Expected output**: Your page content including the test block

### Test 7D: Clean Up (Delete Test Data)

```bash
# Delete the test page (use the UID from Test 7A)
roam delete --uid "page-uid-12345"

# Expected output: ✓ Page deleted

# Verify it's gone
roam fetch --title "MCP_VERIFICATION_TEST_*"
# Should return: "Page not found"
```

---

## Step 8: Advanced Verification (Datalog Query)

For advanced testing, run a raw Datalog query:

```bash
# Query recent blocks (created in last 7 days)
roam query '[:find ?block ?created 
           :where [?b :block/string ?block]
                  [?b :create/time ?created]
                  [(> ?created (- (now) (* 7 24 60 60 1000)))]
           :limit 5]'
```

**Expected output**: Recent blocks with timestamps

---

## Step 9: Collect Data for Evidence Report

Create a file `ROAM_VERIFICATION_RESULTS.md` and fill in the following:

```markdown
# Roam MCP Verification Results

## Environment
- Node.js version: [Run: node --version]
- npm version: [Run: npm --version]
- roam-research-mcp version: [Run: roam --version]
- Roam Desktop version: [Check in Roam Settings]
- Graph name: [Your graph name]

## Connection Test
- Status: [Connected/Failed]
- Connection command: roam status
- Output: [Paste output here]

## Data Query Results

### Test 6A: List Pages
Command: roam search --query '[:find ?title :where [?p :node/title ?title]]' --limit 10
Results:
[Paste output here]
- Total pages found: [number]

### Test 6B: Count Blocks
Command: roam search --query '[:find (count ?b) :where [?b :block/string]]'
Results:
- Total blocks: [number]

### Test 6C: Search Content
Command: roam search --text "test" --limit 5
Results:
[Paste output here]
- Blocks found: [number]

### Test 6D: Search by Tag
Command: roam search --tag "[your-tag]" --limit 5
Results:
[Paste output here]
- Tagged blocks found: [number]

## Write Permission Tests

### Test 7A: Create Page
Command: roam create --title "MCP_VERIFICATION_TEST_$(date +%s)"
Result: Success / Failed
Page UID created: [uid]
Error (if any): [error message]

### Test 7B: Append Block
Command: roam add-block --parent-title "MCP_VERIFICATION_TEST_*" --content "..."
Result: Success / Failed
Block UID: [uid]
Error (if any): [error message]

### Test 7C: Verify Write
Command: roam fetch --title "MCP_VERIFICATION_TEST_*" --children
Result: Success / Failed
Block visible: Yes / No
Error (if any): [error message]

### Test 7D: Clean Up
Command: roam delete --uid "[uid-from-test-7a]"
Result: Success / Failed
Deletion verified: Yes / No
Error (if any): [error message]

## Summary
- Read operations: ✅ Working / ❌ Failed
- Write operations: ✅ Working / ❌ Failed
- Delete operations: ✅ Working / ❌ Failed
- Overall status: ✅ Verified / ⚠️ Partial / ❌ Failed

## Issues Encountered (if any)
[List any errors, connection issues, timeouts, etc.]

## Conclusion
[Brief summary: Can QA Ops use MCP to access this Roam graph? Yes/No]
```

---

## Automated Verification Script

Save this as `verify-roam-mcp.sh` (macOS/Linux) or `verify-roam-mcp.ps1` (Windows):

### For macOS/Linux:

```bash
#!/bin/bash

echo "=== Roam MCP Verification Script ==="
echo "Time: $(date)"
echo ""

# Check prerequisites
echo "1. Checking prerequisites..."
node --version || echo "❌ Node.js not found"
npm --version || echo "❌ npm not found"
echo ""

# Check MCP server
echo "2. Checking MCP server installation..."
roam --version || echo "❌ roam-research-mcp not installed"
echo ""

# Test connection
echo "3. Testing connection to Roam..."
roam status
echo ""

# Test read: List pages
echo "4. Testing read: List pages..."
roam search --query '[:find ?title :where [?p :node/title ?title]]' --limit 5
echo ""

# Test read: Count blocks
echo "5. Testing read: Count blocks..."
roam search --query '[:find (count ?b) :where [?b :block/string]]'
echo ""

# Test write: Create page
echo "6. Testing write: Create test page..."
TEST_PAGE_NAME="MCP_VERIFICATION_TEST_$(date +%s)"
roam create --title "$TEST_PAGE_NAME"
TEST_UID=$(roam fetch --title "$TEST_PAGE_NAME" --uid-only 2>/dev/null || echo "FAILED")
echo "Created page UID: $TEST_UID"
echo ""

# Test write: Append block
if [ "$TEST_UID" != "FAILED" ]; then
  echo "7. Testing write: Append test block..."
  roam add-block --parent-title "$TEST_PAGE_NAME" --content "MCP Verification test block - $(date)"
  echo ""
  
  # Verify
  echo "8. Verifying write succeeded..."
  roam fetch --title "$TEST_PAGE_NAME" --children
  echo ""
  
  # Clean up
  echo "9. Cleaning up test page..."
  roam delete --uid "$TEST_UID"
  echo "✓ Test page deleted"
else
  echo "❌ Could not create test page, skipping cleanup"
fi

echo ""
echo "=== Verification Complete ==="
```

### For Windows PowerShell:

```powershell
# Save as verify-roam-mcp.ps1

Write-Host "=== Roam MCP Verification Script ===" -ForegroundColor Cyan
Write-Host "Time: $(Get-Date)" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "1. Checking prerequisites..." -ForegroundColor Yellow
node --version
npm --version
Write-Host ""

# Check MCP server
Write-Host "2. Checking MCP server installation..." -ForegroundColor Yellow
roam --version
Write-Host ""

# Test connection
Write-Host "3. Testing connection to Roam..." -ForegroundColor Yellow
roam status
Write-Host ""

# Test read: List pages
Write-Host "4. Testing read: List pages..." -ForegroundColor Yellow
roam search --query '[:find ?title :where [?p :node/title ?title]]' --limit 5
Write-Host ""

# Test read: Count blocks
Write-Host "5. Testing read: Count blocks..." -ForegroundColor Yellow
roam search --query '[:find (count ?b) :where [?b :block/string]]'
Write-Host ""

# Test write: Create page
Write-Host "6. Testing write: Create test page..." -ForegroundColor Yellow
$TestPageName = "MCP_VERIFICATION_TEST_$(Get-Date -Format 'yyyyMMddHHmmss')"
roam create --title $TestPageName
$TestUID = roam fetch --title $TestPageName --uid-only 2>$null
Write-Host "Created page UID: $TestUID" -ForegroundColor Green
Write-Host ""

# Test write: Append block
if ($TestUID -and $TestUID -ne "FAILED") {
  Write-Host "7. Testing write: Append test block..." -ForegroundColor Yellow
  roam add-block --parent-title $TestPageName --content "MCP Verification test block - $(Get-Date)"
  Write-Host ""
  
  # Verify
  Write-Host "8. Verifying write succeeded..." -ForegroundColor Yellow
  roam fetch --title $TestPageName --children
  Write-Host ""
  
  # Clean up
  Write-Host "9. Cleaning up test page..." -ForegroundColor Yellow
  roam delete --uid $TestUID
  Write-Host "✓ Test page deleted" -ForegroundColor Green
} else {
  Write-Host "❌ Could not create test page, skipping cleanup" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Verification Complete ===" -ForegroundColor Cyan
```

**Run the script**:
```bash
# macOS/Linux
chmod +x verify-roam-mcp.sh
./verify-roam-mcp.sh

# Windows PowerShell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope CurrentUser
.\verify-roam-mcp.ps1
```

---

## Troubleshooting

### Issue: `roam: command not found`

**Solutions**:
```bash
# Check if installed globally
npm list -g roam-research-mcp

# If not installed globally, install it
npm install -g roam-research-mcp

# If permission issues, use sudo (macOS/Linux)
sudo npm install -g roam-research-mcp

# Or use npx to run without installing
npx roam-research-mcp status
```

### Issue: `ECONNREFUSED` or `Connection refused`

**Solutions**:
1. Verify Roam Desktop is running (check system tray/menu bar)
2. Try restarting Roam Desktop
3. Check if port 7654 is in use:
   ```bash
   # macOS/Linux
   lsof -i :7654
   
   # Windows
   netstat -ano | findstr :7654
   ```

### Issue: `401 Unauthorized` or `Invalid token`

**Solutions**:
1. Verify token value is correct (copy again from Roam Settings)
2. Check token format starts with `roam-graph-local-token-`
3. Generate a new token in Roam Desktop
4. Ensure token is approved (dialog should appear)

### Issue: `Graph not found`

**Solutions**:
1. Verify graph name matches Roam (check Settings → Graph)
2. Graph name is case-sensitive
3. Try the exact string from Roam window title

---

## Expected Output Summary

**Successful Verification Should Show**:

✅ Connection: `Connected to graph: [name]`  
✅ Pages: List of page titles (minimum 5)  
✅ Blocks: Total count (number > 0)  
✅ Search: Results returned  
✅ Create: Page successfully created with UID  
✅ Append: Block successfully added  
✅ Fetch: New block visible in page content  
✅ Delete: Page successfully deleted  

**Success Threshold**:
- At least 6/7 tests passing = Proceed with implementation
- 5/7 or fewer = Troubleshoot issues before proceeding

---

## Next Steps After Verification

1. **If All Tests Pass** ✅
   - Copy results to `ROAM_VERIFICATION_RESULTS.md`
   - Submit evidence report
   - Ready for QA Ops implementation

2. **If Some Tests Fail** ⚠️
   - Document which tests failed
   - Check troubleshooting section
   - Rerun failed tests
   - Submit evidence report with issues noted

3. **If All Tests Fail** ❌
   - Check Roam Desktop is properly installed
   - Verify Local API Token generation worked
   - Check Node.js/npm versions
   - Try fresh token generation
   - Document all errors in report

---

## Questions to Answer in Report

1. **Can you read page titles from your Roam graph?** Yes/No
2. **Can you count total blocks?** Yes/No
3. **Can you search for content?** Yes/No
4. **Can you search by tags?** Yes/No
5. **Can you create new pages?** Yes/No
6. **Can you append blocks?** Yes/No
7. **Can you delete pages?** Yes/No
8. **Overall: Is MCP integration viable for your use case?** Yes/No

---

## Support

If you encounter issues:

1. Check [2b3pro/roam-research-mcp GitHub Issues](https://github.com/2b3pro/roam-research-mcp/issues)
2. Search for similar error messages
3. Create new issue with:
   - Node.js version
   - MCP server version
   - Roam Desktop version
   - Exact error message
   - Steps to reproduce
