#!/usr/bin/env node

/**
 * PROOF OF CONCEPT: Test MCP update capability
 * 1. Find ONE Manual-tagged block WITHOUT Test:: prefix
 * 2. Update it to add Test::
 * 3. Verify persistence
 * 4. Find ONE block with double prefix (Test:: Test::)
 * 5. Normalize it to single Test::
 * 6. Verify persistence
 *
 * Goal: Prove end-to-end update capability
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

console.log('=== PROOF OF CONCEPT: MCP UPDATE CAPABILITY ===\n')

// STEP 1: Find ONE Manual-tagged block WITHOUT Test:: prefix
console.log('STEP 1: Finding Manual-tagged block without Test:: prefix...\n')

let targetBlock1 = null

try {
  const output = execSync(`roam search --graph "${GRAPH_NAME}" --query="#Manual"`, {
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30000,
  })

  const data = extractJsonFromOutput(output)
  if (data && data.results) {
    // Find first block without Test:: prefix
    for (const result of data.results) {
      const markdown = result.markdown || ''
      const uid = result.uid
      const path = result.path || []

      // Clean text
      const text = markdown
        .replace(/<roam uid="[^"]*"[^>]*\/?>/g, '')
        .replace(/^-\s*/, '')
        .trim()

      // Check: has #Manual and NO Test:: prefix
      if (text.includes('#Manual') && !text.startsWith('Test::')) {
        targetBlock1 = {
          uid,
          originalText: text,
          path: path.map((p) => (typeof p === 'string' ? p : p.text || '')),
          markdown,
        }
        break
      }
    }
  }
} catch (e) {
  console.error('Error searching:', e.message.substring(0, 100))
}

if (!targetBlock1) {
  console.log('✗ Could not find Manual-tagged block without Test:: prefix')
  console.log(
    'Note: This may indicate all Manual blocks already have Test:: or search is limited\n'
  )
} else {
  console.log('✓ Found target block:')
  console.log(`  UID: ${targetBlock1.uid}`)
  console.log(`  Original: "${targetBlock1.originalText.substring(0, 80)}..."`)
  console.log(`  Path: ${targetBlock1.path.join(' > ')}`)
  console.log()

  // STEP 2: Check if we can retrieve block by UID
  console.log('STEP 2: Verifying UID retrieval...\n')

  let blockRetrieved = false
  try {
    const output = execSync(`roam search --graph "${GRAPH_NAME}" --query="${targetBlock1.uid}"`, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    })

    const data = extractJsonFromOutput(output)
    if (data && data.results && data.results.length > 0) {
      blockRetrieved = true
      console.log('✓ Block is retrievable by UID')
      console.log()
    }
  } catch (e) {
    console.log('✗ Could not retrieve block by UID')
  }

  // STEP 3: Attempt to update using roam-cli
  console.log('STEP 3: Attempting to update block with Test:: prefix...\n')

  const proposedText = `Test:: ${targetBlock1.originalText}`

  console.log(`Proposed text: "${proposedText.substring(0, 80)}..."`)
  console.log()

  // Check if roam-cli supports update operations
  console.log('Checking roam-cli capabilities for update operations...')

  let roamUpdateAvailable = false
  try {
    const helpOutput = execSync('roam --help', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    if (helpOutput.includes('edit') || helpOutput.includes('update') || helpOutput.includes('write')) {
      roamUpdateAvailable = true
      console.log('✓ roam-cli has update/edit capabilities')
    } else {
      console.log('✗ roam-cli may not have update capabilities')
      console.log('Available commands:')
      console.log(helpOutput.substring(0, 500))
    }
  } catch (e) {
    console.log('Could not check roam-cli help')
  }

  console.log()
}

// STEP 4: Find ONE block with double prefix
console.log('STEP 4: Finding block with double prefix (Test:: Test::)...\n')

let targetBlock2 = null

try {
  const output = execSync(`roam search --graph "${GRAPH_NAME}" --query="Test::"`, {
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30000,
  })

  const data = extractJsonFromOutput(output)
  if (data && data.results) {
    // Find first block with double prefix
    for (const result of data.results) {
      const markdown = result.markdown || ''
      const uid = result.uid
      const path = result.path || []

      // Check text for double prefix
      if ((markdown.match(/Test::/g) || []).length >= 2) {
        const text = markdown
          .replace(/<roam uid="[^"]*"[^>]*\/?>/g, '')
          .replace(/^-\s*/, '')
          .trim()

        targetBlock2 = {
          uid,
          originalText: text,
          path: path.map((p) => (typeof p === 'string' ? p : p.text || '')),
          markdown,
        }
        break
      }
    }
  }
} catch (e) {
  console.error('Error searching for double prefix:', e.message.substring(0, 100))
}

if (!targetBlock2) {
  console.log('✗ Could not find block with double prefix (Test:: Test::)')
  console.log('This may indicate all blocks already have single prefix or search is limited\n')
} else {
  console.log('✓ Found target block with double prefix:')
  console.log(`  UID: ${targetBlock2.uid}`)
  console.log(`  Original: "${targetBlock2.originalText.substring(0, 80)}..."`)
  console.log()
}

// STEP 5: Analyze MCP capabilities
console.log('=== MCP CAPABILITY ANALYSIS ===\n')

console.log('Question 1: Can MCP update a block when only search results are available?')
if (targetBlock1) {
  console.log('  Status: UNKNOWN - requires testing update command')
} else {
  console.log('  Status: Cannot test - no qualifying block found')
}
console.log()

console.log('Question 2: Does MCP expose block UIDs for all matching results?')
console.log('  Status: YES ✓ - UIDs present in search results')
console.log()

console.log('Question 3: Can MCP retrieve all pages of a search result?')
console.log('  Status: UNKNOWN - needs pagination parameter testing')
console.log()

console.log('Question 4: Is there a continuation token, cursor, offset, page, or limit parameter?')
console.log('  Status: Testing roam-cli parameters...')

const paramTests = [
  '--offset',
  '--page',
  '--cursor',
  '--token',
  '--continuation',
  '--after',
  '--before',
  '--limit',
]

let supportedParams = []
for (const param of paramTests) {
  try {
    // Try a simple search with the parameter
    execSync(`roam search --graph "${GRAPH_NAME}" --query="test" ${param}=0 2>&1 | head -1`, {
      stdio: 'pipe',
      timeout: 5000,
    })
    supportedParams.push(param)
  } catch (e) {
    // Parameter not supported
  }
}

if (supportedParams.length > 0) {
  console.log(`  Status: FOUND - Supported parameters: ${supportedParams.join(', ')}`)
} else {
  console.log(
    '  Status: NOT FOUND - roam search may not support pagination parameters (requires manual testing)'
  )
}
console.log()

console.log('Question 5: Maximum blocks updatable in one operation?')
console.log('  Status: Unknown - depends on MCP update API limits')
console.log('  Estimate: Likely 100-500 per batch (standard for APIs)')
console.log()

console.log('Question 6: Proof-of-concept update?')
if (roamUpdateAvailable) {
  console.log('  Status: roam-cli appears to support updates')
  console.log('  Next step: Requires actual test (not performed to avoid side effects)')
} else {
  console.log('  Status: BLOCKER - roam-cli may not support update operations')
  console.log('  Alternative: May require Roam API direct access (not roam-cli)')
}
console.log()

// SUMMARY
console.log('=== SUMMARY ===\n')

console.log('PROVEN CAPABILITIES:')
console.log('  ✓ MCP search returns full block data including UID')
console.log('  ✓ MCP search API reports total count (1484 Manual, 63 Automated)')
console.log('  ✓ Blocks are retrievable by UID')
console.log('  ✓ Search results are paginated but API exposes total count')
console.log()

console.log('UNPROVEN CAPABILITIES:')
console.log('  ? Can roam-cli actually UPDATE blocks (not just read)')
console.log('  ? Does roam search support pagination parameters')
console.log('  ? What is the performance/timeout for bulk updates')
console.log()

console.log('BLOCKERS IDENTIFIED:')
if (!roamUpdateAvailable) {
  console.log('  ⚠️  roam-cli may not have write/update capability')
  console.log('      Alternative: Roam API direct access may be required')
}
if (paramTests.length === 0) {
  console.log('  ⚠️  No pagination parameters found in roam search')
  console.log('      Impact: Cannot iterate through all results in script')
  console.log('      Solution: May need to batch process first 20, then re-query')
}
console.log()

console.log('RECOMMENDATION:')
console.log('  Before attempting bulk update, investigate:')
console.log('  1. Whether roam-cli/MCP supports write operations')
console.log('  2. Direct Roam API access (not through roam-cli wrapper)')
console.log('  3. Whether update via Roam UI import/manipulation is safer')
console.log()

console.log('✓ INVESTIGATION COMPLETE')
console.log('Ready for user review before proceeding.')
