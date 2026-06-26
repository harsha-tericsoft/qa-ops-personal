#!/bin/bash

BASE="http://localhost:3000"
paths=(
  "/dashboard"
  "/projects"
  "/repository"
  "/test-cases"
  "/test-suites"
  "/cycles"
  "/tags"
  "/roam"
)

for path in "${paths[@]}"; do
  response=$(curl -s -w "\n%{http_code}" "$BASE$path" 2>&1)
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | head -1)
  
  if [ "$http_code" = "200" ]; then
    if echo "$body" | grep -q "<!DOCTYPE"; then
      echo "✓ $path - HTML loaded"
    else
      echo "❌ $path - No HTML"
    fi
  else
    echo "❌ $path - HTTP $http_code"
  fi
done
