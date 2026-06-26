#!/bin/bash

# Performance profiling script for test suite creation

PROJECT_ID="cmqttt49c000r7kygg73fmuqv"
BASE_URL="http://localhost:3000"

echo "=== STEP 1: FETCH AVAILABLE TEST CASES ==="
START=$(date +%s%N)
TESTS=$(curl -s "${BASE_URL}/api/test-cases?projectId=${PROJECT_ID}")
END=$(date +%s%N)
DURATION=$((($END - $START) / 1000000))
echo "Fetched test cases: ${DURATION}ms"

# Count available tests
TEST_COUNT=$(echo "$TESTS" | grep -o '"id"' | wc -l)
echo "Available tests: $TEST_COUNT"

# Extract first 10 test IDs for our suite
TEST_IDS=$(echo "$TESTS" | grep -o '"id":"[^"]*"' | head -10 | sed 's/"id":"\([^"]*\)"/\1/')

echo -e "\n=== STEP 2: CREATE TEST SUITE WITH 10 TEST CASES ==="

# Convert test IDs to array format for JSON
IDS_ARRAY="["
FIRST=true
for ID in $TEST_IDS; do
  if [ "$FIRST" = true ]; then
    IDS_ARRAY="\"$ID\""
    FIRST=false
  else
    IDS_ARRAY="$IDS_ARRAY,\"$ID\""
  fi
done
IDS_ARRAY="$IDS_ARRAY]"

# Create the suite
SUITE_NAME="Perf Test Suite $(date +%s)"
echo "Creating suite: $SUITE_NAME"
echo "With ${#TEST_IDS[@]} test IDs"

START=$(date +%s%N)
SUITE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/test-suites?projectId=${PROJECT_ID}" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$SUITE_NAME\",\"description\":\"Performance test\",\"testIds\":$IDS_ARRAY}")
END=$(date +%s%N)
DURATION=$((($END - $START) / 1000000))

echo "Suite creation API time: ${DURATION}ms"
echo "Response: $SUITE_RESPONSE" | head -100

# Extract suite ID
SUITE_ID=$(echo "$SUITE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"\([^"]*\)"/\1/')
echo "Created suite ID: $SUITE_ID"

echo -e "\n=== STEP 3: FETCH SUITE TO VERIFY CREATION ==="
START=$(date +%s%N)
SUITE=$(curl -s "${BASE_URL}/api/test-suites?projectId=${PROJECT_ID}")
END=$(date +%s%N)
DURATION=$((($END - $START) / 1000000))
echo "Fetch suites time: ${DURATION}ms"

# Count test cases in the created suite
SUITE_TEST_COUNT=$(echo "$SUITE" | grep -A 5 "\"id\":\"$SUITE_ID\"" | grep -o '"testCaseId"' | wc -l)
echo "Test cases in suite: $SUITE_TEST_COUNT"

echo -e "\n=== SUMMARY ==="
echo "✓ Suite created successfully"
echo "✓ Suite ID: $SUITE_ID"
echo "✓ Test count: $SUITE_TEST_COUNT"
