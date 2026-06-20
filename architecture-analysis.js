const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const projectId = '79d857b2-36dd-4810-88ae-3ca8d9aaa8d4'

async function test() {
  console.log('DASHBOARD ARCHITECTURE ANALYSIS')
  console.log('='.repeat(80))

  try {
    // Check current data
    const cycles = await prisma.executionCycle.findMany({
      where: { projectId },
    })

    const suites = await prisma.testSuite.findMany({
      where: { projectId },
    })

    const testCases = await prisma.testCase.findMany({
      where: { projectId },
    })

    const allTestRuns = await prisma.testRun.findMany({
      where: { cycle: { projectId } },
    })

    console.log('\n1. PROJECT-LEVEL METRICS')
    console.log('   (Dashboard shows these)')
    console.log('   - Total Test Cases: ' + testCases.length)
    console.log('   - Total Test Suites: ' + suites.length)
    console.log('   - Total Execution Cycles: ' + cycles.length)
    console.log('   - Total Test Runs: ' + allTestRuns.length)
    console.log('   - Aggregated PASS: ' + allTestRuns.filter(r => r.status === 'PASS').length)
    console.log('   - Aggregated FAIL: ' + allTestRuns.filter(r => r.status === 'FAIL').length)
    console.log('   - Aggregated BLOCKED: ' + allTestRuns.filter(r => r.status === 'BLOCKED').length)
    console.log('   - Aggregated NOT_EXECUTED: ' + allTestRuns.filter(r => r.status === 'NOT_EXECUTED').length)
    console.log('   - Pass Rate: (pass / executed) %')
    console.log('   - Execution Rate: (executed / total) %')

    console.log('\n2. CYCLE-LEVEL METRICS')
    console.log('   (Displayed when viewing a cycle)')
    console.log('   - Cycle Name')
    console.log('   - Cycle Status (PLANNED, IN_PROGRESS, COMPLETED, ABORTED)')
    console.log('   - Test Cases in Cycle')
    console.log('   - PASS Count')
    console.log('   - FAIL Count')
    console.log('   - BLOCKED Count')
    console.log('   - NOT_EXECUTED Count')
    console.log('   - Source Suite (if created from suite)')

    console.log('\n3. SUITE-LEVEL METRICS')
    console.log('   (Currently displayed in Test Suites page)')
    console.log('   - Suite Name')
    console.log('   - Test Case Count')
    console.log('   - Category')
    console.log('   - Description')
    console.log('   - NOTE: Suites track INCLUDED test cases, not execution status')

    console.log('\n4. FILTER OPTIONS')
    console.log('   - Project Selector (Project-level filter)')
    console.log('   - NOTE: No cycle-level filter on dashboard')
    console.log('   - NOTE: No suite-level filter on dashboard')
    console.log('   - NOTE: Dashboard aggregates ALL cycles and suites for selected project')

    console.log('\n' + '='.repeat(80))
    console.log('CURRENT DATA STATE')
    console.log('='.repeat(80))
    console.log('Execution Cycles: ' + cycles.length)
    console.log('Test Suites: ' + suites.length)
    console.log('Test Cases: ' + testCases.length)
    console.log('Test Runs: ' + allTestRuns.length)

  } catch (e) {
    console.error('Error:', e.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

test()
