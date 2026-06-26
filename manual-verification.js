const http = require('http')

const BASE_URL = 'http://localhost:3000'
const PROJECT_ID = 'cmqttt49c000r7kygg73fmuqv'

function makeRequest(method, path, timeout = 20000) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL)
    const startTime = Date.now()
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      timeout,
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        const duration = Date.now() - startTime
        resolve({ status: res.statusCode, duration })
      })
    })
    req.on('error', e => resolve({ error: e.message }))
    req.on('timeout', () => {
      req.destroy()
      resolve({ error: 'Timeout', duration: timeout })
    })
    req.end()
  })
}

async function test() {
  console.log('\n========== MANUAL BROWSER VERIFICATION TEST ==========\n')

  // Test 1: Repository Page loads HTML
  console.log('TEST 1: Repository page HTML')
  const repoHtml = await makeRequest('GET', '/repository')
  if (repoHtml.error) {
    console.log(`  ❌ ${repoHtml.error}`)
  } else if (repoHtml.status === 200) {
    console.log(`  ✓ Page HTML loads (${repoHtml.duration}ms)`)
  }

  // Test 2: Test Suite Creation Page
  console.log('\nTEST 2: Test Suite page HTML')
  const suiteHtml = await makeRequest('GET', '/test-suites')
  if (suiteHtml.error) {
    console.log(`  ❌ ${suiteHtml.error}`)
  } else if (suiteHtml.status === 200) {
    console.log(`  ✓ Page HTML loads (${suiteHtml.duration}ms)`)
  }

  // Test 3: /api/repository endpoint
  console.log('\nTEST 3: /api/repository endpoint')
  const repo = await makeRequest('GET', `/api/repository?projectId=${PROJECT_ID}`, 20000)
  if (repo.error) {
    console.log(`  ❌ ${repo.error} (${repo.duration}ms)`)
  } else if (repo.status === 200) {
    console.log(`  ✓ API responds (${repo.duration}ms)`)
  } else {
    console.log(`  ❌ Status ${repo.status}`)
  }

  // Test 4: /api/repository/tree endpoint
  console.log('\nTEST 4: /api/repository/tree endpoint')
  const tree = await makeRequest('GET', `/api/repository/tree?projectId=${PROJECT_ID}`, 15000)
  if (tree.error) {
    console.log(`  ❌ ${tree.error}`)
  } else if (tree.status === 200) {
    console.log(`  ✓ API responds (${tree.duration}ms)`)
  } else {
    console.log(`  ❌ Status ${tree.status}`)
  }

  console.log('\n' + '='.repeat(50))
  console.log('Ready for manual browser verification')
  console.log('='.repeat(50))
  console.log(`
MANUAL STEPS:
1. Open browser to http://localhost:3000/test-suites
2. Click "Create Test Suite"
3. Wait for repository tree to load
4. Select some test cases
5. Verify count updates on UI
6. Create suite
7. Navigate to http://localhost:3000/repository
8. Verify repository tree loads
9. Check browser console for errors
`)
}

test()
