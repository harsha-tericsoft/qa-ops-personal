#!/bin/bash

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  EXECUTION VERSIONING MVP - COMPLETE VERIFICATION SUITE    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

FAILED=0

echo -e "${BLUE}STEP 1: Database Verification${NC}"
echo "─────────────────────────────────────────────────────────────"
npm run verify:execution-versioning:db
if [ $? -ne 0 ]; then
  FAILED=$((FAILED + 1))
  echo -e "${RED}✗ Database verification failed${NC}"
else
  echo -e "${GREEN}✓ Database verification passed${NC}"
fi

echo ""
echo -e "${BLUE}STEP 2: Regression Verification${NC}"
echo "─────────────────────────────────────────────────────────────"
npm run verify:execution-versioning:regressions
if [ $? -ne 0 ]; then
  FAILED=$((FAILED + 1))
  echo -e "${RED}✗ Regression verification failed${NC}"
else
  echo -e "${GREEN}✓ Regression verification passed${NC}"
fi

echo ""
echo -e "${BLUE}STEP 3: API Verification${NC}"
echo "─────────────────────────────────────────────────────────────"
npm run verify:execution-versioning:api
if [ $? -ne 0 ]; then
  FAILED=$((FAILED + 1))
  echo -e "${RED}✗ API verification failed${NC}"
else
  echo -e "${GREEN}✓ API verification passed${NC}"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    VERIFICATION COMPLETE                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ ALL VERIFICATIONS PASSED${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Manual Browser Testing: see VERIFY_BROWSER.md"
  echo "2. Deploy migration: npx prisma migrate deploy"
  echo ""
  exit 0
else
  echo -e "${RED}✗ $FAILED VERIFICATION(S) FAILED${NC}"
  echo ""
  exit 1
fi
