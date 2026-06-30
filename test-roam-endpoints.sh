#!/bin/bash

# Test script for Desktop Connector Roam endpoints
# Tests all three endpoints with various inputs

echo "========================================"
echo "Testing Desktop Connector Roam Endpoints"
echo "========================================"
echo ""

BASE_URL="http://localhost:7890"
PASSED=0
FAILED=0

# Test 1: API Info endpoint
echo "[TEST 1] GET / - API Info Endpoint"
RESPONSE=$(curl -s "$BASE_URL/")
if echo "$RESPONSE" | grep -q "roam.test-connection"; then
    echo "✅ PASS - Roam endpoints documented"
    ((PASSED++))
else
    echo "❌ FAIL - Roam endpoints not in API info"
    ((FAILED++))
fi
echo ""

# Test 2: Health endpoint
echo "[TEST 2] GET /health - Health Check"
RESPONSE=$(curl -s "$BASE_URL/health")
if echo "$RESPONSE" | grep -q "healthy"; then
    echo "✅ PASS - Server is healthy"
    ((PASSED++))
else
    echo "❌ FAIL - Server health check failed"
    ((FAILED++))
fi
echo ""

# Test 3: POST test-connection with valid structure
echo "[TEST 3] POST /api/roam/test-connection - Valid Request Structure"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/roam/test-connection" \
  -H "Content-Type: application/json" \
  -d '{
    "graphName": "TestGraph",
    "apiToken": "test-token-12345"
  }')
if echo "$RESPONSE" | grep -q '"success"'; then
    echo "✅ PASS - Endpoint responds with structured JSON"
    ((PASSED++))
else
    echo "❌ FAIL - Invalid response format"
    ((FAILED++))
fi
echo ""

# Test 4: POST test-connection without apiToken
echo "[TEST 4] POST /api/roam/test-connection - Validation (missing apiToken)"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/roam/test-connection" \
  -H "Content-Type: application/json" \
  -d '{
    "graphName": "TestGraph"
  }')
if echo "$RESPONSE" | grep -q "apiToken is required"; then
    echo "✅ PASS - Properly validates missing fields"
    ((PASSED++))
else
    echo "❌ FAIL - Should validate required fields"
    ((FAILED++))
fi
echo ""

# Test 5: POST test-connection without graphName
echo "[TEST 5] POST /api/roam/test-connection - Validation (missing graphName)"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/roam/test-connection" \
  -H "Content-Type: application/json" \
  -d '{
    "apiToken": "test-token-12345"
  }')
if echo "$RESPONSE" | grep -q "graphName is required"; then
    echo "✅ PASS - Properly validates missing fields"
    ((PASSED++))
else
    echo "❌ FAIL - Should validate required fields"
    ((FAILED++))
fi
echo ""

# Test 6: POST search with valid structure
echo "[TEST 6] POST /api/roam/search - Valid Request Structure"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/roam/search" \
  -H "Content-Type: application/json" \
  -d '{
    "graphName": "TestGraph",
    "apiToken": "test-token-12345",
    "query": "test"
  }')
if echo "$RESPONSE" | grep -q '"results"'; then
    echo "✅ PASS - Endpoint responds with results array"
    ((PASSED++))
else
    echo "❌ FAIL - Invalid response format"
    echo "Response: $RESPONSE"
    ((FAILED++))
fi
echo ""

# Test 7: POST search without query
echo "[TEST 7] POST /api/roam/search - Validation (missing query)"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/roam/search" \
  -H "Content-Type: application/json" \
  -d '{
    "graphName": "TestGraph",
    "apiToken": "test-token-12345"
  }')
if echo "$RESPONSE" | grep -q "query is required"; then
    echo "✅ PASS - Properly validates missing fields"
    ((PASSED++))
else
    echo "❌ FAIL - Should validate required fields"
    ((FAILED++))
fi
echo ""

# Test 8: POST search without apiToken
echo "[TEST 8] POST /api/roam/search - Validation (missing apiToken)"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/roam/search" \
  -H "Content-Type: application/json" \
  -d '{
    "graphName": "TestGraph",
    "query": "test"
  }')
if echo "$RESPONSE" | grep -q "apiToken is required"; then
    echo "✅ PASS - Properly validates missing fields"
    ((PASSED++))
else
    echo "❌ FAIL - Should validate required fields"
    ((FAILED++))
fi
echo ""

# Test 9: GET page with valid parameters
echo "[TEST 9] GET /api/roam/page/:title - Valid Request"
RESPONSE=$(curl -s "http://localhost:7890/api/roam/page/TestPage?graphName=TestGraph&apiToken=test-token-12345")
if echo "$RESPONSE" | grep -q '"success"'; then
    echo "✅ PASS - Endpoint responds with structured JSON"
    ((PASSED++))
else
    echo "❌ FAIL - Invalid response format"
    ((FAILED++))
fi
echo ""

# Test 10: GET page without graphName
echo "[TEST 10] GET /api/roam/page/:title - Validation (missing graphName)"
RESPONSE=$(curl -s "http://localhost:7890/api/roam/page/TestPage?apiToken=test-token-12345")
if echo "$RESPONSE" | grep -q "graphName query parameter is required"; then
    echo "✅ PASS - Properly validates required parameters"
    ((PASSED++))
else
    echo "❌ FAIL - Should validate required parameters"
    ((FAILED++))
fi
echo ""

# Test 11: GET page without apiToken
echo "[TEST 11] GET /api/roam/page/:title - Validation (missing apiToken)"
RESPONSE=$(curl -s "http://localhost:7890/api/roam/page/TestPage?graphName=TestGraph")
if echo "$RESPONSE" | grep -q "apiToken query parameter is required"; then
    echo "✅ PASS - Properly validates required parameters"
    ((PASSED++))
else
    echo "❌ FAIL - Should validate required parameters"
    ((FAILED++))
fi
echo ""

# Test 12: GET page with URL-encoded title
echo "[TEST 12] GET /api/roam/page/:title - URL Encoding"
RESPONSE=$(curl -s "http://localhost:7890/api/roam/page/Test%20Page?graphName=TestGraph&apiToken=test-token-12345")
if echo "$RESPONSE" | grep -q '"success"'; then
    echo "✅ PASS - Properly handles URL-encoded parameters"
    ((PASSED++))
else
    echo "❌ FAIL - URL encoding not handled properly"
    ((FAILED++))
fi
echo ""

# Test 13: Verify response timestamps
echo "[TEST 13] Response Timestamps - ISO 8601 Format"
RESPONSE=$(curl -s "$BASE_URL/api/roam/test-connection" \
  -H "Content-Type: application/json" \
  -d '{
    "graphName": "TestGraph",
    "apiToken": "test-token-12345"
  }')
if echo "$RESPONSE" | grep -qE '"timestamp":"[0-9]{4}-[0-9]{2}-[0-9]{2}T'; then
    echo "✅ PASS - Timestamps in ISO 8601 format"
    ((PASSED++))
else
    echo "❌ FAIL - Invalid timestamp format"
    ((FAILED++))
fi
echo ""

# Test 14: Verify HTTP Status Codes - test-connection
echo "[TEST 14] HTTP Status Codes - test-connection endpoint"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/roam/test-connection" \
  -H "Content-Type: application/json" \
  -d '{
    "graphName": "TestGraph",
    "apiToken": "test-token-12345"
  }')
if [ "$STATUS" = "503" ] || [ "$STATUS" = "200" ]; then
    echo "✅ PASS - Correct HTTP status code: $STATUS"
    ((PASSED++))
else
    echo "❌ FAIL - Unexpected status code: $STATUS"
    ((FAILED++))
fi
echo ""

# Test 15: Verify HTTP Status Codes - validation error
echo "[TEST 15] HTTP Status Codes - validation error (400)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/roam/test-connection" \
  -H "Content-Type: application/json" \
  -d '{
    "graphName": "TestGraph"
  }')
if [ "$STATUS" = "400" ]; then
    echo "✅ PASS - Correct HTTP 400 for validation error"
    ((PASSED++))
else
    echo "❌ FAIL - Expected 400, got: $STATUS"
    ((FAILED++))
fi
echo ""

# Summary
echo "========================================"
echo "Test Summary"
echo "========================================"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "Total:  $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "✅ All tests passed!"
    exit 0
else
    echo "❌ Some tests failed"
    exit 1
fi
