const http = require('http');

const BASE_URL = 'http://localhost:3000';
const projectId = 'cmqorivor03id7kgcdbyrpt7c';

function makeRequest(method, path, body = null, retries = 5) {
  return new Promise((resolve, reject) => {
    const attemptRequest = (attemptsLeft) => {
      const url = new URL(BASE_URL + path);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 60000,
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

      req.on('error', (err) => {
        if (attemptsLeft > 0) {
          console.log(`  ⚠️  Retry ${retries - attemptsLeft + 1}/${retries}: ${err.message}`);
          setTimeout(() => attemptRequest(attemptsLeft - 1), 2000);
        } else {
          reject(err);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        if (attemptsLeft > 0) {
          console.log(`  ⚠️  Timeout retry ${retries - attemptsLeft + 1}/${retries}`);
          setTimeout(() => attemptRequest(attemptsLeft - 1), 2000);
        } else {
          reject(new Error('Request timeout'));
        }
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    };

    attemptRequest(retries);
  });
}

async function runSync() {
  try {
    console.log('3. RUN INITIAL SYNC\n');
    console.log('   Initiating sync...');

    const syncRes = await makeRequest('POST', '/api/roam/sync', {
      projectId: projectId,
      syncType: 'initial'
    }, 5);

    console.log(`   Status: ${syncRes.data?.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    if (syncRes.data?.success) {
      console.log(`   Nodes Added: ${syncRes.data.nodesAdded}`);
      console.log(`   Message: ${syncRes.data.message}`);
    } else {
      console.log(`   Error: ${syncRes.data?.error}`);
    }

    process.exit(syncRes.data?.success ? 0 : 1);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

runSync();
