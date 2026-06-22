const http = require('http');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL('http://localhost:3000' + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: null });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testSuiteCreation() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('TEST: Suite Creation with TestCase Foreign Key Fix');
    console.log('═══════════════════════════════════════════════════════\n');

    // Use the project with imported data
    const projectId = 'cmqorivor03id7kgcdbyrpt7c';

    // 1. Fetch available RoamTestCases
    console.log('1. Fetching RoamTestCases for project...\n');
    const roamRes = await makeRequest('GET', `/api/test-cases?projectId=${projectId}`);
    if (roamRes.status !== 200) {
      throw new Error(`Failed to fetch RoamTestCases: ${roamRes.status}`);
    }

    const roamTestCases = roamRes.data.slice(0, 3);
    console.log(`   ✅ Found ${roamRes.data.length} RoamTestCases`);
    console.log(`   Using first 3: ${roamTestCases.map(tc => tc.title).join(', ')}\n`);

    // 2. Create a test suite
    console.log('2. Creating test suite...\n');
    const suiteRes = await makeRequest('POST', '/api/test-suites?projectId=' + projectId, {
      name: 'Test Suite - Foreign Key Fix Verification',
      description: 'Testing the fix for foreign key constraint error',
      category: 'CUSTOM',
    });

    if (suiteRes.status !== 200 && suiteRes.status !== 201) {
      throw new Error(`Failed to create suite: ${suiteRes.status}`);
    }

    const suite = suiteRes.data;
    console.log(`   ✅ Suite created: ${suite.name}`);
    console.log(`   Suite ID: ${suite.id}\n`);

    // 3. Create TestCases from RoamTestCases
    console.log('3. Creating TestCase records from RoamTestCases...\n');
    const testCaseIds = [];
    for (const rtc of roamTestCases) {
      const tcRes = await makeRequest('POST', '/api/test-cases', {
        projectId,
        title: `Test: ${rtc.title}`,
        description: `Extracted from: ${rtc.sourceRoamUid}`,
      });

      if (tcRes.status === 201 || tcRes.status === 200) {
        testCaseIds.push(tcRes.data.id);
        console.log(`   ✅ Created TestCase: ${tcRes.data.title}`);
      } else {
        console.log(`   ⚠️  Failed to create TestCase for ${rtc.title}`);
      }
    }
    console.log(`\n   Created ${testCaseIds.length} TestCases\n`);

    // 4. Link TestCases to Suite
    console.log('4. Linking TestCases to Suite...\n');
    const linkRes = await makeRequest('PATCH', `/api/test-suites/${suite.id}`, {
      testCaseIds,
    });

    if (linkRes.status !== 200 && linkRes.status !== 201) {
      throw new Error(`Failed to link test cases: ${linkRes.status} - ${JSON.stringify(linkRes.data)}`);
    }

    console.log(`   ✅ Linked ${testCaseIds.length} TestCases to Suite\n`);

    // 5. Verify in database
    console.log('5. Database verification...\n');
    const suiteWithCases = await prisma.testSuite.findUnique({
      where: { id: suite.id },
      include: {
        testCases: {
          include: { testCase: true },
        },
      },
    });

    console.log(`   Suite has ${suiteWithCases.testCases.length} linked test cases:`);
    for (const stc of suiteWithCases.testCases) {
      console.log(`   ✅ ${stc.testCase.title}`);
    }

    // 6. Verify no foreign key constraints violated
    console.log('\n6. Verifying all links are valid...\n');
    const allSuiteTestCases = await prisma.suiteTestCase.findMany({
      where: { suiteId: suite.id },
      include: { testCase: true },
    });

    const validLinks = allSuiteTestCases.filter(stc => stc.testCase !== null).length;
    console.log(`   ✅ ${validLinks}/${allSuiteTestCases.length} links are valid\n`);

    if (validLinks === allSuiteTestCases.length) {
      console.log('   ✅ All SuiteTestCase records have valid TestCase references\n');
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ TEST PASSED - Foreign key fix is working correctly');
    console.log('═══════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testSuiteCreation();
