const http = require('http')

const BASE_URL = 'http://localhost:3000'
const PROJECT_ID = 'cmqttt49c000x7kyg9z0ptdvn' // User's project

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
  console.log('\n========== VERIFY REPOSITORY FIX ==========\n')

  try {
    // Test /api/repository (used by Repository page)
    console.log('Testing /api/repository endpoint...')
    const repo = await makeRequest(`/api/repository?projectId=${PROJECT_ID}`)

    if (repo.error) {
      console.log(`❌ ERROR: ${repo.error}`)
      process.exit(1)
    }

    if (repo.status !== 200) {
      console.log(`❌ Status: ${repo.status}`)
      process.exit(1)
    }

    const nodes = repo.body.nodes || []
    console.log(`✓ Endpoint responded: ${repo.duration}ms`)
    console.log(`✓ Total nodes returned: ${nodes.length}`)

    if (nodes.length === 0) {
      console.log(`❌ ERROR: No nodes returned (API still broken)`)
      process.exit(1)
    }

    // Show node structure
    console.log(`\nNode Structure:`)
    const nodesByDepth = {}
    nodes.forEach(n => {
      const depth = n.depth || 0
      nodesByDepth[depth] = (nodesByDepth[depth] || 0) + 1
    })

    Object.keys(nodesByDepth).sort().forEach(depth => {
      console.log(`  Depth ${depth}: ${nodesByDepth[depth]} nodes`)
    })

    // Check for hierarchy
    const rootNodes = nodes.filter(n => !n.parentId)
    const childNodes = nodes.filter(n => n.parentId)

    console.log(`\nHierarchy:`)
    console.log(`  Root nodes: ${rootNodes.length}`)
    console.log(`  Child nodes: ${childNodes.length}`)

    if (childNodes.length === 0 && rootNodes.length === 1) {
      console.log(`\n⚠️  WARNING: Only root folder, no children`)
      console.log(`    This may be correct if the folder is empty`)
    } else if (childNodes.length > 0) {
      console.log(`\n✓ Repository hierarchy loaded correctly`)
    }

    console.log(`\n` + '='.repeat(50))
    console.log('✅ API FIX VERIFIED')
    console.log('='.repeat(50))

  } catch (error) {
    console.error('❌ TEST ERROR:', error.message)
    process.exit(1)
  }
}

test()
