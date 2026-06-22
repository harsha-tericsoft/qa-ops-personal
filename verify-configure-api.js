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
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, data: jsonData });
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

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function configure() {
  try {
    console.log('CONFIGURING ROAM VIA API\n');

    const configRes = await makeRequest('POST', '/api/roam/config', {
      projectId: projectId,
      graphName: 'Project_Kinergy',
      apiToken: 'roam-graph-local-token-test-verification',
      repositoryRootPage: 'TestSuite : Kinergy',
    });

    if (configRes.data?.success) {
      console.log('✅ Configuration saved via API');
      console.log(`   Graph: Project_Kinergy`);
      console.log(`   Root Page: TestSuite : Kinergy`);
      console.log(`   Token: encrypted\n`);
    } else {
      console.log('❌ Configuration failed');
      console.log(`   Error: ${configRes.data?.error}`);
    }

    process.exit(configRes.data?.success ? 0 : 1);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

configure();
