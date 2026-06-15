# Roam MCP Proof of Concept - Minimal Working Example (Windows PowerShell)
# This script installs and tests the MCP server with your Roam graph

$ErrorActionPreference = "Stop"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Roam MCP Proof of Concept (Windows)" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Installation
Write-Host "STEP 1: Installing roam-research-mcp" -ForegroundColor Yellow
Write-Host "Command: npm install -g roam-research-mcp" -ForegroundColor Gray
Write-Host ""

try {
    npm install -g roam-research-mcp
    Write-Host "`u{2713} Installation complete" -ForegroundColor Green
} catch {
    Write-Host "`u{2717} Installation failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Verify installation
Write-Host "Verifying installation..." -ForegroundColor Gray
try {
    $InstalledVersion = & roam --version 2>$null
    Write-Host "Installed version: $InstalledVersion" -ForegroundColor Green
} catch {
    Write-Host "Failed to get version" -ForegroundColor Red
}
Write-Host ""

# Step 2: Configuration
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "STEP 2: Configuration" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (!(Test-Path ".env")) {
    Write-Host "Creating .env file..." -ForegroundColor Yellow
    @"
ROAM_API_TOKEN=roam-graph-local-token-REPLACE_WITH_YOUR_TOKEN
ROAM_GRAPH_NAME=REPLACE_WITH_YOUR_GRAPH_NAME
"@ | Out-File -FilePath ".env" -Encoding UTF8

    Write-Host "`u{2713} .env file created" -ForegroundColor Green
    Write-Host ""
    Write-Host "EDIT THIS FILE AND ADD:" -ForegroundColor Yellow
    Write-Host "  1. Your Local API Token (from Roam Settings → Graph → Local API Tokens)" -ForegroundColor Gray
    Write-Host "  2. Your graph name (from Roam Settings → Graph)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "File contents:" -ForegroundColor Gray
    Get-Content ".env"
    Write-Host ""
    Write-Host "After editing .env, run this script again" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "`u{2713} .env file exists" -ForegroundColor Green
    Write-Host "Contents:" -ForegroundColor Gray
    Get-Content ".env" | Write-Host
    Write-Host ""
}

# Load environment variables from .env
$EnvFile = Get-Content ".env"
foreach ($line in $EnvFile) {
    if ($line -match "^\s*#" -or $line -match "^\s*$") { continue }
    if ($line -match "^([^=]+)=(.*)$") {
        [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), "Process")
    }
}

$RoamGraphName = [System.Environment]::GetEnvironmentVariable("ROAM_GRAPH_NAME", "Process")
$RoamApiToken = [System.Environment]::GetEnvironmentVariable("ROAM_API_TOKEN", "Process")

Write-Host "Configuration loaded:" -ForegroundColor Gray
Write-Host "  Graph: $RoamGraphName" -ForegroundColor Gray
Write-Host "  Token: $($RoamApiToken.Substring(0, [Math]::Min(30, $RoamApiToken.Length)))..." -ForegroundColor Gray
Write-Host ""

# Step 3: Verify Roam Desktop is running
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "STEP 3: Checking Roam Desktop" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Testing connection to Roam Desktop..." -ForegroundColor Gray

try {
    $Status = & roam status 2>$null
    Write-Host "`u{2713} Connected to Roam Desktop" -ForegroundColor Green
    Write-Host "$Status" -ForegroundColor Gray
} catch {
    Write-Host "`u{2717} Cannot connect to Roam Desktop" -ForegroundColor Red
    Write-Host "Make sure:" -ForegroundColor Yellow
    Write-Host "  1. Roam Desktop app is running" -ForegroundColor Gray
    Write-Host "  2. You are logged in" -ForegroundColor Gray
    Write-Host "  3. Port 7654 is accessible (localhost)" -ForegroundColor Gray
    exit 1
}
Write-Host ""

# Step 4: List pages (simplest read operation)
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "STEP 4: Read from Roam Graph" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Fetching pages from your graph..." -ForegroundColor Gray
$Query = '[:find ?title :where [?p :node/title ?title]]'
Write-Host "Command: roam search --query '$Query' --limit 5" -ForegroundColor Gray
Write-Host ""

try {
    $Result = & roam search --query $Query --limit 5 2>&1

    Write-Host "`u{2713} SUCCESS - Data returned from Roam:" -ForegroundColor Green
    Write-Host ""
    Write-Host "$Result" -ForegroundColor White
    Write-Host ""

    # Count pages
    $PageCount = ($Result | Measure-Object -Line).Lines
    Write-Host "`u{2713} Pages found: $PageCount" -ForegroundColor Green
    Write-Host ""

    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "`u{2705} PROOF OF CONCEPT SUCCESSFUL" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Your Roam graph is accessible via MCP" -ForegroundColor Green
    Write-Host "Next step: Integrate into QA Ops application" -ForegroundColor Green

} catch {
    Write-Host "`u{2717} FAILED to fetch pages" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Check .env file has correct token and graph name" -ForegroundColor Gray
    Write-Host "  2. Verify Roam Desktop is running" -ForegroundColor Gray
    Write-Host "  3. Try: roam status" -ForegroundColor Gray
    exit 1
}
