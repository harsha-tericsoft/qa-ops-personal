const http = require('http')

const BASE_URL = 'http://localhost:3000'
const PROJECT_ID = 'cmqttt49c000r7kygg73fmuqv'

function makeRequest(method, path) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL)
    const startTime = Date.now()
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      timeout: 15000,
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        const duration = Date.now() - startTime
        resolve({ status: res.statusCode, duration, body: data })
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
  console.log('Testing endpoints...\n')

  // Test /api/repository
  console.log('1. GET /api/repository')
  const repo = await makeRequest('GET', `/api/repository?projectId=${PROJECT_ID}`)
  if (repo.error) {
    console.log(`   ❌ ${repo.error}`)
  } else {
    console.log(`   ✓ ${repo.status} (${repo.duration}ms)`)
  }

  // Test /api/repository/tree
  console.log('\n2. GET /api/repository/tree')
  const tree = await makeRequest('GET', `/api/repository/tree?projectId=${PROJECT_ID}`)
  if (tree.error) {
    console.log(`   ❌ ${tree.error}`)
  } else {
    console.log(`   ✓ ${tree.status} (${tree.duration}ms)`)
  }

  // Test /api/repository/tree with filters
  console.log('\n3. GET /api/repository/tree (with filters)')
  const treeFiltered = await makeRequest('GET', `/api/repository/tree?projectId=${PROJECT_ID}&search=test&nodeType=HEADING`)
  if (treeFiltered.error) {
    console.log(`   ❌ ${treeFiltered.error}`)
  } else {
    console.log(`   ✓ ${treeFiltered.status} (${treeFiltered.duration}ms)`)
  }
}

test()
