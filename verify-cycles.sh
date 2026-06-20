#!/bin/bash
set -e

echo "======================================================================"
echo "BROWSER VERIFICATION: Execution Cycles"
echo "======================================================================"

# Start fresh
pkill -f "next dev" || true
sleep 2
npm run dev > /dev/null 2>&1 &
sleep 5

echo "✓ Server started"

# Create test using npx playwright
npx playwright codegen http://localhost:3000 --output test.js 2>&1 &
PID=$!

sleep 2
kill $PID 2>/dev/null || true

echo "✓ Ready for browser testing"
echo ""
echo "Steps to test:"
echo "1. Navigate to /test-suites"
echo "2. Create a test suite with 5+ tests"
echo "3. Navigate to /cycles"  
echo "4. Create execution cycle from that suite"
echo "5. Set 2 PASS, 2 FAIL, 1 BLOCKED"
echo "6. Refresh and verify counts persist"
echo "7. Check database counts match UI"
echo ""
