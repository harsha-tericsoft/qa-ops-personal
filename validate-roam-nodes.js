#!/usr/bin/env node

/**
 * VALIDATION PHASE: Extract actual Roam nodes with full path and hierarchy info
 * Only qualify blocks that are:
 * 1. Under "Test Cases" section, OR
 * 2. Contain #Manual tag, OR
 * 3. Contain #Automated tag
 */

const { execSync } = require('child_process')
const fs = require('fs')

const GRAPH_NAME = 'Project_Kinergy'

// Step 1: Get all blocks
console.log('Extracting Roam nodes for validation...\n')

const candidates = []
const seen = new Set()

// Query 1: Get blocks with #Manual
console.log('Querying blocks with #Manual...')
try {
  const result = execSync(`roam search --graph "${GRAPH_NAME}" --query="#Manual" --limit=300`, {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  })

  // Parse JSON (skip warning lines)
  const lines = result.split('\n')
  const jsonStart = lines.findIndex((l) => l.startsWith('{'))
  if (jsonStart >= 0) {
    const jsonText = lines.slice(jsonStart).join('\n')
    const data = JSON.parse(jsonText)

    for (const result_item of data.results || []) {
      const uid = result_item.uid
      const markdown = result_item.markdown || ''
      const path = result_item.path || []

      if (!seen.has(uid)) {
        seen.add(uid)
        candidates.push({
          uid,
          markdown: markdown.trim(),
          path: path.map((p) => (typeof p === 'string' ? p : p.text || '')),
          source: 'Manual',
          has_manual: true,
          has_automated: false,
          under_test_cases: false,
        })
      }
    }
  }
} catch (e) {
  console.error('Error querying Manual:', e.message)
}

// Query 2: Get blocks with #Automated
console.log('Querying blocks with #Automated...')
try {
  const result = execSync(`roam search --graph "${GRAPH_NAME}" --query="#Automated" --limit=300`, {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  })

  const lines = result.split('\n')
  const jsonStart = lines.findIndex((l) => l.startsWith('{'))
  if (jsonStart >= 0) {
    const jsonText = lines.slice(jsonStart).join('\n')
    const data = JSON.parse(jsonText)

    for (const result_item of data.results || []) {
      const uid = result_item.uid
      const markdown = result_item.markdown || ''
      const path = result_item.path || []

      if (!seen.has(uid)) {
        seen.add(uid)
        candidates.push({
          uid,
          markdown: markdown.trim(),
          path: path.map((p) => (typeof p === 'string' ? p : p.text || '')),
          source: 'Automated',
          has_manual: false,
          has_automated: true,
          under_test_cases: false,
        })
      }
    }
  }
} catch (e) {
  console.error('Error querying Automated:', e.message)
}

// Query 3: Get blocks under Test Cases section
console.log('Querying blocks under Test Cases section...')
try {
  const result = execSync(`roam search --graph "${GRAPH_NAME}" --query="Test Cases" --limit=1`, {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  })

  const lines = result.split('\n')
  const jsonStart = lines.findIndex((l) => l.startsWith('{'))
  if (jsonStart >= 0) {
    const jsonText = lines.slice(jsonStart).join('\n')
    const data = JSON.parse(jsonText)

    for (const result_item of data.results || []) {
      const uid = result_item.uid
      const markdown = result_item.markdown || ''
      const path = result_item.path || []

      // This gives us the Test Cases section itself, children are hidden
      // We'll note that blocks under this path are under Test Cases
    }
  }
} catch (e) {
  console.error('Error querying Test Cases:', e.message)
}

// Analyze candidates
console.log(`\nTotal candidate blocks found: ${candidates.length}\n`)

// Classify and prepare examples
const examples = []

for (const candidate of candidates.slice(0, 100)) {
  const markdown = candidate.markdown
  const text = markdown
    .replace(/<roam uid="[^"]*"[^>]*\/?>/g, '')
    .replace(/!\[\]\([^)]*\)/g, '')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/^-\s*/, '')
    .trim()

  const has_test_prefix = /^Test::\s/.test(text)
  const is_single_colon = /^Test:\s/.test(text)
  const is_invalid = /^TEST::|^Test\s+-/.test(text)
  const is_double = (text.match(/Test::/g) || []).length >= 2
  const has_manual = text.includes('#Manual')
  const has_automated = text.includes('#Automated')

  // Determine action
  let action = 'SKIP'
  let proposed = text

  if (candidate.has_manual || candidate.has_automated) {
    if (has_test_prefix && !is_double) {
      action = 'ALREADY CORRECT'
    } else if (is_double) {
      action = 'UPDATE'
      proposed = text.replace(/Test::\s*Test::/, 'Test::')
    } else if (is_invalid) {
      action = 'UPDATE'
      proposed = text
        .replace(/^TEST::/i, 'Test::')
        .replace(/^Test\s+-\s*/, 'Test:: ')
    } else if (is_single_colon) {
      action = 'UPDATE'
      proposed = text.replace(/^Test:\s*/, 'Test:: ')
    } else if (!has_test_prefix) {
      action = 'UPDATE'
      proposed = `Test:: ${text}`
    }
  }

  const page_name = candidate.path.length > 0 ? candidate.path[0] : 'Unknown'

  examples.push({
    page_name,
    path: candidate.path.join(' > '),
    current_text: text,
    has_manual,
    has_automated,
    action,
    proposed_text: proposed,
    uid: candidate.uid,
  })
}

// Print examples
console.log('=== VALIDATION PHASE: 100 SAMPLE NODES ===\n')

let correct_count = 0
let update_count = 0
let skip_count = 0

for (let i = 0; i < Math.min(100, examples.length); i++) {
  const ex = examples[i]

  if (ex.action === 'ALREADY CORRECT') correct_count++
  else if (ex.action === 'UPDATE') update_count++
  else skip_count++

  if (i < 20) {
    // Show first 20 in detail
    console.log(`${i + 1}. [${ex.action}]`)
    console.log(`   Page: ${ex.page_name}`)
    console.log(`   Path: ${ex.path}`)
    console.log(`   Has #Manual: ${ex.has_manual}`)
    console.log(`   Has #Automated: ${ex.has_automated}`)
    console.log(`   Current: "${ex.current_text.substring(0, 60)}${ex.current_text.length > 60 ? '...' : ''}"`)
    if (ex.action !== 'ALREADY CORRECT' && ex.action !== 'SKIP') {
      console.log(`   Proposed: "${ex.proposed_text.substring(0, 60)}${ex.proposed_text.length > 60 ? '...' : ''}"`)
    }
    console.log()
  }
}

console.log(`\n=== VALIDATION SUMMARY ===`)
console.log(`Total candidate nodes found: ${candidates.length}`)
console.log(`Samples analyzed: ${examples.length}`)
console.log(`  Already correct: ${correct_count} (${Math.round((correct_count / examples.length) * 100)}%)`)
console.log(`  Require update: ${update_count} (${Math.round((update_count / examples.length) * 100)}%)`)
console.log(`  Skip: ${skip_count} (${Math.round((skip_count / examples.length) * 100)}%)`)
console.log()
console.log('✓ VALIDATION PHASE COMPLETE')
console.log('No Roam nodes were modified.')
console.log('Awaiting explicit approval before bulk update.')
