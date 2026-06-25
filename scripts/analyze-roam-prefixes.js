#!/usr/bin/env node

/**
 * Analyze Roam test case prefixes to understand what needs standardization
 * Uses roam-cli to query the graph
 */

const { execSync } = require('child_process')

const GRAPH_NAME = 'Project_Kinergy'
const ROOT_PAGE = 'TestSuite : Kinergy'

// Query: Get all test cases from the Test Cases section
const query = `
roam search --graph "${GRAPH_NAME}" --query="Test Cases" --limit=1
`

try {
  console.log('Analyzing test case prefixes in Roam...')
  console.log(`Graph: ${GRAPH_NAME}`)
  console.log(`Root: ${ROOT_PAGE}`)
  console.log('')

  // Execute roam search
  const result = execSync(query, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
  const json = JSON.parse(result)

  if (!json.results || json.results.length === 0) {
    console.log('No Test Cases section found')
    process.exit(1)
  }

  const pageData = json.results[0]
  const markdown = pageData.markdown || ''

  // Parse markdown to extract test cases
  const lines = markdown.split('\n')
  const testCases = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Extract block text (remove markdown formatting)
    let blockText = trimmed
      .replace(/<roam uid="[^"]*"[^>]*\/?>/g, '')
      .replace(/!\[\]\([^)]*\)/g, '')
      .replace(/\[\[([^\]]*)\]\]/g, '$1')
      .replace(/^-\s*/, '')
      .trim()

    if (!blockText) continue

    // Classify the prefix
    const classification = classifyPrefix(blockText)
    testCases.push({
      original: blockText,
      classification,
      trimmed: blockText,
    })
  }

  // Filter to blocks that look like test cases (have content after potential prefix)
  const testCaseBlocks = testCases.filter((tc) => {
    return (
      tc.original.includes('When ') ||
      tc.original.includes('Then ') ||
      tc.original.includes('Given ') ||
      tc.original.includes('Test') ||
      tc.original.includes('#Manual') ||
      tc.original.includes('#Automated')
    )
  })

  // Categorize by prefix type
  const categories = {
    alreadyCorrect: [],
    missingPrefix: [],
    doublePrefix: [],
    invalidVariant: [],
    other: [],
  }

  for (const tc of testCaseBlocks) {
    if (tc.classification === 'CORRECT') {
      categories.alreadyCorrect.push(tc)
    } else if (tc.classification === 'MISSING_PREFIX') {
      categories.missingPrefix.push(tc)
    } else if (tc.classification === 'DOUBLE_PREFIX') {
      categories.doublePrefix.push(tc)
    } else if (tc.classification === 'INVALID_VARIANT') {
      categories.invalidVariant.push(tc)
    } else {
      categories.other.push(tc)
    }
  }

  // Print DRY RUN results (first 50 of each category)
  console.log('=== DRY RUN ANALYSIS ===')
  console.log('')
  console.log(`Total test case blocks found: ${testCaseBlocks.length}`)
  console.log(`  - Already correct: ${categories.alreadyCorrect.length}`)
  console.log(`  - Missing prefix: ${categories.missingPrefix.length}`)
  console.log(`  - Double prefix: ${categories.doublePrefix.length}`)
  console.log(`  - Invalid variant: ${categories.invalidVariant.length}`)
  console.log(`  - Other: ${categories.other.length}`)
  console.log('')

  // Show examples (50 total across categories)
  let exampleCount = 0
  const maxExamples = 50

  console.log('=== BEFORE → AFTER EXAMPLES (First 50) ===')
  console.log('')

  // Already correct
  const correctExamples = categories.alreadyCorrect.slice(0, 10)
  if (correctExamples.length > 0) {
    console.log(`Correct Prefixes (${correctExamples.length}):`)
    for (const tc of correctExamples) {
      console.log(`  ${tc.original} → No change`)
      exampleCount++
    }
    console.log('')
  }

  // Missing prefix
  const missingExamples = categories.missingPrefix.slice(0, 15)
  if (missingExamples.length > 0) {
    console.log(`Missing Prefix (${missingExamples.length}):`)
    for (const tc of missingExamples) {
      console.log(`  "${tc.original}" → "Test:: ${tc.original}"`)
      exampleCount++
    }
    console.log('')
  }

  // Double prefix
  const doubleExamples = categories.doublePrefix.slice(0, 10)
  if (doubleExamples.length > 0) {
    console.log(`Double Prefix (${doubleExamples.length}):`)
    for (const tc of doubleExamples) {
      const normalized = normalizePrefix(tc.original)
      console.log(`  "${tc.original}" → "${normalized}"`)
      exampleCount++
    }
    console.log('')
  }

  // Invalid variants
  const invalidExamples = categories.invalidVariant.slice(0, 15)
  if (invalidExamples.length > 0) {
    console.log(`Invalid Variants (${invalidExamples.length}):`)
    for (const tc of invalidExamples) {
      const normalized = normalizePrefix(tc.original)
      console.log(`  "${tc.original}" → "${normalized}"`)
      exampleCount++
    }
    console.log('')
  }

  console.log(`=== Summary ===`)
  console.log(`Total examples shown: ${Math.min(exampleCount, maxExamples)}`)
  console.log('')
  console.log('Next step: Review the dry run and approve before applying changes.')
} catch (error) {
  console.error('Error:', error.message)
  process.exit(1)
}

function classifyPrefix(text) {
  // Already correct: starts with "Test:: " (space after)
  if (text.match(/^Test::\s/)) {
    return 'CORRECT'
  }

  // Double prefix: contains "Test::" twice or more
  if ((text.match(/Test::/g) || []).length >= 2) {
    return 'DOUBLE_PREFIX'
  }

  // Invalid variants: has test-like prefix but not "Test::"
  if (
    text.match(/^Test:\s/) || // Test: (single colon)
    text.match(/^TEST::\s/) || // TEST:: (uppercase)
    text.match(/^\*\*Test::/) || // **Test:: (markdown)
    text.match(/^Test\s-/) // Test - (hyphen)
  ) {
    return 'INVALID_VARIANT'
  }

  // Missing prefix: looks like test case but no prefix
  if (
    text.includes('When ') ||
    text.includes('Then ') ||
    text.includes('Given ') ||
    text.includes('#Manual') ||
    text.includes('#Automated')
  ) {
    return 'MISSING_PREFIX'
  }

  return 'OTHER'
}

function normalizePrefix(text) {
  // Remove all test-like prefixes
  let normalized = text
    .replace(/^\*\*Test::\s*\*\*/, '') // **Test:: **
    .replace(/^\*\*Test::\s*/, '') // **Test::
    .replace(/^Test::\s*Test::\s*/, '') // Test:: Test::
    .replace(/^Test::\s*/, '') // Test:: (keep this one to readd)
    .replace(/^Test:\s*/, '') // Test: (remove)
    .replace(/^TEST::\s*/, '') // TEST:: (remove)
    .replace(/^Test\s+-\s*/, '') // Test - (remove)
    .trim()

  // Add correct prefix
  return `Test:: ${normalized}`
}
