const http = require('http')

const BASE = 'http://localhost:3000'
const PROJECT = 'cmqttt49c000r7kygg73fmuqv'

async function test(name, method, path) {
  return new Promise(resolve => {
    const url = new URL(path, BASE)
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      timeout: 10000,
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        const ok = res.statusCode < 400
        const icon = ok ? '✓' : '❌'
        console.log(`${icon} ${name}: ${res.statusCode}`)
        resolve(ok)
      })
    })
    req.on('error', e => {
      console.log(`❌ ${name}: ${e.message}`)
      resolve(false)
    })
    req.end()
  })
}

async function run() {
  let passed = 0, failed = 0
  const tests = [
    ['Projects', 'GET', '/api/projects'],
    ['Test Cases', 'GET', `/api/test-cases?projectId=${PROJECT}`],
    ['Test Suites', 'GET', `/api/test-suites?projectId=${PROJECT}`],
    ['Repository', 'GET', `/api/repository?projectId=${PROJECT}`],
    ['Repository Tree', 'GET', `/api/repository/tree?projectId=${PROJECT}`],
    ['Dashboard', 'GET', `/api/dashboard?projectId=${PROJECT}`],
    ['Tags', 'GET', `/api/tags?projectId=${PROJECT}`],
    ['Execution Cycles', 'GET', `/api/execution-cycles?projectId=${PROJECT}`],
  ]
  
  for (const [name, method, path] of tests) {
    const ok = await test(name, method, path)
    if (ok) passed++; else failed++
  }
  
  console.log(`\n${passed}/${tests.length} APIs working`)
  process.exit(failed > 0 ? 1 : 0)
}

run()
