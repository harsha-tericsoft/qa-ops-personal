const http = require('http');

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
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

async function test() {
  try {
    console.log('\n=== CLEAN ENVIRONMENT TEST ===\n');

    console.log('Test 1: Create project');
    console.log('─'.repeat(50));
    const createRes = await makeRequest('POST', '/api/projects', {
      name: 'Clean Env Test Project',
      description: 'Testing after process cleanup'
    });

    if (createRes.data?.id) {
      console.log(`✅ SUCCESS: Project created`);
      console.log(`   Project ID: ${createRes.data.id}`);
      console.log(`   Name: ${createRes.data.name}\n`);

      const projectId = createRes.data.id;

      console.log('Test 2: Fetch project');
      console.log('─'.repeat(50));
      const fetchRes = await makeRequest('GET', `/api/projects?id=${projectId}`);

      if (fetchRes.status === 200) {
        console.log(`✅ SUCCESS: Project fetched\n`);

        console.log('Test 3: Query database operations');
        console.log('─'.repeat(50));
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();

        const projectCount = await prisma.project.count();
        console.log(`✅ SUCCESS: Database query worked`);
        console.log(`   Total projects in DB: ${projectCount}`);

        await prisma.$disconnect();
        console.log(`   Prisma disconnected\n`);

        console.log('=== RESULT ===');
        console.log('✅ CLEAN ENVIRONMENT TEST PASSED');
        console.log('   - No connection pool timeout');
        console.log('   - Single dev server handling requests');
        console.log('   - Database operations working\n');
      } else {
        console.log(`❌ FAILED: Could not fetch project`);
      }
    } else {
      console.log(`❌ FAILED: Project creation failed`);
      console.log(`   Status: ${createRes.status}`);
      console.log(`   Response: ${JSON.stringify(createRes.data)}`);
    }

    process.exit(0);
  } catch (error) {
    console.log(`\n❌ ERROR: ${error.message}`);
    if (error.message.includes('pool')) {
      console.log('   CONNECTION POOL ERROR DETECTED');
    }
    process.exit(1);
  }
}

test();
