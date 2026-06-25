#!/usr/bin/env node

/**
 * INVESTIGATION & RESTORATION
 *
 * 1. Identify which 50 blocks were corrupted
 * 2. Compare original vs current vs expected
 * 3. Generate corruption report
 * 4. Restore from backup
 * 5. Verify restoration
 */

const { execSync } = require('child_process')
const fs = require('fs')

const GRAPH = 'Project_Kinergy'
const BACKUP_FILE = 'roam-testcase-backup.json'
const PREVIEW_FILE = 'roam-testcase-update-preview.json'
const CORRUPTION_REPORT = 'phase-3-corruption-report.json'
const RESTORATION_REPORT = 'phase-3-restoration-report.json'

function log(msg) {
  console.log(msg)
  fs.appendFileSync('phase-3-investigation.log', `[${new Date().toISOString()}] ${msg}\n`)
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

async function investigateCorruption() {
  log('=' .repeat(70))
  log('PHASE 3 CORRUPTION INVESTIGATION')
  log('=' .repeat(70))
  log('')

  const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'))
  const preview = JSON.parse(fs.readFileSync(PREVIEW_FILE, 'utf8'))

  // Get the 50 blocks that were attempted
  const attemptedUpdates = preview.updates
    .filter((u) => u.action !== 'SKIP_ALREADY_CORRECT' && u.changed)
    .slice(0, 50)

  log(`Investigating ${attemptedUpdates.length} blocks that were updated...`)
  log('')

  const corrupted = []
  const successful = []
  const failed = []

  for (let i = 0; i < attemptedUpdates.length; i++) {
    const update = attemptedUpdates[i]

    try {
      // Get current state from Roam
      const currentJson = execSync(
        `roam get-block --uid "${update.uid}" --graph "${GRAPH}"`,
        {
          encoding: 'utf8',
          maxBuffer: 50 * 1024 * 1024,
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 10000,
        }
      )

      const currentData = extractJsonFromOutput(currentJson)
      if (!currentData) {
        failed.push(update.uid)
        continue
      }

      const current = currentData.markdown.split('<roam')[0].trim()
      const original = update.before
      const expected = update.after

      // Check if corrupted
      if (current === expected) {
        successful.push({
          uid: update.uid,
          status: 'SUCCESSFULLY_UPDATED',
        })
      } else if (current === original) {
        failed.push({
          uid: update.uid,
          status: 'NOT_UPDATED',
        })
      } else {
        // Corrupted
        corrupted.push({
          uid: update.uid,
          original: original,
          expected: expected,
          actual: current,
          status: 'CORRUPTED',
          analysis: {
            has_test_prefix: current.includes('Test::'),
            test_count: (current.match(/Test::/g) || []).length,
            double_prefix: current.includes('Test:: Test::'),
            length_original: original.length,
            length_expected: expected.length,
            length_actual: current.length,
          },
        })
      }

      if ((i + 1) % 10 === 0) {
        log(`  Investigated ${i + 1}/${attemptedUpdates.length}...`)
      }
    } catch (e) {
      log(`  Error reading ${update.uid}: ${e.message.substring(0, 50)}`)
      failed.push(update.uid)
    }
  }

  log('')
  log('CORRUPTION STATUS:')
  log(`  Successfully updated: ${successful.length}`)
  log(`  Corrupted: ${corrupted.length}`)
  log(`  Not updated: ${typeof failed[0] === 'string' ? failed.length : failed.filter(f => f.status === 'NOT_UPDATED').length}`)
  log(`  Errors: ${typeof failed[0] === 'string' ? 0 : failed.filter(f => !f.status).length}`)
  log('')

  // Save corruption report
  const corruptionReport = {
    timestamp: new Date().toISOString(),
    totalInvestigated: attemptedUpdates.length,
    summary: {
      successful: successful.length,
      corrupted: corrupted.length,
      notUpdated: typeof failed[0] === 'string' ? failed.length : failed.filter(f => f.status === 'NOT_UPDATED').length,
    },
    corruptedBlocks: corrupted,
  }

  fs.writeFileSync(CORRUPTION_REPORT, JSON.stringify(corruptionReport, null, 2))
  log(`Corruption report saved: ${CORRUPTION_REPORT}`)
  log('')

  return {
    corrupted,
    successful,
    failed,
    attemptedUpdates,
  }
}

async function restoreFromBackup(investigation) {
  log('=' .repeat(70))
  log('PHASE 3 RESTORATION')
  log('=' .repeat(70))
  log('')

  const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'))

  // Restore all 50 blocks to original state
  const allBlocks = investigation.attemptedUpdates.map((u) => u.uid)

  log(`Restoring ${allBlocks.length} blocks to original state...`)
  log('')

  const restoreResults = {
    timestamp: new Date().toISOString(),
    totalRestored: 0,
    totalFailed: 0,
    blocks: [],
  }

  for (let i = 0; i < allBlocks.length; i++) {
    const uid = allBlocks[i]

    // Find original in backup
    const backupBlock = backup.blocks.find((b) => b.uid === uid)
    if (!backupBlock) {
      log(`  SKIP: ${uid} not in backup`)
      restoreResults.totalFailed++
      continue
    }

    const originalText = backupBlock.text

    try {
      // Create a temporary JSON file with the update command
      // This avoids shell escaping issues
      const updatePayload = {
        uid: uid,
        string: originalText,
        graph: GRAPH,
      }

      const tempFile = `/tmp/update-${uid}.json`
      fs.writeFileSync(tempFile, JSON.stringify(updatePayload))

      // Use roam update-block with the data
      // Note: roam-cli may not support JSON file input, so we still use CLI but with better handling
      const cmd = `roam update-block --uid "${uid}" --string "${originalText.replace(/"/g, '\\"')}" --graph "${GRAPH}"`

      try {
        execSync(cmd, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 10000,
        })

        restoreResults.totalRestored++
        restoreResults.blocks.push({
          uid: uid,
          status: 'RESTORED',
        })

        if ((i + 1) % 10 === 0) {
          log(`  Restored ${i + 1}/${allBlocks.length}...`)
        }
      } catch (e) {
        // Restoration failed - log but continue
        restoreResults.totalFailed++
        restoreResults.blocks.push({
          uid: uid,
          status: 'RESTORE_FAILED',
          error: e.message.substring(0, 100),
        })
      }
    } catch (e) {
      restoreResults.totalFailed++
      restoreResults.blocks.push({
        uid: uid,
        status: 'ERROR',
        error: e.message.substring(0, 100),
      })
    }
  }

  log('')
  log(`✓ Restoration complete: ${restoreResults.totalRestored} restored, ${restoreResults.totalFailed} failed`)
  log('')

  fs.writeFileSync(RESTORATION_REPORT, JSON.stringify(restoreResults, null, 2))

  return restoreResults
}

async function verifyRestoration(restoration, investigation) {
  log('=' .repeat(70))
  log('VERIFICATION: Restored blocks match backup')
  log('=' .repeat(70))
  log('')

  const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'))
  const allBlocks = investigation.attemptedUpdates.map((u) => u.uid)

  let verified = 0
  let mismatches = 0

  for (let i = 0; i < allBlocks.length; i++) {
    const uid = allBlocks[i]

    try {
      // Get current state
      const currentJson = execSync(
        `roam get-block --uid "${uid}" --graph "${GRAPH}"`,
        {
          encoding: 'utf8',
          maxBuffer: 50 * 1024 * 1024,
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 10000,
        }
      )

      const currentData = extractJsonFromOutput(currentJson)
      if (!currentData) continue

      const current = currentData.markdown.split('<roam')[0].trim()
      const backupBlock = backup.blocks.find((b) => b.uid === uid)

      if (!backupBlock) continue

      const originalText = backupBlock.text

      if (current === originalText) {
        verified++
      } else {
        mismatches++
        if (mismatches <= 5) {
          log(`  MISMATCH: ${uid}`)
          log(`    Expected: ${originalText.substring(0, 60)}...`)
          log(`    Got:      ${current.substring(0, 60)}...`)
        }
      }

      if ((i + 1) % 10 === 0) {
        log(`  Verified ${i + 1}/${allBlocks.length}...`)
      }
    } catch (e) {
      log(`  Error verifying ${uid}`)
    }
  }

  log('')
  log(`Verification result: ${verified} verified, ${mismatches} mismatches`)
  log('')

  return { verified, mismatches }
}

async function main() {
  try {
    // Step 1: Investigate corruption
    const investigation = await investigateCorruption()

    // Step 2: Restore from backup
    const restoration = await restoreFromBackup(investigation)

    // Step 3: Verify restoration
    const verification = await verifyRestoration(restoration, investigation)

    // Final summary
    log('=' .repeat(70))
    log('INVESTIGATION & RESTORATION COMPLETE')
    log('=' .repeat(70))
    log('')

    log(`SUMMARY:`)
    log(`  Blocks investigated: ${investigation.attemptedUpdates.length}`)
    log(`  Blocks corrupted: ${investigation.corrupted.length}`)
    log(`  Blocks restored: ${restoration.totalRestored}`)
    log(`  Verification passed: ${verification.verified}`)
    log('')

    if (verification.mismatches === 0) {
      log('✓ ALL BLOCKS SUCCESSFULLY RESTORED')
      log('')
      log('NEXT STEP: Create Unicode-safe update implementation')
    } else {
      log(`⚠️  ${verification.mismatches} blocks failed verification`)
      log('Manual review may be needed')
    }

    log('')
    log(`Reports saved:`)
    log(`  - ${CORRUPTION_REPORT}`)
    log(`  - ${RESTORATION_REPORT}`)
  } catch (error) {
    log(`FATAL ERROR: ${error.message}`)
    console.error('Error:', error)
    process.exit(1)
  }
}

main()
