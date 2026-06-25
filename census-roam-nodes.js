#!/usr/bin/env node

/**
 * COMPLETE CENSUS: Reconcile discrepancy between 2,425 extracted test cases and 363 MCP candidates
 * Query 1: Blocks with Test::
 * Query 2: Blocks with Test: (single colon)
 * Query 3: Blocks with #Manual
 * Query 4: Blocks with #Automated
 * Query 5: Blocks under Test Cases sections
 * Total unique: all distinct UIDs
 */

const { execSync } = require('child_process')

const GRAPH_NAME = 'Project_Kinergy'

function extractJsonFromOutput(output) {
  const lines = output.split('\n')
  const jsonStart = lines.findIndex((l) => l.startsWith('{'))
  if (jsonStart < 0) return null
  return JSON.parse(lines.slice(jsonStart).join('\n'))
}

console.log('=== COMPLETE ROAM NODE CENSUS ===\n')

const results = {
  test_double_colon: { count: 0, examples: [] },
  test_single_colon: { count: 0, examples: [] },
  manual_tag: { count: 0, examples: [] },
  automated_tag: { count: 0, examples: [] },
  test_cases_section: { count: 0, examples: [] },
}

const allUids = new Set()

// Query 1: Blocks with "Test::" (using search for test cases)
console.log('Query 1: Searching for blocks with "Test::" ...')
try {
  const output = execSync(`roam search --graph "${GRAPH_NAME}" --query="Test::" --limit=500`, {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const data = extractJsonFromOutput(output)
  if (data && data.results) {
    results.test_double_colon.count = data.results.length

    // Store first 5 examples
    for (const r of data.results.slice(0, 5)) {
      allUids.add(r.uid)
      const markdown = r.markdown || ''
      const text = markdown
        .replace(/<roam uid="[^"]*"[^>]*\/?>/g, '')
        .trim()
      results.test_double_colon.examples.push({
        uid: r.uid,
        path: (r.path || []).map((p) => (typeof p === 'string' ? p : p.text || '')).join(' > '),
        text: text.substring(0, 100),
      })
    }
  }
} catch (e) {
  console.error('Error in Query 1:', e.message)
}

// Query 2: Blocks with "Test:" (single colon)
console.log('Query 2: Searching for blocks with "Test:" ...')
try {
  const output = execSync(
    `roam search --graph "${GRAPH_NAME}" --query="Test:" --limit=500 | grep -v "Test::"`,
    {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: '/bin/bash',
    }
  )

  // Parse the output
  const lines = output.split('\n')
  const jsonStart = lines.findIndex((l) => l.startsWith('{'))
  if (jsonStart >= 0) {
    const data = JSON.parse(lines.slice(jsonStart).join('\n'))
    if (data && data.results) {
      results.test_single_colon.count = data.results.length

      for (const r of data.results.slice(0, 5)) {
        allUids.add(r.uid)
        const markdown = r.markdown || ''
        const text = markdown
          .replace(/<roam uid="[^"]*"[^>]*\/?>/g, '')
          .trim()
        results.test_single_colon.examples.push({
          uid: r.uid,
          path: (r.path || []).map((p) => (typeof p === 'string' ? p : p.text || '')).join(' > '),
          text: text.substring(0, 100),
        })
      }
    }
  }
} catch (e) {
  // Silently handle - grep might filter everything out
}

// Query 3: Blocks with #Manual
console.log('Query 3: Searching for blocks with #Manual ...')
try {
  const output = execSync(`roam search --graph "${GRAPH_NAME}" --query="#Manual" --limit=500`, {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const data = extractJsonFromOutput(output)
  if (data && data.results) {
    results.manual_tag.count = data.results.length

    for (const r of data.results.slice(0, 5)) {
      allUids.add(r.uid)
      const markdown = r.markdown || ''
      const text = markdown
        .replace(/<roam uid="[^"]*"[^>]*\/?>/g, '')
        .trim()
      results.manual_tag.examples.push({
        uid: r.uid,
        path: (r.path || []).map((p) => (typeof p === 'string' ? p : p.text || '')).join(' > '),
        text: text.substring(0, 100),
      })
    }
  }
} catch (e) {
  console.error('Error in Query 3:', e.message)
}

// Query 4: Blocks with #Automated
console.log('Query 4: Searching for blocks with #Automated ...')
try {
  const output = execSync(`roam search --graph "${GRAPH_NAME}" --query="#Automated" --limit=500`, {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const data = extractJsonFromOutput(output)
  if (data && data.results) {
    results.automated_tag.count = data.results.length

    for (const r of data.results.slice(0, 5)) {
      allUids.add(r.uid)
      const markdown = r.markdown || ''
      const text = markdown
        .replace(/<roam uid="[^"]*"[^>]*\/?>/g, '')
        .trim()
      results.automated_tag.examples.push({
        uid: r.uid,
        path: (r.path || []).map((p) => (typeof p === 'string' ? p : p.text || '')).join(' > '),
        text: text.substring(0, 100),
      })
    }
  }
} catch (e) {
  console.error('Error in Query 4:', e.message)
}

// Query 5: Blocks under Test Cases section
console.log('Query 5: Searching for blocks under Test Cases ...')
try {
  const output = execSync(
    `roam search --graph "${GRAPH_NAME}" --query="Test Cases" --limit=500`,
    {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  )

  const data = extractJsonFromOutput(output)
  if (data && data.results) {
    results.test_cases_section.count = data.results.length

    for (const r of data.results.slice(0, 5)) {
      allUids.add(r.uid)
      const markdown = r.markdown || ''
      const text = markdown
        .replace(/<roam uid="[^"]*"[^>]*\/?>/g, '')
        .trim()
      results.test_cases_section.examples.push({
        uid: r.uid,
        path: (r.path || []).map((p) => (typeof p === 'string' ? p : p.text || '')).join(' > '),
        text: text.substring(0, 100),
      })
    }
  }
} catch (e) {
  console.error('Error in Query 5:', e.message)
}

// Print results
console.log('\n=== CENSUS RESULTS ===\n')

console.log('QUERY RESULTS:')
console.log(`  Blocks with "Test::": ${results.test_double_colon.count}`)
console.log(`  Blocks with "Test:": ${results.test_single_colon.count}`)
console.log(`  Blocks with #Manual: ${results.manual_tag.count}`)
console.log(`  Blocks with #Automated: ${results.automated_tag.count}`)
console.log(`  Search results for "Test Cases": ${results.test_cases_section.count}`)
console.log()

console.log(`UNIQUE UIDS FOUND: ${allUids.size}`)
console.log()

// Show examples of blocks with Test::
if (results.test_double_colon.count > 0) {
  console.log('EXAMPLES WITH "Test::" PREFIX:')
  for (const ex of results.test_double_colon.examples) {
    console.log(`  UID: ${ex.uid}`)
    console.log(`  Text: "${ex.text}..."`)
    console.log()
  }
}

// Show blocks with Test: (single colon)
if (results.test_single_colon.count > 0) {
  console.log('EXAMPLES WITH "Test:" PREFIX (SINGLE COLON):')
  for (const ex of results.test_single_colon.examples) {
    console.log(`  UID: ${ex.uid}`)
    console.log(`  Text: "${ex.text}..."`)
    console.log()
  }
}

// Summary
console.log('=== DISCREPANCY ANALYSIS ===')
console.log(`Database extracted: 2,425 test cases`)
console.log(`MCP candidates (#Manual + #Automated): ${results.manual_tag.count + results.automated_tag.count}`)
console.log(`MCP with Test:: prefix: ${results.test_double_colon.count}`)
console.log(`MCP with Test: prefix: ${results.test_single_colon.count}`)
console.log(`Total unique UIDs across all queries: ${allUids.size}`)
console.log()

console.log('INVESTIGATION REQUIRED:')
console.log('1. Why do we have 2,425 extracted test cases but only ~363 #Manual/#Automated blocks in Roam?')
console.log('2. Where do the remaining ~2,062 test cases originate?')
console.log('3. Are test cases also identified by other patterns (When/Then/Given)?')
console.log('4. Are there test cases under Test Cases sections that do NOT have tags?')
console.log()

console.log('✓ CENSUS COMPLETE - Investigation required before bulk update.')
