#!/bin/bash
echo "Testing API endpoints..."

# Test dashboard/summary endpoint
echo "1. Testing /api/dashboard/summary"
curl -s "http://localhost:3000/api/dashboard/summary?projectId=default-project" | head -200

echo -e "\n\n2. Testing /api/execution-cycles"
curl -s "http://localhost:3000/api/execution-cycles?projectId=default-project" | head -100

echo -e "\n\n3. Testing /api/projects"
curl -s "http://localhost:3000/api/projects" | head -100
