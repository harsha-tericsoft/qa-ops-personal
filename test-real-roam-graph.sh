#!/bin/bash

# Real Roam Graph Test Suite
# Tests Desktop Connector with actual Project_Kinergy graph

GRAPH="Project_Kinergy"
TOKEN="roam-graph-local-token-8qhtJFMD5b00K6GUkAgtioiWs9_Uj"
BASE_URL="http://localhost:7890"

echo "=========================================="
echo "Desktop Connector - Real Roam Graph Tests"
echo "=========================================="
echo ""
echo "Graph: $GRAPH"
echo "Base URL: $BASE_URL"
echo ""

# Test 1: Test Connection with Real Graph
echo "=========================================="
echo "TEST 1: POST /api/roam/test-connection"
echo "=========================================="
echo ""
echo "Request:"
cat <<EOF
curl -X POST http://localhost:7890/api/roam/test-connection \
  -H "Content-Type: application/json" \
  -d '{
    "graphName": "$GRAPH",
    "apiToken": "roam-graph-local-token-8qhtJFMD5b00K6GUkAgtioiWs9_Uj"
  }'
EOF
echo ""
echo ""
echo "Response:"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/roam/test-connection" \
  -H "Content-Type: application/json" \
  -d "{
    \"graphName\": \"$GRAPH\",
    \"apiToken\": \"$TOKEN\"
  }")
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""
echo ""

# Test 2: Search with Real Graph
echo "=========================================="
echo "TEST 2: POST /api/roam/search"
echo "=========================================="
echo ""
echo "Request:"
cat <<EOF
curl -X POST http://localhost:7890/api/roam/search \
  -H "Content-Type: application/json" \
  -d '{
    "graphName": "$GRAPH",
    "apiToken": "roam-graph-local-token-8qhtJFMD5b00K6GUkAgtioiWs9_Uj",
    "query": "test"
  }'
EOF
echo ""
echo ""
echo "Response:"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/roam/search" \
  -H "Content-Type: application/json" \
  -d "{
    \"graphName\": \"$GRAPH\",
    \"apiToken\": \"$TOKEN\",
    \"query\": \"test\"
  }")
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""
echo ""

# Test 3: Get Today's Daily Note
echo "=========================================="
echo "TEST 3: GET /api/roam/page/:title"
echo "=========================================="
echo "Fetching today's daily note: 'June 30th, 2026'"
echo ""
echo "Request:"
cat <<EOF
curl "http://localhost:7890/api/roam/page/June%2030th%2C%202026?graphName=$GRAPH&apiToken=roam-graph-local-token-8qhtJFMD5b00K6GUkAgtioiWs9_Uj"
EOF
echo ""
echo ""
echo "Response:"
RESPONSE=$(curl -s "http://localhost:7890/api/roam/page/June%2030th%2C%202026?graphName=$GRAPH&apiToken=$TOKEN")
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""
echo ""

# Test 4: Search with empty query
echo "=========================================="
echo "TEST 4: POST /api/roam/search (empty query)"
echo "=========================================="
echo "This returns recently edited/viewed content"
echo ""
echo "Request:"
cat <<EOF
curl -X POST http://localhost:7890/api/roam/search \
  -H "Content-Type: application/json" \
  -d '{
    "graphName": "$GRAPH",
    "apiToken": "roam-graph-local-token-8qhtJFMD5b00K6GUkAgtioiWs9_Uj",
    "query": ""
  }'
EOF
echo ""
echo ""
echo "Response (first 500 chars):"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/roam/search" \
  -H "Content-Type: application/json" \
  -d "{
    \"graphName\": \"$GRAPH\",
    \"apiToken\": \"$TOKEN\",
    \"query\": \"\"
  }")
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | head -50 || echo "$RESPONSE" | head -c 500
echo ""
echo ""

# Test 5: Get a specific page - List of Templates
echo "=========================================="
echo "TEST 5: GET /api/roam/page/:title (List of Templates)"
echo "=========================================="
echo ""
echo "Request:"
cat <<EOF
curl "http://localhost:7890/api/roam/page/List%20of%20Templates?graphName=$GRAPH&apiToken=roam-graph-local-token-8qhtJFMD5b00K6GUkAgtioiWs9_Uj"
EOF
echo ""
echo ""
echo "Response (first 800 chars):"
RESPONSE=$(curl -s "http://localhost:7890/api/roam/page/List%20of%20Templates?graphName=$GRAPH&apiToken=$TOKEN")
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | head -50 || echo "$RESPONSE" | head -c 800
echo ""
echo ""

# Test 6: Non-existent page
echo "=========================================="
echo "TEST 6: GET /api/roam/page/:title (non-existent page)"
echo "=========================================="
echo ""
echo "Request:"
cat <<EOF
curl "http://localhost:7890/api/roam/page/NonExistentPageXYZ123?graphName=$GRAPH&apiToken=roam-graph-local-token-8qhtJFMD5b00K6GUkAgtioiWs9_Uj"
EOF
echo ""
echo ""
echo "Response:"
RESPONSE=$(curl -s "http://localhost:7890/api/roam/page/NonExistentPageXYZ123?graphName=$GRAPH&apiToken=$TOKEN")
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""
echo ""

echo "=========================================="
echo "All Real Roam Graph Tests Complete"
echo "=========================================="
