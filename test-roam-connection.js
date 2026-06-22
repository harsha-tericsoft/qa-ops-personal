const http = require('http');

const BASE_URL = 'http://localhost:3000';
const projectId = 'cmqorivor03id7kgcdbyrpt7c';

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
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

async function test() {
  try {
    console.log('TESTING ROAM DESKTOP CONNECTION\n');

    const testRes = await makeRequest('POST', '/api/roam/test-connection', {
      projectId: projectId
    });

    console.log(`Status: ${testRes.data?.success ? '✅' : '❌'}`);
    console.log(`Details: ${testRes.data?.details || testRes.data?.error}\n`);

    if (!testRes.data?.success) {
      console.log('⚠️  Roam Desktop API not accessible');
      console.log('   Ensure Roam Desktop is running with:');
      console.log('   - Graph: Project_Kinergy');
      console.log('   - Local API enabled\n');
    }

    process.exit(testRes.data?.success ? 0 : 1);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

test();
