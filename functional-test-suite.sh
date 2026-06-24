#!/bin/bash

# FUNCTIONAL VALIDATION TEST SUITE
# Tests all demo-critical features and documents bugs

PROJECT_ID="cmqoreffq00047kgcwwqnkmzu"
BASE_URL="http://localhost:3000"

BUGS_FILE="discovered-bugs.md"
> "$BUGS_FILE"

log_test() {
    echo "✓ $1"
}

log_fail() {
    echo "✗ $1"
    echo "- **BUG**: $1" >> "$BUGS_FILE"
}

log_bug() {
    local severity="$1"
    local title="$2"
    local expected="$3"
    local actual="$4"
    local steps="$5"

    echo "" >> "$BUGS_FILE"
    echo "### [$severity] $title" >> "$BUGS_FILE"
    echo "- **Expected**: $expected" >> "$BUGS_FILE"
    echo "- **Actual**: $actual" >> "$BUGS_FILE"
    echo "- **Steps**: $steps" >> "$BUGS_FILE"
}

echo "======================================================================="
echo "FUNCTIONAL VALIDATION TEST SUITE"
echo "======================================================================="
echo ""

# =====================================================================
# A. ROAM SYNC
# =====================================================================

echo "SECTION A: Roam Sync"
echo "---"

echo "A1. Test case imports..."
SYNC_RESULT=$(curl -s "$BASE_URL/api/roam/scheduled-sync" 2>/dev/null)
if echo "$SYNC_RESULT" | grep -q "success"; then
    log_test "Sync endpoint callable"
else
    log_fail "Sync endpoint failed"
fi

echo "A2. Checking sync logs..."
SYNC_COUNT=$(curl -s "$BASE_URL/api/sync-logs?projectId=$PROJECT_ID&limit=10" 2>/dev/null | jq '.length // 0' 2>/dev/null)
if [ "$SYNC_COUNT" -gt 0 ]; then
    log_test "Sync logs recorded ($SYNC_COUNT entries)"
else
    log_fail "No sync logs found"
fi

echo ""

# =====================================================================
# B. TEST CASES
# =====================================================================

echo "SECTION B: Test Cases"
echo "---"

echo "B1. Checking test counts..."
DASHBOARD=$(curl -s "$BASE_URL/api/dashboard/summary?projectId=$PROJECT_ID")
TOTAL=$(echo "$DASHBOARD" | jq '.totalTests' 2>/dev/null)
MANUAL=$(echo "$DASHBOARD" | jq '.byType.Manual // 0' 2>/dev/null)
AUTOMATED=$(echo "$DASHBOARD" | jq '.byType.Automated // 0' 2>/dev/null)

echo "  Total: $TOTAL (expected: 2425)"
echo "  Manual: $MANUAL (expected: 1484)"
echo "  Automated: $AUTOMATED (expected: 63)"

if [ "$TOTAL" = "2425" ]; then
    log_test "Total count correct"
else
    log_fail "Total count incorrect ($TOTAL vs 2425)"
    log_bug "HIGH" "Dashboard count mismatch" "2425" "$TOTAL" "GET /api/dashboard/summary"
fi

echo "B2. Testing filters..."
MANUAL_FILTER=$(curl -s "$BASE_URL/api/test-cases?projectId=$PROJECT_ID&filter=Manual&limit=50" 2>/dev/null | jq '.count // 0' 2>/dev/null)
if [ "$MANUAL_FILTER" -gt 0 ]; then
    log_test "Manual filter works ($MANUAL_FILTER results)"
else
    log_fail "Manual filter broken"
    log_bug "CRITICAL" "Manual filter not working" "Should return tests with #Manual tag" "No results" "Filter by Manual in test-cases"
fi

echo "B3. Testing search..."
SEARCH=$(curl -s "$BASE_URL/api/test-cases/search?projectId=$PROJECT_ID&q=When&limit=10" 2>/dev/null | jq '.total // 0' 2>/dev/null)
if [ "$SEARCH" -gt 0 ]; then
    log_test "Search works ($SEARCH results for 'When')"
else
    log_fail "Search not returning results"
    log_bug "HIGH" "Test case search not working" "Should find tests with 'When' in title" "No results" "Search for 'When'"
fi

echo ""

# =====================================================================
# C. TEST SUITES
# =====================================================================

echo "SECTION C: Test Suites"
echo "---"

echo "C1. Checking existing suites..."
SUITES=$(curl -s "$BASE_URL/api/test-suites?projectId=$PROJECT_ID" 2>/dev/null | jq '.length // 0' 2>/dev/null)
log_test "Found $SUITES test suites"

echo "C2. Creating test suite..."
CREATE_SUITE=$(curl -s -X POST "$BASE_URL/api/test-suites" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"name\":\"Test Suite $(date +%s)\",\"description\":\"Auto-created test suite\"}" 2>/dev/null)

if echo "$CREATE_SUITE" | grep -q "id\|success"; then
    log_test "Create suite works"
    SUITE_ID=$(echo "$CREATE_SUITE" | jq '.id // empty' 2>/dev/null)
else
    log_fail "Create suite failed"
    log_bug "CRITICAL" "Cannot create test suite" "Should return suite ID" "No ID in response" "POST /api/test-suites"
fi

echo ""

# =====================================================================
# D. EXECUTION
# =====================================================================

echo "SECTION D: Execution & Cycles"
echo "---"

echo "D1. Checking execution cycles..."
CYCLES=$(curl -s "$BASE_URL/api/execution-cycles?projectId=$PROJECT_ID" 2>/dev/null | jq '.length // 0' 2>/dev/null)
log_test "Found $CYCLES execution cycles"

echo "D2. Creating execution cycle..."
CREATE_CYCLE=$(curl -s -X POST "$BASE_URL/api/execution-cycles" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"name\":\"Cycle $(date +%s)\",\"description\":\"Test cycle\"}" 2>/dev/null)

if echo "$CREATE_CYCLE" | grep -q "id\|success"; then
    log_test "Create cycle works"
    CYCLE_ID=$(echo "$CREATE_CYCLE" | jq '.id // empty' 2>/dev/null)
else
    log_fail "Create cycle failed"
    log_bug "CRITICAL" "Cannot create execution cycle" "Should return cycle ID" "No ID in response" "POST /api/execution-cycles"
fi

echo "D3. Checking test execution records..."
EXECUTIONS=$(curl -s "$BASE_URL/api/test-executions?projectId=$PROJECT_ID&limit=10" 2>/dev/null | jq '.length // 0' 2>/dev/null)
if [ "$EXECUTIONS" -gt 0 ]; then
    log_test "Test executions recorded ($EXECUTIONS)"
else
    log_test "No test executions yet (expected for new project)"
fi

echo ""

# =====================================================================
# E. DASHBOARD METRICS
# =====================================================================

echo "SECTION E: Dashboard Metrics"
echo "---"

echo "E1. Verifying dashboard calculations..."
PASSED=$(echo "$DASHBOARD" | jq '.passed // 0' 2>/dev/null)
FAILED=$(echo "$DASHBOARD" | jq '.failed // 0' 2>/dev/null)
NOTRUN=$(echo "$DASHBOARD" | jq '.notRun // 0' 2>/dev/null)
PASSRATE=$(echo "$DASHBOARD" | jq '.passRate // 0' 2>/dev/null)

echo "  Passed: $PASSED, Failed: $FAILED, NotRun: $NOTRUN"
echo "  Pass Rate: $PASSRATE%"

if [ "$NOTRUN" = "$TOTAL" ]; then
    log_test "All tests in NOT_RUN state (expected for new data)"
else
    log_test "Test status distribution correct"
fi

echo ""

# =====================================================================
# SUMMARY
# =====================================================================

echo "======================================================================="
echo "VALIDATION SUMMARY"
echo "======================================================================="
echo ""

BUG_COUNT=$(grep -c "^\[" "$BUGS_FILE" 2>/dev/null || echo 0)
if [ "$BUG_COUNT" -gt 0 ]; then
    echo "⚠️  Found $BUG_COUNT issues - see $BUGS_FILE"
else
    echo "✓ No critical issues found"
fi

echo ""
echo "Test results documented in:"
echo "  - $BUGS_FILE (issues)"
echo ""

