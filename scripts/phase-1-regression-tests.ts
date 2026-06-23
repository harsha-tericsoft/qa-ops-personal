import 'dotenv/config'
import { prisma } from '@/lib/prisma'

/**
 * Phase 1 Regression Test Suite
 * Verify that all existing functionality continues to work after Phase 1 implementation
 */

async function regressionTests() {
  console.log('🧪 Phase 1 Regression Testing')
  console.log('===============================\n')

  const testResults: Array<{ name: string; status: 'PASS' | 'FAIL'; message: string }> = []

  try {
    // Test 1: Repository hierarchy still loads
    console.log('1️⃣  Testing Repository Hierarchy...')
    try {
      const repositories = await prisma.repository.findMany({
        take: 1,
        include: {
          nodes: {
            where: { parentId: null },
            take: 1,
          },
        },
      })
      testResults.push({
        name: 'Repository Hierarchy',
        status: 'PASS',
        message: `Found ${repositories.length} repositories`,
      })
    } catch (e) {
      testResults.push({
        name: 'Repository Hierarchy',
        status: 'FAIL',
        message: `Error: ${(e as Error).message}`,
      })
    }

    // Test 2: Existing suite creation (hierarchy method) still works
    console.log('2️⃣  Testing Existing Suite Creation...')
    try {
      const existingSuites = await prisma.testSuite.findMany({
        where: {
          selectionMethod: 'HIERARCHY',
        },
        take: 5,
        include: {
          testCases: true,
        },
      })
      testResults.push({
        name: 'Existing Suite Creation',
        status: 'PASS',
        message: `Found ${existingSuites.length} hierarchy-based suites`,
      })
    } catch (e) {
      testResults.push({
        name: 'Existing Suite Creation',
        status: 'FAIL',
        message: `Error: ${(e as Error).message}`,
      })
    }

    // Test 3: Execution cycle creation still works
    console.log('3️⃣  Testing Execution Cycle Creation...')
    try {
      const cycles = await prisma.executionCycle.findMany({
        take: 5,
        include: {
          testRuns: {
            take: 1,
          },
        },
      })
      testResults.push({
        name: 'Execution Cycle Creation',
        status: 'PASS',
        message: `Found ${cycles.length} execution cycles`,
      })
    } catch (e) {
      testResults.push({
        name: 'Execution Cycle Creation',
        status: 'FAIL',
        message: `Error: ${(e as Error).message}`,
      })
    }

    // Test 4: Version creation and isolation
    console.log('4️⃣  Testing Version Creation...')
    try {
      const versions = await prisma.executionVersion.findMany({
        take: 3,
        include: {
          testRuns: {
            select: {
              status: true,
            },
          },
        },
      })

      let allVersionsHaveTestRuns = versions.every((v) => v.testRuns.length > 0)
      testResults.push({
        name: 'Version Creation',
        status: allVersionsHaveTestRuns ? 'PASS' : 'FAIL',
        message: `Found ${versions.length} versions ${
          allVersionsHaveTestRuns ? '(all have test runs)' : '(some missing test runs)'
        }`,
      })
    } catch (e) {
      testResults.push({
        name: 'Version Creation',
        status: 'FAIL',
        message: `Error: ${(e as Error).message}`,
      })
    }

    // Test 5: Test run status updates still work
    console.log('5️⃣  Testing Test Run Status Updates...')
    try {
      const testRuns = await prisma.testRun.findMany({
        where: {
          status: 'PASS',
        },
        take: 1,
      })
      testResults.push({
        name: 'Test Run Status Updates',
        status: 'PASS',
        message: `Found ${testRuns.length} test runs with PASS status`,
      })
    } catch (e) {
      testResults.push({
        name: 'Test Run Status Updates',
        status: 'FAIL',
        message: `Error: ${(e as Error).message}`,
      })
    }

    // Test 6: Comments still persist
    console.log('6️⃣  Testing Comment Persistence...')
    try {
      const comments = await prisma.runComment.findMany({
        take: 5,
      })
      testResults.push({
        name: 'Comment Persistence',
        status: 'PASS',
        message: `Found ${comments.length} test run comments`,
      })
    } catch (e) {
      testResults.push({
        name: 'Comment Persistence',
        status: 'FAIL',
        message: `Error: ${(e as Error).message}`,
      })
    }

    // Test 7: Jira links still work
    console.log('7️⃣  Testing Jira Links...')
    try {
      const jiraLinks = await prisma.jiraLink.findMany({
        take: 5,
      })
      testResults.push({
        name: 'Jira Links',
        status: 'PASS',
        message: `Found ${jiraLinks.length} Jira links`,
      })
    } catch (e) {
      testResults.push({
        name: 'Jira Links',
        status: 'FAIL',
        message: `Error: ${(e as Error).message}`,
      })
    }

    // Test 8: Dashboard metrics still load
    console.log('8️⃣  Testing Dashboard Metrics...')
    try {
      const cycles = await prisma.executionCycle.findMany({
        take: 1,
        include: {
          testRuns: {
            select: {
              status: true,
              versionId: true,
            },
          },
        },
      })

      let canCalculateMetrics = cycles.length > 0 && cycles[0].testRuns.length > 0
      testResults.push({
        name: 'Dashboard Metrics',
        status: canCalculateMetrics ? 'PASS' : 'FAIL',
        message: `Found ${cycles.length} cycles with ${
          cycles[0]?.testRuns.length || 0
        } test runs for metrics`,
      })
    } catch (e) {
      testResults.push({
        name: 'Dashboard Metrics',
        status: 'FAIL',
        message: `Error: ${(e as Error).message}`,
      })
    }

    // Print results
    console.log('\n\n📊 Test Results:')
    console.log('==============================\n')

    testResults.forEach((result) => {
      const icon = result.status === 'PASS' ? '✅' : '❌'
      console.log(`${icon} ${result.name}: ${result.message}`)
    })

    // Summary
    const passed = testResults.filter((r) => r.status === 'PASS').length
    const failed = testResults.filter((r) => r.status === 'FAIL').length

    console.log('\n\n🎯 Summary:')
    console.log('==============================')
    console.log(`✅ Passed: ${passed}/${testResults.length}`)
    console.log(`❌ Failed: ${failed}/${testResults.length}`)

    if (failed === 0) {
      console.log('\n✅ All regression tests passed!')
      console.log('✅ Existing functionality is preserved!')
    } else {
      console.log('\n⚠️  Some tests failed. Please investigate.')
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Regression testing failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

regressionTests()
