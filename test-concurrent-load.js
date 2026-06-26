const http = require('http');

const BASE_URL = 'http://localhost:3000';
const endpoints = [
  '/api/dashboard?projectId=test',
  '/api/repository?projectId=test',
  '/api/projects',
  '/api/test-cases?projectId=test&page=1&limit=10',
];

let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
const times = [];

function makeRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const url = new URL(endpoint, BASE_URL);

    const request = http.get(url.toString(), (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const duration = Date.now() - startTime;
        times.push(duration);
        totalRequests++;

        if (res.statusCode === 200 || res.statusCode === 400) {
          successfulRequests++;
          console.log(`✓ ${endpoint} - ${duration}ms`);
        } else {
          failedRequests++;
          console.log(`✗ ${endpoint} - Status ${res.statusCode} - ${duration}ms`);
        }

        resolve();
      });
    });

    request.on('error', (err) => {
      const duration = Date.now() - startTime;
      times.push(duration);
      failedRequests++;
      totalRequests++;
      console.log(`✗ ${endpoint} - ERROR: ${err.message} - ${duration}ms`);
      resolve();
    });

    request.setTimeout(5000, () => {
      request.destroy();
      failedRequests++;
      totalRequests++;
      console.log(`✗ ${endpoint} - TIMEOUT (5s)`);
      resolve();
    });
  });
}

async function runTests() {
  console.log('Starting concurrent load test...\n');

  // Test 1: Sequential requests (baseline)
  console.log('=== Test 1: Sequential Requests (Baseline) ===');
  for (const endpoint of endpoints) {
    await makeRequest(endpoint);
  }

  // Test 2: Parallel requests (10 concurrent)
  console.log('\n=== Test 2: Parallel Requests (10 concurrent) ===');
  const promises = [];
  for (let i = 0; i < 10; i++) {
    for (const endpoint of endpoints) {
      promises.push(makeRequest(endpoint));
    }
  }
  await Promise.all(promises);

  // Test 3: Stress test (50 rapid requests)
  console.log('\n=== Test 3: Stress Test (50 rapid requests) ===');
  const stressPromises = [];
  for (let i = 0; i < 50; i++) {
    const endpoint = endpoints[i % endpoints.length];
    stressPromises.push(makeRequest(endpoint));
  }
  await Promise.all(stressPromises);

  // Print summary
  const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  console.log('\n=== Summary ===');
  console.log(`Total Requests: ${totalRequests}`);
  console.log(`Successful: ${successfulRequests}`);
  console.log(`Failed: ${failedRequests}`);
  console.log(`Failure Rate: ${((failedRequests / totalRequests) * 100).toFixed(2)}%`);
  console.log(`Average Response Time: ${avgTime}ms`);
  console.log(`Min Response Time: ${minTime}ms`);
  console.log(`Max Response Time: ${maxTime}ms`);
}

runTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
