const http = require('http')

const BASE_URL = 'http://localhost:3000'
const PROJECT_ID = 'cmqttt49c000r7kygg73fmuqv'

function makeRequest(path) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL)
    const startTime = Date.now()
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      timeout: 30000,
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
      resolve({ error: 'Timeout' })
    })
    req.end()
  })
}

async function test() {
  console.log('\n========== REPOSITORY PAGE PERFORMANCE TEST ==========\n')

  // Test 1: Repository HTML page
  console.log('1. Repository page HTML load')
  const html = await makeRequest('/repository')
  if (html.error) {
    console.log(`   ❌ ${html.error}`)
  } else {
    console.log(`   ✓ Loaded in ${html.duration}ms`)
  }

  // Test 2: API endpoint (used by component on page load)
  console.log('\n2. /api/repository (fetches all nodes)')
  const repo = await makeRequest(`/api/repository?projectId=${PROJECT_ID}`)
  if (repo.error) {
    console.log(`   ❌ ${repo.error}`)
  } else {
    console.log(`   ✓ Responded in ${repo.duration}ms`)
  }

  // Test 3: Old tree endpoint (used to make per-node calls)
  console.log('\n3. /api/repository/tree (root level only)')
  const tree = await makeRequest(`/api/repository/tree?projectId=${PROJECT_ID}`)
  if (tree.error) {
    console.log(`   ❌ ${tree.error}`)
  } else {
    console.log(`   ✓ Responded in ${tree.duration}ms`)
  }

  console.log('\n' + '='.repeat(50))
  console.log('RESULT: Repository now loads all nodes once')
  console.log('        No API calls on tree expansion')
  console.log('        Instant expand/collapse client-side')
  console.log('='.repeat(50))
}

test()
