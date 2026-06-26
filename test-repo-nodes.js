const http = require('http')

const BASE_URL = 'http://localhost:3000'
const PROJECT_ID = 'cmqttt49c000r7kygg73fmuqv' // Original project used in tests

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
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), duration })
        } catch {
          resolve({ status: res.statusCode, duration })
        }
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
  console.log('Testing /api/repository with cmqttt49c000r7kygg73fmuqv...\n')

  const repo = await makeRequest(`/api/repository?projectId=${PROJECT_ID}`)

  if (repo.error) {
    console.log(`❌ ERROR: ${repo.error}`)
    process.exit(1)
  }

  const nodes = repo.body.nodes || []
  console.log(`Status: ${repo.status} (${repo.duration}ms)`)
  console.log(`Nodes returned: ${nodes.length}`)

  if (nodes.length > 0) {
    console.log(`\nFirst 5 nodes:`)
    nodes.slice(0, 5).forEach((n, i) => {
      console.log(`  ${i + 1}. ${n.name} (depth: ${n.depth}, parent: ${n.parentId || 'root'})`)
    })

    // Count by depth
    const byDepth = {}
    nodes.forEach(n => {
      const d = n.depth || 0
      byDepth[d] = (byDepth[d] || 0) + 1
    })

    console.log(`\nNodes by depth:`)
    Object.keys(byDepth).sort().forEach(d => {
      console.log(`  Depth ${d}: ${byDepth[d]} nodes`)
    })

    console.log(`\n✅ Repository has ${nodes.length} nodes - WORKS`)
  } else {
    console.log(`\n⚠️  No nodes found (repository may be empty)`)
  }
}

test()
