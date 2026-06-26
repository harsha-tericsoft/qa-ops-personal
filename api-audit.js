#!/usr/bin/env node

/**
 * Comprehensive API Audit
 * Tests every endpoint for correctness
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';
const PROJECT_ID = 'cmqttt49c000r7kygg73fmuqv';

const results = {
  passed: 0,
  failed: 0,
  errors: [],
};

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const startTime = Date.now();

    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const duration = Date.now() - startTime;
        resolve({ status: res.statusCode, body: data, duration });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function testAPI(name, method, path, expectedStatus = 200, body = null) {
  try {
    const res = await makeRequest(method, path, body);

    if (res.status !== expectedStatus) {
      results.failed++;
      results.errors.push(`${name}: Expected ${expectedStatus}, got ${res.status}`);
      console.log(`❌ ${name} - Status ${res.status} (expected ${expectedStatus})`);
      return false;
    }

    // Validate JSON response
    let data;
    try {
      data = JSON.parse(res.body);
    } catch (e) {
      results.failed++;
      results.errors.push(`${name}: Invalid JSON response`);
      console.log(`❌ ${name} - Invalid JSON`);
      return false;
    }

    // Check for 500 errors in response
    if (data.error && res.status === 500) {
      results.failed++;
      results.errors.push(`${name}: Server error - ${data.error}`);
      console.log(`❌ ${name} - Server error`);
      return false;
    }

    results.passed++;
    console.log(`✓ ${name} - ${res.duration}ms`);
    return true;
  } catch (error) {
    results.failed++;
    results.errors.push(`${name}: ${error.message}`);
    console.log(`❌ ${name} - ${error.message}`);
    return false;
  }
}

async function auditAPIs() {
  console.log('\n=== API AUDIT ===\n');

  // Projects
  console.log('Projects:');
  await testAPI('GET /api/projects', 'GET', '/api/projects');

  // Test Cases
  console.log('\nTest Cases:');
  await testAPI(
    'GET /api/test-cases',
    'GET',
    `/api/test-cases?projectId=${PROJECT_ID}`
  );

  // Test Suites
  console.log('\nTest Suites:');
  await testAPI('GET /api/test-suites', 'GET', `/api/test-suites?projectId=${PROJECT_ID}`);

  // Repository
  console.log('\nRepository:');
  await testAPI('GET /api/repository', 'GET', `/api/repository?projectId=${PROJECT_ID}`);

  // Repository Tree
  console.log('\nRepository Tree:');
  await testAPI('GET /api/repository/tree', 'GET', `/api/repository/tree?projectId=${PROJECT_ID}`);

  // Tags
  console.log('\nTags:');
  await testAPI('GET /api/tags', 'GET', `/api/tags?projectId=${PROJECT_ID}`);

  // Dashboard
  console.log('\nDashboard:');
  await testAPI('GET /api/dashboard', 'GET', `/api/dashboard?projectId=${PROJECT_ID}`);
  await testAPI('GET /api/dashboard/summary', 'GET', `/api/dashboard/summary?projectId=${PROJECT_ID}`);
  await testAPI('GET /api/dashboard/metrics', 'GET', `/api/dashboard/metrics?projectId=${PROJECT_ID}`);

  // Execution Cycles
  console.log('\nExecution Cycles:');
  await testAPI(
    'GET /api/execution-cycles',
    'GET',
    `/api/execution-cycles?projectId=${PROJECT_ID}`
  );

  // Test Runs
  console.log('\nTest Runs:');
  await testAPI('GET /api/test-runs', 'GET', `/api/test-runs?projectId=${PROJECT_ID}`);

  // Code Repositories
  console.log('\nCode Repositories:');
  await testAPI('GET /api/codeRepositories', 'GET', `/api/codeRepositories?projectId=${PROJECT_ID}`);

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach((err) => console.log(`  - ${err}`));
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

auditAPIs();
