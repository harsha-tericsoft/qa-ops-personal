#!/usr/bin/env node

/**
 * PHASE 3: LIMITED EXECUTION (FINAL)
 *
 * Uses bash with execSync for proper PATH resolution and string escaping
 * Update 50 blocks with verification
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

function shellEscapeString(str) {
  // Properly escape for bash single quotes
  return "'" + str.replace(/'/g, "'\\''") + "'"
}

async function phase3_execution() {
  log('=' .repeat(70))
  log('PHASE 3: LIMITED EXECUTION (FINAL) - Update 50 blocks')
  log('=' .repeat(70))
  log('')

  // Load preview
  log('Loading preview data...')
  const previewData = JSON.parse(fs.readFileSync(PREVIEW_FILE, 'utf8'))
  const allUpdates = previewData.updates

  // Get updates that need changes
  const updatesToApply = allUpdates
    .filter((u) => u.action !== 'SKIP_ALREADY_CORRECT' && u.changed)
    .slice(0, 50)

  log(`Total to update: ${updatesToApply.length}`)
  log('')

  const results = {
    timestamp: new Date().toISOString(),
    phase: 'PHASE_3_LIMITED_EXECUTION_FINAL',
    graph: GRAPH_NAME,
    blockUpdates: [],
    summary: {
      totalAttempted: updatesToApply.length,
      successfulUpdates: 0,
      verificationPassed: 0,
      verificationFailed: 0,
      failures: [],
    },
  }

  log('STEP 1: Updating blocks...')
  log('')

  // Update blocks
  for (let i = 0; i < updatesToApply.length; i++) {
    const update = updatesToApply[i]
    const progressPercent = ((i + 1) / updatesToApply.length * 100).toFixed(1)

    try {
      // Use bash with properly escaped string
      const escapedText = shellEscapeString(update.after)
      const cmd = `roam update-block --uid "${update.uid}" --string ${escapedText} --graph "${GRAPH_NAME}"`

      execSync(cmd, {
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000,
        shell: '/bin/bash',
      })

      results.summary.successfulUpdates++

      if ((i + 1) % 10 === 0) {
        log(`  [${progressPercent}%] Updated ${i + 1} blocks...`)
      }
    } catch (e) {
      log(`  ERROR updating ${update.uid}: ${e.message.substring(0, 50)}`)
      results.summary.failures.push({
        uid: update.uid,
        error: 'Update failed',
        details: e.message.substring(0, 100),
      })
    }
  }

  log(`\n✓ Updated ${results.summary.successfulUpdates} blocks`)
  log('')

  log('STEP 2: Verifying all updated blocks...')
  log('')

  // Verify updates
  for (let i = 0; i < updatesToApply.length; i++) {
    const update = updatesToApply[i]

    try {
      const getOutput = execSync(
        `roam get-block --uid "${update.uid}" --graph "${GRAPH_NAME}"`,
        {
          encoding: 'utf8',
          maxBuffer: 50 * 1024 * 1024,
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 10000,
          shell: '/bin/bash',
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
        textMatches: currentText === update.after,
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
          expected: update.after.substring(0, 80),
          actual: currentText.substring(0, 80),
        })
      }

      results.blockUpdates.push({
        uid: update.uid,
        verificationPassed: allChecksPassed,
        checks: checks,
      })

      if ((i + 1) % 10 === 0) {
        const progressPercent = ((i + 1) / updatesToApply.length * 100).toFixed(1)
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
    log(`  Total attempted: ${results.summary.totalAttempted}`)
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

      for (let i = 0; i < Math.min(10, results.summary.failures.length); i++) {
        const failure = results.summary.failures[i]
        log(`${i + 1}. UID: ${failure.uid}`)
        log(`   Error: ${failure.error}`)
        if (failure.failedChecks) {
          log(`   Failed checks: ${failure.failedChecks.join(', ')}`)
        }
        if (failure.expected) {
          log(`   Expected: "${failure.expected}..."`)
          log(`   Actual:   "${failure.actual}..."`)
        }
        log('')
      }

      if (results.summary.failures.length > 10) {
        log(`... and ${results.summary.failures.length - 10} more failures`)
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
