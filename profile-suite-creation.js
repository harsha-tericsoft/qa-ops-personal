#!/usr/bin/env node

/**
 * Performance profiling for Test Suite creation
 * Measures each stage of the suite creation workflow
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';
const PROJECT_ID = 'cmqttt49c000r7kygg73fmuqv';

const metrics = {};

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

async function main() {
  try {
    console.log('\n=== TEST SUITE CREATION PERFORMANCE PROFILING ===\n');

    // Step 1: Fetch available test cases
    console.log('STEP 1: Fetch available test cases');
    const testCasesRes = await makeRequest(
      'GET',
      `/api/test-cases?projectId=${PROJECT_ID}`
    );
    const duration1 = testCasesRes.duration;
    console.log(`Duration: ${duration1}ms`);
    metrics['fetch-test-cases'] = duration1;

    let testCases = [];
    try {
      const parsed = JSON.parse(testCasesRes.body);
      testCases = Array.isArray(parsed) ? parsed : parsed.data || [];
    } catch (e) {
      console.error('Error parsing response:', e.message);
    }

    console.log(`Available test cases: ${testCases.length}`);

    // Step 2: Select first 10 test cases
    console.log('\nSTEP 2: Prepare test IDs for suite');
    const selectedTests = testCases.slice(0, 10);
    const roamTestCaseIds = selectedTests.map((tc) => tc.id);
    console.log(`Selected test IDs: ${roamTestCaseIds.length}`);

    // Step 3: Create suite
    console.log('\nSTEP 3: Create test suite with 10 test cases');
    const suiteName = `Perf Test Suite ${Date.now()}`;

    const createRes = await makeRequest(
      'POST',
      `/api/test-suites?projectId=${PROJECT_ID}`,
      {
        name: suiteName,
        description: 'Performance test suite',
        category: 'CUSTOM',
        roamTestCaseIds,
      }
    );
    const duration3 = createRes.duration;
    console.log(`Duration: ${duration3}ms (Status: ${createRes.status})`);
    metrics['create-suite'] = duration3;

    let createdSuite = null;
    try {
      createdSuite = JSON.parse(createRes.body);
    } catch (e) {
      console.error('Error parsing suite response:', e.message);
      console.error('Response:', createRes.body.substring(0, 200));
    }

    if (createdSuite && createdSuite.id) {
      console.log(`Suite created: ${createdSuite.id}`);
      console.log(`Test cases in suite: ${createdSuite.testCases?.length || 0}`);
    } else {
      console.log(`Suite creation failed`);
      if (createdSuite && createdSuite.error) {
        console.log(`Error: ${createdSuite.error}`);
      }
    }

    // Step 4: Fetch suites to verify
    console.log('\nSTEP 4: Fetch all suites to verify creation');
    const suitesRes = await makeRequest(
      'GET',
      `/api/test-suites?projectId=${PROJECT_ID}`
    );
    const duration4 = suitesRes.duration;
    console.log(`Duration: ${duration4}ms`);
    metrics['fetch-suites'] = duration4;

    let suites = [];
    try {
      suites = JSON.parse(suitesRes.body);
      suites = Array.isArray(suites) ? suites : [];
    } catch (e) {
      console.error('Error parsing suites:', e.message);
    }

    const createdFound = suites.find((s) => s.name === suiteName);
    if (createdFound) {
      console.log(`✓ Suite verified in list`);
      console.log(`  Test cases: ${createdFound.testCases?.length || 0}`);
    } else {
      console.log(`✗ Suite not found in list (${suites.length} suites total)`);
    }

    // Summary
    console.log('\n=== PERFORMANCE SUMMARY ===');
    const totalTime = Object.values(metrics).reduce((sum, v) => sum + v, 0);
    console.log(`Total time: ${totalTime}ms\n`);

    for (const [step, time] of Object.entries(metrics)) {
      const pct = ((time / totalTime) * 100).toFixed(1);
      console.log(`${step.padEnd(25)} ${String(time).padStart(5)}ms (${pct}%)`);
    }

    console.log('\n=== BOTTLENECK ANALYSIS ===');
    const sorted = Object.entries(metrics).sort((a, b) => b[1] - a[1]);
    for (let i = 0; i < Math.min(3, sorted.length); i++) {
      const [step, time] = sorted[i];
      console.log(`${i + 1}. ${step}: ${time}ms`);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
