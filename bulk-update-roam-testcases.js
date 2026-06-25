#!/usr/bin/env node

/**
 * BULK UPDATE: Standardize Roam test case prefixes to "Test::"
 *
 * PHASES:
 * 1. EXPORT - Backup all candidate blocks
 * 2. DRY RUN - Preview all changes (no modifications)
 * 3. LIMITED EXECUTION - Update 50 blocks, verify
 * 4. FULL EXECUTION - Update remaining blocks
 * 5. FINAL AUDIT - Verify all changes
 *
 * SAFETY MODE: Enabled by default
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const GRAPH_NAME = 'Project_Kinergy'
const BACKUP_FILE = 'roam-testcase-backup.json'
const PREVIEW_FILE = 'roam-testcase-update-preview.json'
const LOG_FILE = 'roam-update.log'

// ============================================================================
// UTILITIES
// ============================================================================

function log(message) {
  console.log(message)
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${message}\n`)
}

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

function cleanBlockText(markdown) {
  // Remove roam tags
  let text = markdown.includes('<roam') ? markdown.split('<roam')[0] : markdown
  // Remove leading dash
  text = text.replace(/^-\s*/, '').trim()
  return text
}

function classifyPrefix(text) {
  if (text.startsWith('Test:: ')) {
    return { action: 'SKIP_ALREADY_CORRECT', count: 1 }
  }

  const testMatches = (text.match(/Test::/g) || []).length
  if (testMatches >= 2) {
    return { action: 'FIX_DOUBLE_PREFIX', count: testMatches }
  }

  if (text.match(/^Test:\s/) || text.match(/^TEST::\s/) || text.match(/^Test\s+-/)) {
    return { action: 'FIX_MALFORMED_PREFIX', count: 1 }
  }

  return { action: 'ADD_PREFIX', count: 0 }
}

function normalizePrefix(text) {
  // Handle double prefix
  if (text.includes('Test:: Test::')) {
    text = text.replace(/Test::\s*Test::/, 'Test::')
  }

  // Handle invalid variants
  text = text.replace(/^Test:\s*/, 'Test:: ')
  text = text.replace(/^TEST::\s*/, 'Test:: ')
  text = text.replace(/^Test\s+-\s*/, 'Test:: ')

  // Add prefix if missing
  if (!text.startsWith('Test::')) {
    text = `Test:: ${text}`
  }

  return text
}

// ============================================================================
// PHASE 1: EXPORT
// ============================================================================

async function phase1_export() {
  log('\n' + '='.repeat(70))
  log('PHASE 1: EXPORT - Backing up all candidate blocks')
  log('='.repeat(70) + '\n')

  const blocks = []
  let totalScanned = 0
  let offset = 0
  const limit = 20

  // Query Manual blocks
  log('Exporting #Manual blocks...')
  while (true) {
    try {
      const output = execSync(
        `roam search --graph "${GRAPH_NAME}" --query="#Manual" --limit=${limit} --offset=${offset}`,
        {
          encoding: 'utf8',
          maxBuffer: 100 * 1024 * 1024,
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 30000,
        }
      )

      const data = extractJsonFromOutput(output)
      if (!data || !data.results || data.results.length === 0) break

      for (const result of data.results) {
        blocks.push({
          uid: result.uid,
          source: '#Manual',
          page: result.path && result.path.length > 0 ? result.path[0] : 'Unknown',
          path: (result.path || []).map((p) => (typeof p === 'string' ? p : p.text || '')),
          markdown: result.markdown,
          text: cleanBlockText(result.markdown),
        })
        totalScanned++
      }

      if (data.results.length < limit) break
      offset += limit
    } catch (e) {
      log(`  Error at offset ${offset}: ${e.message.substring(0, 100)}`)
      break
    }
  }

  // Query Automated blocks
  log('Exporting #Automated blocks...')
  offset = 0
  while (true) {
    try {
      const output = execSync(
        `roam search --graph "${GRAPH_NAME}" --query="#Automated" --limit=${limit} --offset=${offset}`,
        {
          encoding: 'utf8',
          maxBuffer: 100 * 1024 * 1024,
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 30000,
        }
      )

      const data = extractJsonFromOutput(output)
      if (!data || !data.results || data.results.length === 0) break

      for (const result of data.results) {
        blocks.push({
          uid: result.uid,
          source: '#Automated',
          page: result.path && result.path.length > 0 ? result.path[0] : 'Unknown',
          path: (result.path || []).map((p) => (typeof p === 'string' ? p : p.text || '')),
          markdown: result.markdown,
          text: cleanBlockText(result.markdown),
        })
        totalScanned++
      }

      if (data.results.length < limit) break
      offset += limit
    } catch (e) {
      log(`  Error at offset ${offset}: ${e.message.substring(0, 100)}`)
      break
    }
  }

  // Save backup
  const backup = {
    timestamp: new Date().toISOString(),
    graph: GRAPH_NAME,
    totalBlocks: blocks.length,
    blocks,
  }

  fs.writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2))

  log(`\n✓ Backup complete: ${blocks.length} blocks exported`)
  log(`  File: ${BACKUP_FILE}`)
  log(`\nExport Summary:`)
  log(`  Total blocks: ${blocks.length}`)
  log(`  Manual: ${blocks.filter((b) => b.source === '#Manual').length}`)
  log(`  Automated: ${blocks.filter((b) => b.source === '#Automated').length}`)

  return blocks
}

// ============================================================================
// PHASE 2: DRY RUN
// ============================================================================

async function phase2_dryrun(blocks) {
  log('\n' + '='.repeat(70))
  log('PHASE 2: DRY RUN - Analyzing updates (no modifications)')
  log('='.repeat(70) + '\n')

  const updates = []
  const stats = {
    total: blocks.length,
    alreadyCorrect: 0,
    addPrefix: 0,
    fixDouble: 0,
    fixMalformed: 0,
  }

  for (const block of blocks) {
    const classification = classifyPrefix(block.text)

    let after = block.text
    if (classification.action !== 'SKIP_ALREADY_CORRECT') {
      after = normalizePrefix(block.text)
    }

    updates.push({
      uid: block.uid,
      source: block.source,
      page: block.page,
      before: block.text,
      after: after,
      action: classification.action,
      changed: block.text !== after,
    })

    if (classification.action === 'SKIP_ALREADY_CORRECT') stats.alreadyCorrect++
    else if (classification.action === 'ADD_PREFIX') stats.addPrefix++
    else if (classification.action === 'FIX_DOUBLE_PREFIX') stats.fixDouble++
    else if (classification.action === 'FIX_MALFORMED_PREFIX') stats.fixMalformed++
  }

  // Save preview
  const preview = {
    timestamp: new Date().toISOString(),
    graph: GRAPH_NAME,
    phase: 'DRY_RUN',
    statistics: {
      totalCandidates: stats.total,
      alreadyCorrect: stats.alreadyCorrect,
      requireUpdate: stats.addPrefix + stats.fixDouble + stats.fixMalformed,
      actionBreakdown: {
        SKIP_ALREADY_CORRECT: stats.alreadyCorrect,
        ADD_PREFIX: stats.addPrefix,
        FIX_DOUBLE_PREFIX: stats.fixDouble,
        FIX_MALFORMED_PREFIX: stats.fixMalformed,
      },
    },
    updates: updates,
  }

  fs.writeFileSync(PREVIEW_FILE, JSON.stringify(preview, null, 2))

  // Display summary
  log('DRY RUN SUMMARY:\n')
  log(`  Total candidates: ${stats.total}`)
  log(`  Already correct: ${stats.alreadyCorrect} (${((stats.alreadyCorrect / stats.total) * 100).toFixed(1)}%)`)
  log(`  Require update: ${stats.addPrefix + stats.fixDouble + stats.fixMalformed}`)
  log()
  log('  Update breakdown:')
  log(`    - Add prefix: ${stats.addPrefix}`)
  log(`    - Fix double prefix: ${stats.fixDouble}`)
  log(`    - Fix malformed prefix: ${stats.fixMalformed}`)
  log()

  // Show examples
  log('EXAMPLES (first 10 updates):\n')
  for (let i = 0; i < Math.min(10, updates.length); i++) {
    const update = updates[i]
    if (update.changed) {
      log(`${i + 1}. [${update.action}] ${update.source}`)
      log(`   UID: ${update.uid}`)
      log(`   Before: "${update.before.substring(0, 60)}..."`)
      log(`   After:  "${update.after.substring(0, 60)}..."`)
      log()
    }
  }

  log('=' .repeat(70))
  log('DRY RUN COMPLETE - No changes made to Roam')
  log('=' .repeat(70) + '\n')

  log(`Preview saved: ${PREVIEW_FILE}`)
  log(`\nREADY FOR PHASE 3: Limited execution on 50 blocks`)
  log('Awaiting user approval...\n')

  return preview
}

// ============================================================================
// PHASE 3: LIMITED EXECUTION (stub - not executed in this script)
// ============================================================================

async function phase3_limited_execution() {
  log('\n' + '='.repeat(70))
  log('PHASE 3: LIMITED EXECUTION - Update 50 blocks')
  log('='.repeat(70) + '\n')

  log('This phase would:')
  log('  1. Update 50 blocks from the preview')
  log('  2. Re-read all 50 blocks')
  log('  3. Verify Test:: prefix exists')
  log('  4. Verify no duplicates created')
  log('  5. Generate verification report')
  log()
  log('NOT EXECUTING - Awaiting user approval')
}

// ============================================================================
// PHASE 4: FULL EXECUTION (stub - not executed in this script)
// ============================================================================

async function phase4_full_execution() {
  log('\n' + '='.repeat(70))
  log('PHASE 4: FULL EXECUTION - Update all remaining blocks')
  log('='.repeat(70) + '\n')

  log('This phase would:')
  log('  1. Process all blocks from Phase 2 preview')
  log('  2. Skip already correct blocks')
  log('  3. Update blocks with normalized prefix')
  log('  4. Track success/failure')
  log()
  log('NOT EXECUTING - Awaiting user approval from Phase 3')
}

// ============================================================================
// PHASE 5: FINAL AUDIT (stub - not executed in this script)
// ============================================================================

async function phase5_final_audit() {
  log('\n' + '='.repeat(70))
  log('PHASE 5: FINAL AUDIT - Verify all changes')
  log('='.repeat(70) + '\n')

  log('This phase would:')
  log('  1. Scan all test cases for missing Test::')
  log('  2. Verify no double prefixes exist')
  log('  3. Generate final audit report')
  log('  4. Confirm all blocks have exactly one Test::')
  log()
  log('NOT EXECUTING - Awaiting completion of Phase 4')
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(70))
  console.log('ROAM TEST CASE STANDARDIZATION - BULK UPDATE SCRIPT')
  console.log('SAFETY MODE: ENABLED')
  console.log('='.repeat(70) + '\n')

  try {
    // Phase 1: Export
    const blocks = await phase1_export()

    // Phase 2: Dry Run
    const preview = await phase2_dryrun(blocks)

    // Phases 3-5: Stubs (not executed)
    console.log('\n' + '='.repeat(70))
    console.log('STATUS: STOPPED AFTER DRY RUN')
    console.log('='.repeat(70) + '\n')

    console.log('FILES GENERATED:')
    console.log(`  ✓ ${BACKUP_FILE} - Complete backup of all ${blocks.length} blocks`)
    console.log(`  ✓ ${PREVIEW_FILE} - Update preview with before/after`)
    console.log(`  ✓ ${LOG_FILE} - Execution log`)
    console.log()

    console.log('NEXT STEPS:')
    console.log('  1. Review the dry run summary above')
    console.log(`  2. Verify ${BACKUP_FILE} contains all blocks`)
    console.log(`  3. Check ${PREVIEW_FILE} for update correctness`)
    console.log('  4. Approve to proceed with Phase 3 (50-block test)')
    console.log()
  } catch (error) {
    log(`FATAL ERROR: ${error.message}`)
    console.error('Error:', error)
    process.exit(1)
  }
}

// Execute
main()
