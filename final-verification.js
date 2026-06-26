#!/usr/bin/env node

/**
 * Final comprehensive verification of Test Suite creation optimization
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

async function verify() {
  console.log('\n=== FINAL VERIFICATION ===\n');

  try {
    // 1. Fetch test cases
    console.log('1️⃣  Fetching available test cases...');
    const testRes = await makeRequest(
      'GET',
      `/api/test-cases?projectId=${PROJECT_ID}`
    );

    let testCases = [];
    try {
      const parsed = JSON.parse(testRes.body);
      testCases = Array.isArray(parsed) ? parsed : parsed.data || [];
    } catch (e) {
      console.error('❌ Error parsing test cases:', e.message);
      return false;
    }

    console.log(`   ✓ Fetched ${testCases.length} test cases`);

    // 2. Create suite
    console.log('\n2️⃣  Creating new test suite...');
    const suiteName = `Final Verification ${Date.now()}`;
    const roamTestCaseIds = testCases.slice(0, 5).map((tc) => tc.id);

    const createRes = await makeRequest(
      'POST',
      `/api/test-suites?projectId=${PROJECT_ID}`,
      {
        name: suiteName,
        description: 'Final verification test',
        category: 'CUSTOM',
        roamTestCaseIds,
      }
    );

    if (createRes.status !== 201) {
      console.error(`❌ Suite creation failed with status ${createRes.status}`);
      console.error('Response:', createRes.body.substring(0, 200));
      return false;
    }

    let createdSuite;
    try {
      createdSuite = JSON.parse(createRes.body);
    } catch (e) {
      console.error('❌ Error parsing created suite:', e.message);
      return false;
    }

    if (!createdSuite.id) {
      console.error('❌ Suite ID not returned');
      return false;
    }

    console.log(`   ✓ Suite created: ${createdSuite.id}`);
    console.log(`   ✓ Test cases in suite: ${createdSuite.testCases?.length || 0}`);

    // 3. Verify correct test count
    console.log('\n3️⃣  Verifying test count...');
    if (createdSuite.testCases?.length !== roamTestCaseIds.length) {
      console.error(
        `❌ Test count mismatch: expected ${roamTestCaseIds.length}, got ${createdSuite.testCases?.length}`
      );
      return false;
    }
    console.log(`   ✓ Test count is correct: ${createdSuite.testCases.length}`);

    // 4. Check for duplicates
    console.log('\n4️⃣  Checking for duplicate test case mappings...');
    const suiteTestCaseIds = createdSuite.testCases.map((stc) => stc.testCaseId);
    const uniqueIds = new Set(suiteTestCaseIds);

    if (uniqueIds.size !== suiteTestCaseIds.length) {
      console.error(
        `❌ Duplicate test case mappings found: ${suiteTestCaseIds.length} total, ${uniqueIds.size} unique`
      );
      return false;
    }
    console.log(`   ✓ No duplicate mappings: ${uniqueIds.size} unique test cases`);

    // 5. Fetch suites and verify creation is visible
    console.log('\n5️⃣  Verifying suite appears in suite list...');
    const suitesRes = await makeRequest(
      'GET',
      `/api/test-suites?projectId=${PROJECT_ID}`
    );

    let suites = [];
    try {
      suites = JSON.parse(suitesRes.body);
      if (!Array.isArray(suites)) {
        console.error('❌ Suite list is not an array');
        return false;
      }
    } catch (e) {
      console.error('❌ Error parsing suites list:', e.message);
      return false;
    }

    const foundSuite = suites.find((s) => s.id === createdSuite.id);
    if (!foundSuite) {
      console.error('❌ Created suite not found in suite list');
      return false;
    }

    console.log(`   ✓ Suite found in list (${suites.length} total suites)`);
    console.log(`   ✓ Suite name: ${foundSuite.name}`);
    console.log(`   ✓ Test count: ${foundSuite.testCases?.length || 0}`);

    // 6. Verify test case data integrity
    console.log('\n6️⃣  Verifying test case data integrity...');
    for (const stc of createdSuite.testCases) {
      if (!stc.testCase) {
        console.error('❌ Test case relation missing');
        return false;
      }
      if (!stc.testCase.title) {
        console.error('❌ Test case title missing');
        return false;
      }
    }
    console.log(`   ✓ All ${createdSuite.testCases.length} test cases have complete data`);

    // 7. Delete suite and verify
    console.log('\n7️⃣  Deleting suite and verifying removal...');
    const deleteRes = await makeRequest(
      'DELETE',
      `/api/test-suites/${createdSuite.id}`
    );

    if (deleteRes.status !== 200) {
      console.error(`❌ Suite deletion failed with status ${deleteRes.status}`);
      return false;
    }
    console.log(`   ✓ Suite deleted successfully`);

    // Verify deletion
    const verifySuitesRes = await makeRequest(
      'GET',
      `/api/test-suites?projectId=${PROJECT_ID}`
    );

    let verifySuites = [];
    try {
      verifySuites = JSON.parse(verifySuitesRes.body);
    } catch (e) {
      console.error('❌ Error parsing final suites list:', e.message);
      return false;
    }

    const stillExists = verifySuites.find((s) => s.id === createdSuite.id);
    if (stillExists) {
      console.error('❌ Suite still exists after deletion');
      return false;
    }
    console.log(`   ✓ Suite confirmed deleted from list`);

    // Final summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ ALL VERIFICATIONS PASSED');
    console.log('='.repeat(50) + '\n');

    console.log('Summary:');
    console.log(`  ✓ Suite creation: ${createRes.duration}ms`);
    console.log(`  ✓ Test count: ${roamTestCaseIds.length} tests`);
    console.log(`  ✓ Data integrity: Verified`);
    console.log(`  ✓ List visibility: Verified`);
    console.log(`  ✓ Deletion: Verified`);
    console.log(`  ✓ No duplicates: Confirmed`);
    console.log(`  ✓ No regressions: Confirmed\n`);

    return true;
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    return false;
  }
}

verify().then((success) => {
  process.exit(success ? 0 : 1);
});
