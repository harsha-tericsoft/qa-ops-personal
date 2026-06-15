#!/bin/bash

# Roam MCP Proof of Concept - Minimal Working Example
# This script installs and tests the MCP server with your Roam graph

set -e

echo "================================================"
echo "Roam MCP Proof of Concept"
echo "================================================"
echo ""

# Step 1: Installation
echo "STEP 1: Installing roam-research-mcp"
echo "Command: npm install -g roam-research-mcp"
echo ""

npm install -g roam-research-mcp

echo "✓ Installation complete"
echo ""

# Verify installation
echo "Verifying installation..."
INSTALLED_VERSION=$(roam --version 2>/dev/null || echo "NOT INSTALLED")
echo "Installed version: $INSTALLED_VERSION"
echo ""

# Step 2: Configuration
echo "================================================"
echo "STEP 2: Configuration"
echo "================================================"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cat > .env << 'EOF'
ROAM_API_TOKEN=roam-graph-local-token-REPLACE_WITH_YOUR_TOKEN
ROAM_GRAPH_NAME=REPLACE_WITH_YOUR_GRAPH_NAME
EOF
    echo "✓ .env file created"
    echo ""
    echo "EDIT THIS FILE AND ADD:"
    echo "  1. Your Local API Token (from Roam Settings → Graph → Local API Tokens)"
    echo "  2. Your graph name (from Roam Settings → Graph)"
    echo ""
    cat .env
    echo ""
    echo "After editing .env, run this script again"
    exit 1
else
    echo "✓ .env file exists"
    echo "Contents:"
    cat .env
    echo ""
fi

# Load environment
source .env

echo "Configuration loaded:"
echo "  Graph: $ROAM_GRAPH_NAME"
echo "  Token: ${ROAM_API_TOKEN:0:30}..."
echo ""

# Step 3: Verify Roam Desktop is running
echo "================================================"
echo "STEP 3: Checking Roam Desktop"
echo "================================================"
echo ""

# Try to connect to Roam
echo "Testing connection to Roam Desktop..."
timeout 5 roam status 2>/dev/null || {
    echo "❌ Cannot connect to Roam Desktop"
    echo "Make sure:"
    echo "  1. Roam Desktop app is running"
    echo "  2. You are logged in"
    echo "  3. Port 7654 is accessible (localhost)"
    exit 1
}
echo "✓ Connected to Roam Desktop"
echo ""

# Step 4: List pages (simplest read operation)
echo "================================================"
echo "STEP 4: Read from Roam Graph"
echo "================================================"
echo ""

echo "Fetching pages from your graph..."
echo "Command: roam search --query '[:find ?title :where [?p :node/title ?title]]' --limit 5"
echo ""

RESULT=$(roam search --query '[:find ?title :where [?p :node/title ?title]]' --limit 5 2>&1)

if [ $? -eq 0 ]; then
    echo "✓ SUCCESS - Data returned from Roam:"
    echo ""
    echo "$RESULT"
    echo ""

    # Count pages
    PAGE_COUNT=$(echo "$RESULT" | grep -c "^" || echo "0")
    echo "✓ Pages found: $PAGE_COUNT"
    echo ""

    echo "================================================"
    echo "✅ PROOF OF CONCEPT SUCCESSFUL"
    echo "================================================"
    echo ""
    echo "Your Roam graph is accessible via MCP"
    echo "Next step: Integrate into QA Ops application"
else
    echo "❌ FAILED to fetch pages"
    echo "Error: $RESULT"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check .env file has correct token and graph name"
    echo "  2. Verify Roam Desktop is running"
    echo "  3. Try: roam status"
    exit 1
fi
