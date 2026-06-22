import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

interface VerificationResult {
  suite: string
  status: 'PASS' | 'FAIL' | 'WARNING'
  timestamp: string
  tests: {
    passed: number
    failed: number
    warnings: number
    total: number
  }
  output: string
}

const allResults: VerificationResult[] = []
const startTime = Date.now()

function logSection(title: string) {
  console.log('\n' + '═'.repeat(70))
  console.log(title)
  console.log('═'.repeat(70) + '\n')
}

function logSuccess(message: string) {
  console.log(`✓ ${message}`)
}

function logError(message: string) {
  console.log(`✗ ${message}`)
}

function logWarning(message: string) {
  console.log(`⚠ ${message}`)
}

async function runVerification(script: string, name: string): Promise<VerificationResult> {
  logSection(`${name}`)

  try {
    const output = execSync(`npx ts-node ${script}`, {
      encoding: 'utf-8',
      stdio: 'pipe',
      cwd: process.cwd(),
    })

    console.log(output)

    // Parse output for results
    const passMatch = output.match(/Result: (\d+)\/(\d+) PASSED/)
    if (passMatch) {
      const passed = parseInt(passMatch[1])
      const total = parseInt(passMatch[2])
      const failed = total - passed

      const result: VerificationResult = {
        suite: name,
        status: failed === 0 ? 'PASS' : 'FAIL',
        timestamp: new Date().toISOString(),
        tests: {
          passed,
          failed,
          warnings: 0,
          total,
        },
        output,
      }

      allResults.push(result)
      return result
    }

    // If no match found, check for errors
    if (output.toLowerCase().includes('error') || output.toLowerCase().includes('fail')) {
      const result: VerificationResult = {
        suite: name,
        status: 'FAIL',
        timestamp: new Date().toISOString(),
        tests: {
          passed: 0,
          failed: 1,
          warnings: 0,
          total: 1,
        },
        output,
      }
      allResults.push(result)
      return result
    }

    const result: VerificationResult = {
      suite: name,
      status: 'WARNING',
      timestamp: new Date().toISOString(),
      tests: {
        passed: 0,
        failed: 0,
        warnings: 1,
        total: 1,
      },
      output: 'Could not parse results',
    }
    allResults.push(result)
    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logError(`${name} execution failed: ${errorMessage}`)

    const result: VerificationResult = {
      suite: name,
      status: 'FAIL',
      timestamp: new Date().toISOString(),
      tests: {
        passed: 0,
        failed: 1,
        warnings: 0,
        total: 1,
      },
      output: errorMessage,
    }
    allResults.push(result)
    return result
  }
}

async function generateFinalReport() {
  logSection('FINAL VERIFICATION REPORT')

  const totalTests = allResults.reduce((sum, r) => sum + r.tests.total, 0)
  const totalPassed = allResults.reduce((sum, r) => sum + r.tests.passed, 0)
  const totalFailed = allResults.reduce((sum, r) => sum + r.tests.failed, 0)
  const totalWarnings = allResults.reduce((sum, r) => sum + r.tests.warnings, 0)
  const passRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0

  // Summary table
  console.log('VERIFICATION SUITE SUMMARY')
  console.log('─'.repeat(70))

  allResults.forEach((r) => {
    const statusIcon = r.status === 'PASS' ? '✓' : r.status === 'FAIL' ? '✗' : '⚠'
    const statusPad = `${statusIcon} ${r.status}`.padEnd(8)
    const suitePad = r.suite.padEnd(35)
    const testsPad = `${r.tests.passed}/${r.tests.total}`.padEnd(8)

    console.log(`${suitePad} │ ${statusPad} │ ${testsPad}`)
  })

  console.log('─'.repeat(70))

  // Totals
  console.log('\nOVERALL RESULTS')
  console.log('─'.repeat(70))
  console.log(`Total Tests:    ${totalTests}`)
  console.log(`Passed:         ${totalPassed}`)
  console.log(`Failed:         ${totalFailed}`)
  console.log(`Warnings:       ${totalWarnings}`)
  console.log(`Pass Rate:      ${passRate}%`)
  console.log('─'.repeat(70))

  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2)
  console.log(`\nElapsed Time: ${elapsedTime}s\n`)

  // Final status
  if (totalFailed === 0 && totalWarnings === 0) {
    logSuccess('ALL VERIFICATIONS PASSED')
    console.log('\n✓ Ready for deployment')
    return 0
  } else if (totalFailed === 0) {
    logWarning(`${totalWarnings} warning(s) found`)
    console.log('\n⚠ Review warnings before deployment')
    return 1
  } else {
    logError(`${totalFailed} verification(s) failed`)
    console.log('\n✗ Fix failures before deployment')
    return 1
  }
}

async function main() {
  logSection('EXECUTION VERSIONING - COMPLETE VERIFICATION SUITE')

  console.log('Running all verification scripts...\n')

  // Run all verifications
  await runVerification('scripts/verify-execution-versioning-db.ts', 'Database Verification')
  await runVerification('scripts/verify-regressions.ts', 'Regression Verification')

  // Note: API verification requires dev server
  try {
    await runVerification('scripts/verify-execution-versioning-api.ts', 'API Verification')
  } catch (error) {
    logWarning('API verification skipped (dev server may not be running)')
    console.log('Start dev server with: npm run dev')
  }

  // Generate final report
  const exitCode = await generateFinalReport()

  // Save report to file
  const reportPath = path.join(process.cwd(), 'verification-report.json')
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        results: allResults,
        summary: {
          total: allResults.reduce((sum, r) => sum + r.tests.total, 0),
          passed: allResults.reduce((sum, r) => sum + r.tests.passed, 0),
          failed: allResults.reduce((sum, r) => sum + r.tests.failed, 0),
          warnings: allResults.reduce((sum, r) => sum + r.tests.warnings, 0),
        },
      },
      null,
      2
    )
  )

  console.log(`\nDetailed report saved to: ${reportPath}\n`)

  process.exit(exitCode)
}

main().catch((error) => {
  logError('Verification suite failed')
  console.error(error)
  process.exit(1)
})
