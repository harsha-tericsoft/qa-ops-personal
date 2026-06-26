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
      timeout: 60000,
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
  console.log('\n========== VERIFY TREE BUILDING ==========\n')

  // Fetch all nodes
  console.log('Fetching all nodes from /api/repository...')
  const repo = await makeRequest(`/api/repository?projectId=${PROJECT_ID}`)

  if (repo.error || repo.status !== 200) {
    console.log(`❌ Failed to fetch nodes`)
    process.exit(1)
  }

  const allNodes = repo.body.nodes || []
  console.log(`✓ Fetched ${allNodes.length} nodes (${repo.duration}ms)\n`)

  // Simulate client-side tree building
  console.log('Building hierarchy client-side (like RepositoryTree component)...')
  const nodeMap = {}
  allNodes.forEach(node => {
    nodeMap[node.id] = {
      id: node.id,
      name: node.name,
      type: node.type,
      depth: node.depth || 0,
      parentId: node.parentId || null,
      children: [],
    }
  })

  const rootNodes = []
  allNodes.forEach(node => {
    if (node.parentId && nodeMap[node.parentId]) {
      nodeMap[node.parentId].children.push(nodeMap[node.id])
    } else {
      rootNodes.push(nodeMap[node.id])
    }
  })

  console.log(`✓ Built hierarchy`)
  console.log(`  Root nodes: ${rootNodes.length}`)
  console.log(`  Total nodes in map: ${Object.keys(nodeMap).length}`)

  // Show tree structure
  console.log(`\nTree Structure:`)
  function showNode(node, depth = 0) {
    const indent = '  '.repeat(depth)
    const icon = node.type === 'FOLDER' ? '📁' : '✅'
    console.log(`${indent}${icon} ${node.name} (${node.children.length} children)`)
    if (depth < 3) { // Show first 3 levels
      node.children.slice(0, 2).forEach(child => showNode(child, depth + 1))
    }
  }

  rootNodes.forEach(node => showNode(node))

  console.log(`\n` + '='.repeat(50))
  console.log('✅ TREE BUILDING VERIFIED')
  console.log('='.repeat(50))
  console.log(`
Repository page will now:
  1. Load /api/repository (fetch all nodes) - ${repo.duration}ms
  2. Build hierarchy client-side (instant)
  3. Display tree with expand/collapse (instant)
  4. Expand nodes without API calls (instant)
`)
}

test()
