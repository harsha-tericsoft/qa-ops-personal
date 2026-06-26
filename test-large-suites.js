#!/usr/bin/env node

/**
 * Test suite creation performance with different sizes
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';
const PROJECT_ID = 'cmqttt49c000r7kygg73fmuqv';

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

async function testSuiteCreation(testCount) {
  console.log(`\n=== Testing Suite Creation with ${testCount} Tests ===\n`);

  try {
    // Fetch test cases
    const testRes = await makeRequest(
      'GET',
      `/api/test-cases?projectId=${PROJECT_ID}`
    );

    let testCases = [];
    try {
      const parsed = JSON.parse(testRes.body);
      testCases = Array.isArray(parsed) ? parsed : parsed.data || [];
    } catch (e) {
      console.error('Error parsing tests:', e.message);
      return;
    }

    const selectedTests = testCases.slice(0, testCount);
    const roamTestCaseIds = selectedTests.map((tc) => tc.id);

    console.log(`Selected ${roamTestCaseIds.length} test IDs`);

    // Create suite
    const suiteName = `Load Test Suite ${testCount} ${Date.now()}`;
    console.log(`Creating suite: ${suiteName}`);

    const startTime = Date.now();
    const createRes = await makeRequest(
      'POST',
      `/api/test-suites?projectId=${PROJECT_ID}`,
      {
        name: suiteName,
        description: `Load test with ${testCount} tests`,
        category: 'CUSTOM',
        roamTestCaseIds,
      }
    );
    const duration = Date.now() - startTime;

    console.log(`Status: ${createRes.status}`);
    console.log(`Duration: ${duration}ms`);

    try {
      const suite = JSON.parse(createRes.body);
      if (suite.id) {
        console.log(`✓ Suite created: ${suite.id}`);
        console.log(`✓ Test cases: ${suite.testCases?.length || 0}`);
      } else if (suite.error) {
        console.log(`✗ Error: ${suite.error}`);
      }
    } catch (e) {
      console.error('Error parsing response:', e.message);
    }

    return duration;
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

async function main() {
  console.log('\n=== TEST SUITE CREATION LOAD TEST ===');
  console.log('Testing performance with different suite sizes\n');

  const results = [];

  for (const testCount of [10, 25, 50, 100]) {
    const duration = await testSuiteCreation(testCount);
    if (duration !== undefined) {
      results.push({ testCount, duration });
    }
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(
    '\nTest Count | Duration  | Per Test'
  );
  console.log('-----------|-----------|----------');

  for (const { testCount, duration } of results) {
    const perTest = (duration / testCount).toFixed(0);
    console.log(
      `${String(testCount).padEnd(10)} ${String(duration).padEnd(9)}ms ${perTest}ms`
    );
  }
}

main();
