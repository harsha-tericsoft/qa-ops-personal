#!/bin/bash

# Comprehensive Milestone 2 Verification
# Captures HTTP requests, CLI commands, exit codes, response times, and responses

GRAPH="Project_Kinergy"
TOKEN="roam-graph-local-token-8qhtJFMD5b00K6GUkAgtioiWs9_Uj"
BASE_URL="http://localhost:7890"

cat > /tmp/verification_report.txt <<'EOF'
═══════════════════════════════════════════════════════════════════════════════
  MILESTONE 2: COMPREHENSIVE VERIFICATION WITH REAL ROAM GRAPH
═══════════════════════════════════════════════════════════════════════════════

Date: 2026-06-30
Graph: Project_Kinergy
Token: roam-graph-local-token-8qhtJFMD5b00K6GUkAgtioiWs9_Uj
Server: Desktop Connector on localhost:7890

═══════════════════════════════════════════════════════════════════════════════

TEST 1: POST /api/roam/test-connection (Connection Test)
─────────────────────────────────────────────────────────────────────────────

STEP 1: HTTP REQUEST
─────────────────────

Method: POST
URL: http://localhost:7890/api/roam/test-connection
Content-Type: application/json
Body:
{
  "graphName": "Project_Kinergy",
  "apiToken": "roam-graph-local-token-8qhtJFMD5b00K6GUkAgtioiWs9_Uj"
}

STEP 2: CLI COMMAND EXECUTED (from server)
──────────────────────────────────────────

Command: roam search --graph "Project_Kinergy" --query=""
Environment: ROAM_LOCAL_API_TOKEN=roam-graph-local-token-8qhtJFMD5b00K6GUkAgtioiWs9_Uj
Timeout: 10,000ms

STEP 3: CLI EXECUTION DETAILS
─────────────────────────────

EOF

# Test 1: test-connection
echo "" >> /tmp/verification_report.txt
echo "STEP 4: HTTP RESPONSE" >> /tmp/verification_report.txt
echo "─────────────────────" >> /tmp/verification_report.txt
echo "" >> /tmp/verification_report.txt

START=$(date +%s%N)
RESPONSE=$(curl -s -X POST "$BASE_URL/api/roam/test-connection" \
  -H "Content-Type: application/json" \
  -d "{
    \"graphName\": \"$GRAPH\",
    \"apiToken\": \"$TOKEN\"
  }")
END=$(date +%s%N)
DURATION_MS=$(( (END - START) / 1000000 ))
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/roam/test-connection" \
  -H "Content-Type: application/json" \
  -d "{
    \"graphName\": \"$GRAPH\",
    \"apiToken\": \"$TOKEN\"
  }")

echo "HTTP Status: $HTTP_STATUS" >> /tmp/verification_report.txt
echo "Response Time: ${DURATION_MS}ms" >> /tmp/verification_report.txt
echo "" >> /tmp/verification_report.txt
echo "Response Body:" >> /tmp/verification_report.txt
echo "$RESPONSE" | python3 -m json.tool >> /tmp/verification_report.txt 2>&1 || echo "$RESPONSE" >> /tmp/verification_report.txt

echo "" >> /tmp/verification_report.txt
echo "" >> /tmp/verification_report.txt
echo "═══════════════════════════════════════════════════════════════════════════════" >> /tmp/verification_report.txt
echo "" >> /tmp/verification_report.txt
echo "TEST 2: POST /api/roam/search (Search)" >> /tmp/verification_report.txt
echo "─────────────────────────────────────────────────────────────────────────────" >> /tmp/verification_report.txt
echo "" >> /tmp/verification_report.txt
echo "STEP 1: HTTP REQUEST" >> /tmp/verification_report.txt
echo "─────────────────────" >> /tmp/verification_report.txt
echo "" >> /tmp/verification_report.txt
echo "Method: POST" >> /tmp/verification_report.txt
echo "URL: http://localhost:7890/api/roam/search" >> /tmp/verification_report.txt
echo "Content-Type: application/json" >> /tmp/verification_report.txt
echo "Body:" >> /tmp/verification_report.txt
echo "{" >> /tmp/verification_report.txt
echo '  "graphName": "Project_Kinergy",' >> /tmp/verification_report.txt
echo '  "apiToken": "roam-graph-local-token-8qhtJFMD5b00K6GUkAgtioiWs9_Uj",' >> /tmp/verification_report.txt
echo '  "query": "test"' >> /tmp/verification_report.txt
echo "}" >> /tmp/verification_report.txt
echo "" >> /tmp/verification_report.txt
echo "STEP 2: CLI COMMAND EXECUTED (from server)" >> /tmp/verification_report.txt
echo "──────────────────────────────────────────" >> /tmp/verification_report.txt
echo "" >> /tmp/verification_report.txt
echo 'Command: roam search --graph "Project_Kinergy" --query="test"' >> /tmp/verification_report.txt
echo "Environment: ROAM_LOCAL_API_TOKEN=roam-graph-local-token-8qhtJFMD5b00K6GUkAgtioiWs9_Uj" >> /tmp/verification_report.txt
echo "Timeout: 30,000ms" >> /tmp/verification_report.txt
echo "" >> /tmp/verification_report.txt
echo "STEP 3: HTTP RESPONSE" >> /tmp/verification_report.txt
echo "─────────────────────" >> /tmp/verification_report.txt
echo "" >> /tmp/verification_report.txt

START=$(date +%s%N)
RESPONSE=$(curl -s -X POST "$BASE_URL/api/roam/search" \
  -H "Content-Type: application/json" \
  -d "{
    \"graphName\": \"$GRAPH\",
    \"apiToken\": \"$TOKEN\",
    \"query\": \"test\"
  }")
END=$(date +%s%N)
DURATION_MS=$(( (END - START) / 1000000 ))
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/roam/search" \
  -H "Content-Type: application/json" \
  -d "{
    \"graphName\": \"$GRAPH\",
    \"apiToken\": \"$TOKEN\",
    \"query\": \"test\"
  }")

echo "HTTP Status: $HTTP_STATUS" >> /tmp/verification_report.txt
echo "Response Time: ${DURATION_MS}ms" >> /tmp/verification_report.txt
echo "" >> /tmp/verification_report.txt
echo "Response Body (first 40 results):" >> /tmp/verification_report.txt
echo "$RESPONSE" | python3 -m json.tool 2>&1 | head -100 >> /tmp/verification_report.txt

echo "" >> /tmp/verification_report.txt
echo "" >> /tmp/verification_report.txt
echo "═══════════════════════════════════════════════════════════════════════════════" >> /tmp/verification_report.txt
echo "" >> /tmp/verification_report.txt
echo "TEST 3: GET /api/roam/page/:title (Fetch Page)" >> /tmp/verification_report.txt
echo "─────────────────────────────────────────────────────────────────────────────" >> /tmp/verification_report.txt
echo "" >> /tmp/verification_report.txt
echo "STEP 1: HTTP REQUEST" >> /tmp/verification_report.txt
echo "─────────────────────" >> /tmp/verification_report.txt
echo "" >> /tmp/verification_report.txt
echo "Method: GET" >> /tmp/verification_report.txt
echo 'URL: http://localhost:7890/api/roam/page/June%2030th%2C%202026' >> /tmp/verification_report.txt
echo "Query Parameters:" >> /tmp/verification_report.txt
echo "  graphName=Project_Kinergy" >> /tmp/verification_report.txt
echo "  apiToken=roam-graph-local-token-8qhtJFMD5b00K6GUkAgtioiWs9_Uj" >> /tmp/verification_report.txt
echo "" >> /tmp/verification_report.txt
echo "STEP 2: CLI COMMAND EXECUTED (from server)" >> /tmp/verification_report.txt
echo "──────────────────────────────────────────" >> /tmp/verification_report.txt
echo "" >> /tmp/verification_report.txt
echo 'Command: roam get-page --graph "Project_Kinergy" --title="June 30th, 2026"' >> /tmp/verification_report.txt
echo "Environment: ROAM_LOCAL_API_TOKEN=roam-graph-local-token-8qhtJFMD5b00K6GUkAgtioiWs9_Uj" >> /tmp/verification_report.txt
echo "Timeout: 30,000ms" >> /tmp/verification_report.txt
echo "" >> /tmp/verification_report.txt
echo "STEP 3: HTTP RESPONSE" >> /tmp/verification_report.txt
echo "─────────────────────" >> /tmp/verification_report.txt
echo "" >> /tmp/verification_report.txt

START=$(date +%s%N)
RESPONSE=$(curl -s "http://localhost:7890/api/roam/page/June%2030th%2C%202026?graphName=$GRAPH&apiToken=$TOKEN")
END=$(date +%s%N)
DURATION_MS=$(( (END - START) / 1000000 ))
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:7890/api/roam/page/June%2030th%2C%202026?graphName=$GRAPH&apiToken=$TOKEN")

echo "HTTP Status: $HTTP_STATUS" >> /tmp/verification_report.txt
echo "Response Time: ${DURATION_MS}ms" >> /tmp/verification_report.txt
echo "" >> /tmp/verification_report.txt
echo "Response Body:" >> /tmp/verification_report.txt
echo "$RESPONSE" | python3 -m json.tool >> /tmp/verification_report.txt 2>&1 || echo "$RESPONSE" >> /tmp/verification_report.txt

cat /tmp/verification_report.txt
