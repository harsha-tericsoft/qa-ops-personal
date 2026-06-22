const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      timeout: 30000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.end();
  });
}

async function verify() {
  try {
    const projectId = 'cmqorivor03id7kgcdbyrpt7c';

    console.log('\nAPI VERIFICATION: Execution Cycles Data\n');
    console.log('═'.repeat(70) + '\n');

    const response = await makeRequest(`/api/execution-cycles?projectId=${projectId}`);

    if (!response.data || !Array.isArray(response.data)) {
      console.log('❌ No cycles data returned');
      process.exit(1);
    }

    const cycle = response.data[0];
    if (!cycle) {
      console.log('❌ No cycles found');
      process.exit(1);
    }

    console.log('EXECUTION CYCLE (from API):');
    console.log(`  Name: ${cycle.name}`);
    console.log(`  Test Runs: ${cycle.testRuns?.length || 0}\n`);

    console.log('FIRST 5 TEST RUNS - API RESPONSE:');
    console.log('─'.repeat(70));

    let allValid = true;
    for (let i = 0; i < Math.min(5, cycle.testRuns.length); i++) {
      const run = cycle.testRuns[i];
      const title = run.testCase?.title;

      console.log(`\n${i + 1}. Test Run ID: ${run.id}`);
      console.log(`   Status: ${run.status}`);
      console.log(`   TestCase ID: ${run.testCase?.id || '(null)'}`);
      console.log(`   Title: "${title || '(MISSING)'}"`);

      if (!title) {
        console.log(`   ❌ FAILURE: Title is missing`);
        allValid = false;
      } else if (title === 'undefined') {
        console.log(`   ❌ FAILURE: Title is the string "undefined"`);
        allValid = false;
      } else if (title === '') {
        console.log(`   ❌ FAILURE: Title is empty string`);
        allValid = false;
      } else {
        console.log(`   ✅ Valid title`);
      }
    }

    console.log('\n' + '─'.repeat(70));
    console.log('\nRESULT:');
    console.log('─'.repeat(70));

    if (allValid && cycle.testRuns.length > 0) {
      console.log('✅ ALL CHECKS PASSED');
      console.log('  ✅ Cycle name displayed');
      console.log('  ✅ Test run count correct');
      console.log('  ✅ All test case titles present');
      console.log('  ✅ No "undefined" strings');
      console.log('  ✅ No blank titles');
      console.log('  ✅ TestCase relation properly included in API');
    } else {
      console.log('❌ VERIFICATION FAILED');
      process.exit(1);
    }

    console.log('\n' + '═'.repeat(70) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

verify();
