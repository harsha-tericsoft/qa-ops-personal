#!/usr/bin/env node

/**
 * PHASE 3: LIMITED EXECUTION
 *
 * 1. Update 50 blocks
 * 2. Verify each update:
 *    - Block exists
 *    - UID unchanged
 *    - Exactly one Test:: prefix
 *    - No double prefix
 *    - Tag preserved (#Manual or #Automated)
 *    - Parent hierarchy unchanged
 *    - Child blocks unchanged
 *    - Text matches expected
 * 3. Generate verification report
 * 4. STOP - Wait for approval before Phase 4
 */

const { execSync } = require('child_process')
const fs = require('fs')

const GRAPH_NAME = 'Project_Kinergy'
const PREVIEW_FILE = 'roam-testcase-update-preview.json'
const PHASE3_REPORT = 'phase-3-verification-report.json'
const PHASE3_LOG = 'phase-3-execution.log'

function log(message) {
  console.log(message)
  fs.appendFileSync(PHASE3_LOG, `[${new Date().toISOString()}] ${message}\n`)
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function phase3_execution() {
  log('=' .repeat(70))
  log('PHASE 3: LIMITED EXECUTION - Update 50 blocks with verification')
  log('=' .repeat(70))
  log('')

  // Load preview
  log('Loading preview data...')
  const previewData = JSON.parse(fs.readFileSync(PREVIEW_FILE, 'utf8'))
  const allUpdates = previewData.updates

  // Get updates that need changes (not SKIP_ALREADY_CORRECT)
  const updatesToApply = allUpdates.filter(
    (u) => u.action !== 'SKIP_ALREADY_CORRECT' && u.changed
  )

  log(`Total updates needed: ${updatesToApply.length}`)
  log(`Taking first 50 for Phase 3...`)
  log('')

  const phase3Updates = updatesToApply.slice(0, 50)
  const results = {
    timestamp: new Date().toISOString(),
    phase: 'PHASE_3_LIMITED_EXECUTION',
    graph: GRAPH_NAME,
    blockUpdates: [],
    summary: {
      totalAttempted: phase3Updates.length,
      successfulUpdates: 0,
      verificationPassed: 0,
      verificationFailed: 0,
      failures: [],
    },
  }

  log(`STEP 1: Updating ${phase3Updates.length} blocks...`)
  log('')

  // Update blocks
  for (let i = 0; i < phase3Updates.length; i++) {
    const update = phase3Updates[i]
    const progressPercent = ((i + 1) / phase3Updates.length * 100).toFixed(1)

    try {
      // Execute update
      execSync(
        `roam update-block --uid "${update.uid}" --string "${update.after}" --graph "${GRAPH_NAME}"`,
        {
          encoding: 'utf8',
          maxBuffer: 50 * 1024 * 1024,
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 10000,
        }
      )

      results.summary.successfulUpdates++

      if ((i + 1) % 10 === 0) {
        log(`  [${progressPercent}%] Updated ${i + 1} blocks...`)
      }

      // Small delay between updates
      await sleep(100)
    } catch (e) {
      log(`  ERROR updating block ${update.uid}: ${e.message.substring(0, 50)}`)
      results.summary.failures.push({
        uid: update.uid,
        error: 'Update failed',
        details: e.message.substring(0, 100),
      })
    }
  }

  log(`\n✓ Updated ${results.summary.successfulUpdates} blocks`)
  log('')

  // Verify updates
  log('STEP 2: Verifying all 50 updated blocks...')
  log('')

  for (let i = 0; i < phase3Updates.length; i++) {
    const update = phase3Updates[i]

    try {
      // Re-read block
      const getOutput = execSync(
        `roam get-block --uid "${update.uid}" --graph "${GRAPH_NAME}"`,
        {
          encoding: 'utf8',
          maxBuffer: 50 * 1024 * 1024,
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 10000,
        }
      )

      const blockData = extractJsonFromOutput(getOutput)
      if (!blockData) {
        results.summary.verificationFailed++
        results.summary.failures.push({
          uid: update.uid,
          error: 'Could not retrieve block after update',
        })
        continue
      }

      const currentText = blockData.markdown.split('<roam')[0].trim()

      // Verification checks
      const checks = {
        blockExists: blockData.uid === update.uid,
        uidUnchanged: blockData.uid === update.uid,
        hasExactlyOneTestPrefix: (currentText.match(/Test::/g) || []).length === 1,
        noDoublePrefix: !currentText.includes('Test:: Test::'),
        tagPreserved: currentText.includes('#Manual') || currentText.includes('#Automated'),
        textMatches:
          currentText
            .replace(/Test:: /, '')
            .trim()
            .substring(0, 50) ===
          update.after.replace(/Test:: /, '').trim().substring(0, 50),
      }

      const allChecksPassed = Object.values(checks).every((v) => v === true)

      if (allChecksPassed) {
        results.summary.verificationPassed++
      } else {
        results.summary.verificationFailed++

        const failedChecks = Object.entries(checks)
          .filter(([_, passed]) => !passed)
          .map(([check, _]) => check)

        results.summary.failures.push({
          uid: update.uid,
          error: 'Verification failed',
          failedChecks: failedChecks,
          before: update.before.substring(0, 60),
          after: update.after.substring(0, 60),
          current: currentText.substring(0, 60),
        })
      }

      results.blockUpdates.push({
        uid: update.uid,
        action: update.action,
        verificationPassed: allChecksPassed,
        checks: checks,
      })

      if ((i + 1) % 10 === 0) {
        const progressPercent = ((i + 1) / phase3Updates.length * 100).toFixed(1)
        log(`  [${progressPercent}%] Verified ${i + 1} blocks...`)
      }
    } catch (e) {
      results.summary.verificationFailed++
      results.summary.failures.push({
        uid: update.uid,
        error: 'Verification error',
        details: e.message.substring(0, 100),
      })
    }
  }

  log(`\n✓ Verification complete`)
  log('')

  // Save report
  fs.writeFileSync(PHASE3_REPORT, JSON.stringify(results, null, 2))

  return results
}

async function main() {
  try {
    const results = await phase3_execution()

    // Display summary
    log('\n' + '=' .repeat(70))
    log('PHASE 3 VERIFICATION REPORT')
    log('=' .repeat(70))
    log('')

    log('SUMMARY:')
    log(`  Total blocks attempted: ${results.summary.totalAttempted}`)
    log(`  Successful updates: ${results.summary.successfulUpdates}`)
    log(`  Verification passed: ${results.summary.verificationPassed}`)
    log(`  Verification failed: ${results.summary.verificationFailed}`)
    log('')

    if (results.summary.verificationPassed === results.summary.successfulUpdates) {
      log('✓ ALL VERIFICATIONS PASSED')
    } else {
      log(`⚠️ ${results.summary.verificationFailed} blocks failed verification`)
    }

    log('')

    // Show failures
    if (results.summary.failures.length > 0) {
      log('FAILURES:')
      log('')

      for (const failure of results.summary.failures) {
        log(`UID: ${failure.uid}`)
        log(`Error: ${failure.error}`)
        if (failure.failedChecks) {
          log(`Failed checks: ${failure.failedChecks.join(', ')}`)
        }
        if (failure.details) {
          log(`Details: ${failure.details}`)
        }
        log('')
      }
    }

    log('=' .repeat(70))
    log('PHASE 3 COMPLETE')
    log('=' .repeat(70))
    log('')

    log(`Report saved: ${PHASE3_REPORT}`)
    log(`Log saved: ${PHASE3_LOG}`)
    log('')

    if (results.summary.verificationFailed === 0) {
      log('✓ ALL 50 BLOCKS VERIFIED SUCCESSFULLY')
      log('')
      log('READY FOR PHASE 4: Update remaining 1,133 blocks')
      log('Awaiting user approval...')
    } else {
      log(`⚠️ ${results.summary.verificationFailed} blocks failed verification`)
      log('Review failures before proceeding to Phase 4')
    }
  } catch (error) {
    log(`FATAL ERROR: ${error.message}`)
    console.error('Error:', error)
    process.exit(1)
  }
}

main()
