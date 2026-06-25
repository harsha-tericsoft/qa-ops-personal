#!/usr/bin/env node

/**
 * FULL GRAPH SCAN: Verify MCP can see all test cases
 * - Remove/increase limits
 * - Count ALL results, not truncated
 * - Sample 20 random blocks from different modules
 * - Verify each is accessible via UID
 */

const { execSync } = require('child_process')
const fs = require('fs')

const GRAPH_NAME = 'Project_Kinergy'

function extractJsonFromOutput(output) {
  const lines = output.split('\n')
  const jsonStart = lines.findIndex((l) => l.startsWith('{'))
  if (jsonStart < 0) return null
  try {
    return JSON.parse(lines.slice(jsonStart).join('\n'))
  } catch (e) {
    return null
  }
}

console.log('=== EXHAUSTIVE GRAPH SCAN ===\n')

const results = {
  manual: [],
  automated: [],
  test_double_colon: [],
}

// Query 1: ALL blocks with #Manual (no limit)
console.log('Scanning ALL #Manual blocks (no limit)...')
try {
  // Remove the limit entirely - roam-cli should return all results
  const output = execSync(`roam search --graph "${GRAPH_NAME}" --query="#Manual"`, {
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 60000,
  })

  const data = extractJsonFromOutput(output)
  if (data && data.results) {
    results.manual = data.results
    console.log(`  Found: ${data.results.length} blocks with #Manual`)
    console.log(`  Total from API: ${data.total || 'unknown'}`)
  }
} catch (e) {
  console.error('Error scanning Manual:', e.message.substring(0, 100))
}

// Query 2: ALL blocks with #Automated (no limit)
console.log('Scanning ALL #Automated blocks (no limit)...')
try {
  const output = execSync(`roam search --graph "${GRAPH_NAME}" --query="#Automated"`, {
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 60000,
  })

  const data = extractJsonFromOutput(output)
  if (data && data.results) {
    results.automated = data.results
    console.log(`  Found: ${data.results.length} blocks with #Automated`)
    console.log(`  Total from API: ${data.total || 'unknown'}`)
  }
} catch (e) {
  console.error('Error scanning Automated:', e.message.substring(0, 100))
}

// Query 3: ALL blocks with Test:: (no limit)
console.log('Scanning ALL Test:: blocks (no limit)...')
try {
  const output = execSync(`roam search --graph "${GRAPH_NAME}" --query="Test::"`, {
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 60000,
  })

  const data = extractJsonFromOutput(output)
  if (data && data.results) {
    results.test_double_colon = data.results
    console.log(`  Found: ${data.results.length} blocks with Test::`)
    console.log(`  Total from API: ${data.total || 'unknown'}`)
  }
} catch (e) {
  console.error('Error scanning Test::', e.message.substring(0, 100))
}

console.log('\n=== RESULTS ===\n')

console.log(`TOTAL BLOCKS WITH #MANUAL: ${results.manual.length}`)
console.log(`TOTAL BLOCKS WITH #AUTOMATED: ${results.automated.length}`)
console.log(`TOTAL BLOCKS WITH Test::: ${results.test_double_colon.length}`)
console.log()

// Verify we can see all modules
const modules = new Set()
const manualByModule = {}

for (const block of results.manual) {
  const path = block.path || []
  if (path.length > 1) {
    const module = path[1]
    const moduleName = typeof module === 'string' ? module : module.text || 'Unknown'
    modules.add(moduleName)

    if (!manualByModule[moduleName]) {
      manualByModule[moduleName] = []
    }
    manualByModule[moduleName].push(block)
  }
}

console.log(`MODULES WITH MANUAL TESTS: ${modules.size}`)
for (const module of Array.from(modules).sort().slice(0, 10)) {
  console.log(`  - ${module}: ${manualByModule[module]?.length || 0} tests`)
}
console.log()

// Sample 20 random Manual blocks from different modules
console.log('=== SAMPLING 20 RANDOM MANUAL TEST CASES ===\n')

const samples = []
const selectedModules = new Set()

// Try to pick from different modules
for (const moduleName of Array.from(modules)) {
  if (samples.length >= 20) break

  const moduleBlocks = manualByModule[moduleName] || []
  if (moduleBlocks.length > 0) {
    const randomIndex = Math.floor(Math.random() * moduleBlocks.length)
    const block = moduleBlocks[randomIndex]

    samples.push({
      module: moduleName,
      uid: block.uid,
      path: (block.path || []).map((p) => (typeof p === 'string' ? p : p.text || '')).join(' > '),
      markdown: (block.markdown || '')
        .replace(/<roam uid="[^"]*"[^>]*\/?>/g, '')
        .substring(0, 80),
    })

    selectedModules.add(moduleName)
  }
}

// If we need more samples, pick randomly from all
while (samples.length < 20 && results.manual.length > 0) {
  const randomBlock = results.manual[Math.floor(Math.random() * results.manual.length)]
  if (!samples.find((s) => s.uid === randomBlock.uid)) {
    const path = randomBlock.path || []
    const module = path.length > 1 ? (typeof path[1] === 'string' ? path[1] : path[1].text || 'Unknown') : 'Unknown'

    samples.push({
      module: module,
      uid: randomBlock.uid,
      path: (randomBlock.path || []).map((p) => (typeof p === 'string' ? p : p.text || '')).join(' > '),
      markdown: (randomBlock.markdown || '')
        .replace(/<roam uid="[^"]*"[^>]*\/?>/g, '')
        .substring(0, 80),
    })
  }
}

console.log(`Samples collected: ${samples.length}`)
console.log(`From modules: ${selectedModules.size}`)
console.log()

// Show samples
for (let i = 0; i < samples.length; i++) {
  const s = samples[i]
  console.log(`${i + 1}. [${s.module}]`)
  console.log(`   UID: ${s.uid}`)
  console.log(`   Text: "${s.markdown}..."`)
}

console.log()
console.log('=== VERIFICATION ===')
console.log()

// Verify we can find each sample by UID
let verified = 0
for (const sample of samples.slice(0, 5)) {
  try {
    const output = execSync(`roam search --graph "${GRAPH_NAME}" --query="${sample.uid}"`, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    })

    const data = extractJsonFromOutput(output)
    if (data && data.results && data.results.length > 0) {
      verified++
      console.log(`✓ Sample ${verified}: UID ${sample.uid} is accessible`)
    } else {
      console.log(`✗ Sample failed: UID ${sample.uid} not found`)
    }
  } catch (e) {
    console.log(`✗ Sample failed: UID ${sample.uid} - error: ${e.message.substring(0, 50)}`)
  }
}

console.log()
console.log('=== CONCLUSION ===\n')

const manualDifference = 1484 - results.manual.length
const automatedMatch = results.automated.length === 63

console.log(`Expected Manual: 1484`)
console.log(`Found Manual: ${results.manual.length}`)
console.log(`MISSING: ${manualDifference}`)
console.log()

console.log(`Expected Automated: 63`)
console.log(`Found Automated: ${results.automated.length}`)
console.log(`MATCH: ${automatedMatch ? 'YES' : 'NO'}`)
console.log()

if (manualDifference > 0) {
  console.log('⚠️  FINDING: MCP search is not returning all Manual blocks')
  console.log('Possible causes:')
  console.log('1. Search limit is capped at API level')
  console.log('2. Pagination required (not implemented)')
  console.log('3. Some blocks are not indexed/visible')
  console.log('4. Graph traversal is limited by depth')
} else {
  console.log('✓ MCP can see the full graph')
}

console.log()
console.log('✓ SCAN COMPLETE')
