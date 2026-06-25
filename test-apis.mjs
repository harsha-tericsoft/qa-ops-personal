import axios from 'axios';

const baseURL = 'http://localhost:3000';

async function testAPI(method, path, data = null) {
  const startTime = Date.now();
  try {
    const config = { timeout: 10000 };
    let response;
    
    if (method === 'GET') {
      response = await axios.get(`${baseURL}${path}`, config);
    } else if (method === 'POST') {
      response = await axios.post(`${baseURL}${path}`, data, config);
    }
    
    const duration = Date.now() - startTime;
    const status = response.status;
    const size = JSON.stringify(response.data).length;
    
    return { success: true, status, duration, size };
  } catch (error) {
    const duration = Date.now() - startTime;
    const status = error.response?.status || 'ERROR';
    const message = error.message;
    return { success: false, status, duration, message };
  }
}

async function main() {
  console.log('API Performance Testing\n');
  console.log('Path | Method | Status | Time(ms) | Size(bytes)');
  console.log('-----+--------+--------+----------+----------');
  
  const tests = [
    ['GET', '/api/projects'],
    ['GET', '/api/dashboard/repository-metrics?projectId=cmqttt49c000r7kygg73fmuqv'],
    ['GET', '/api/execution-cycles?projectId=cmqttt49c000r7kygg73fmuqv'],
    ['GET', '/api/test-cases?projectId=cmqttt49c000r7kygg73fmuqv'],
    ['GET', '/api/test-suites?projectId=cmqttt49c000r7kygg73fmuqv'],
    ['GET', '/api/repository?projectId=cmqttt49c000r7kygg73fmuqv'],
    ['GET', '/api/repository/tree?projectId=cmqttt49c000r7kygg73fmuqv&parentId=null'],
    ['GET', '/api/tags?projectId=cmqttt49c000r7kygg73fmuqv'],
  ];
  
  for (const [method, path] of tests) {
    const result = await testAPI(method, path);
    const displayPath = path.length > 40 ? path.substring(0, 37) + '...' : path;
    const status = result.success ? result.status : result.status;
    const time = result.duration;
    const size = result.success ? result.size : 'N/A';
    
    console.log(`${displayPath.padEnd(40)} | ${method} | ${status} | ${time.toString().padStart(8)} | ${size}`);
  }
}

main().catch(console.error);
