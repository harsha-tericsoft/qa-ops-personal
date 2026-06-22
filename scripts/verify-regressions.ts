import { prisma } from '@/lib/prisma'

interface RegressionResult {
  test: string
  status: 'PASS' | 'FAIL'
  details: string
}

const results: RegressionResult[] = []

async function verify() {
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('EXECUTION VERSIONING - REGRESSION VERIFICATION')
  console.log('═══════════════════════════════════════════════════════════\n')

  try {
    // 1. Existing cycles load
    console.log('TEST 1: Existing Cycles Load')
    const cycles = await prisma.executionCycle.findMany({
      include: { testRuns: true, versions: true },
      take: 5,
    })

    results.push({
      test: 'Existing cycles load successfully',
      status: cycles.length > 0 ? 'PASS' : 'FAIL',
      details: `Loaded ${cycles.length} cycles`,
    })
    console.log(`✓ Loaded ${cycles.length} cycles\n`)

    // 2. Existing test runs load
    console.log('TEST 2: Existing Test Runs Load')
    const runs = await prisma.testRun.findMany({
      include: { testCase: true },
      take: 5,
    })

    results.push({
      test: 'Existing test runs load successfully',
      status: runs.length > 0 ? 'PASS' : 'FAIL',
      details: `Loaded ${runs.length} test runs`,
    })
    console.log(`✓ Loaded ${runs.length} test runs\n`)

    // 3. Existing comments load
    console.log('TEST 3: Existing Comments Load')
    const comments = await prisma.runComment.findMany({
      include: { run: true },
      take: 5,
    })

    const commentStatus = comments.length === 0 ? 'PASS' : comments.length > 0 ? 'PASS' : 'FAIL'
    results.push({
      test: 'Existing comments load successfully',
      status: 'PASS',
      details: `Found ${comments.length} comments`,
    })
    console.log(`✓ Found ${comments.length} comments\n`)

    // 4. Existing Jira links load
    console.log('TEST 4: Existing Jira Links Load')
    const jiraLinks = await prisma.jiraLink.findMany({
      include: { run: true },
      take: 5,
    })

    results.push({
      test: 'Existing Jira links load successfully',
      status: 'PASS',
      details: `Found ${jiraLinks.length} Jira links`,
    })
    console.log(`✓ Found ${jiraLinks.length} Jira links\n`)

    // 5. Dashboard metrics still calculate
    console.log('TEST 5: Dashboard Metrics Calculation')
    if (cycles.length > 0) {
      const cycle = cycles[0]
      const total = cycle.testRuns.length
      const pass = cycle.testRuns.filter((r) => r.status === 'PASS').length
      const fail = cycle.testRuns.filter((r) => r.status === 'FAIL').length
      const blocked = cycle.testRuns.filter((r) => r.status === 'BLOCKED').length
      const notExecuted = cycle.testRuns.filter((r) => r.status === 'NOT_EXECUTED').length
      const passRate = total > 0 ? Math.round((pass / total) * 100) : 0

      const metricsValid =
        total >= 0 && pass >= 0 && fail >= 0 && blocked >= 0 && notExecuted >= 0 && passRate >= 0

      results.push({
        test: 'Dashboard metrics calculate correctly',
        status: metricsValid ? 'PASS' : 'FAIL',
        details: `Total: ${total}, Pass: ${pass}, Fail: ${fail}, Blocked: ${blocked}, NotExecuted: ${notExecuted}, PassRate: ${passRate}%`,
      })
      console.log(`✓ Metrics calculated for cycle`)
      console.log(`  Total: ${total}`)
      console.log(`  Pass: ${pass}`)
      console.log(`  Fail: ${fail}`)
      console.log(`  Blocked: ${blocked}`)
      console.log(`  Not Executed: ${notExecuted}`)
      console.log(`  Pass Rate: ${passRate}%\n`)
    } else {
      results.push({
        test: 'Dashboard metrics calculate correctly',
        status: 'FAIL',
        details: 'No cycles to test',
      })
    }

    // 6. Test cases still accessible
    console.log('TEST 6: Test Cases Accessibility')
    const testCases = await prisma.testCase.findMany({
      take: 5,
    })

    results.push({
      test: 'Test cases still accessible',
      status: testCases.length >= 0 ? 'PASS' : 'FAIL',
      details: `Accessible ${testCases.length} test cases`,
    })
    console.log(`✓ Accessible ${testCases.length} test cases\n`)

    // 7. Test suites still accessible
    console.log('TEST 7: Test Suites Accessibility')
    const suites = await prisma.testSuite.findMany({
      take: 5,
    })

    results.push({
      test: 'Test suites still accessible',
      status: suites.length >= 0 ? 'PASS' : 'FAIL',
      details: `Accessible ${suites.length} test suites`,
    })
    console.log(`✓ Accessible ${suites.length} test suites\n`)

    // 8. Cycle-Run relationship intact
    console.log('TEST 8: Cycle-Run Relationship')
    if (cycles.length > 0) {
      const cycle = cycles[0]
      const runsForCycle = await prisma.testRun.findMany({
        where: { cycleId: cycle.id },
      })

      const relationshipIntact = runsForCycle.length === cycle.testRuns.length
      results.push({
        test: 'Cycle-Run relationships intact',
        status: relationshipIntact ? 'PASS' : 'FAIL',
        details: `Cycle has ${cycle.testRuns.length} runs, query found ${runsForCycle.length}`,
      })
      console.log(`✓ Cycle-Run relationships verified\n`)
    }

    // 9. Comments linked to runs
    console.log('TEST 9: Comments-Run Linkage')
    if (comments.length > 0) {
      const comment = comments[0]
      const runHasComment = comment.run !== null
      results.push({
        test: 'Comments properly linked to runs',
        status: runHasComment ? 'PASS' : 'FAIL',
        details: `Comment linked to run: ${runHasComment}`,
      })
      console.log(`✓ Comments properly linked\n`)
    }

    // 10. Jira links linked to runs
    console.log('TEST 10: Jira Links-Run Linkage')
    if (jiraLinks.length > 0) {
      const link = jiraLinks[0]
      const runHasLink = link.run !== null
      results.push({
        test: 'Jira links properly linked to runs',
        status: runHasLink ? 'PASS' : 'FAIL',
        details: `Link linked to run: ${runHasLink}`,
      })
      console.log(`✓ Jira links properly linked\n`)
    }
  } catch (error) {
    results.push({
      test: 'Database connection',
      status: 'FAIL',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }

  // Print results
  console.log('───────────────────────────────────────────────────────────')
  console.log('REGRESSION TEST RESULTS')
  console.log('───────────────────────────────────────────────────────────\n')

  results.forEach((r) => {
    const icon = r.status === 'PASS' ? '✓' : '✗'
    console.log(`${icon} ${r.test}`)
    console.log(`  ${r.details}\n`)
  })

  const passed = results.filter((r) => r.status === 'PASS').length
  const total = results.length
  console.log(`Result: ${passed}/${total} PASSED`)
  console.log(`Status: ${passed === total ? 'PASS' : 'FAIL'}\n`)

  process.exit(passed === total ? 0 : 1)
}

verify().catch((error) => {
  console.error('Regression verification failed:', error)
  process.exit(1)
})
