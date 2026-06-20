const { PrismaClient } = require('@prisma/client')
const fetch = require('node-fetch')

const prisma = new PrismaClient()
const BASE_URL = 'http://localhost:3000'

async function test() {
  console.log('\n' + '='.repeat(80))
  console.log('EXECUTION CYCLES VERIFICATION')
  console.log('='.repeat(80))

  try {
    const projectId = '79d857b2-36dd-4810-88ae-3ca8d9aaa8d4'

    // Get suite
    console.log('\n1️⃣ GET TEST SUITE')
    const suites = await prisma.testSuite.findMany({ 
      where: { projectId }, 
      include: { testCases: true } 
    })
    
    if (suites.length === 0) {
      throw new Error('No test suites found')
    }

    const suite = suites[0]
    console.log(`   ✓ Suite: ${suite.name}`)
    console.log(`   ✓ Test cases: ${suite.testCases.length}`)

    // Create execution cycle
    console.log('\n2️⃣ CREATE EXECUTION CYCLE')
    const cycleName = `Cycle-${Date.now()}`
    
    const testCaseIds = suite.testCases.slice(0, 5).map(tc => tc.testCaseId || tc.id)
    
    console.log(`   ✓ Cycle: ${cycleName}`)
    console.log(`   ✓ Test cases: ${testCaseIds.length}`)

    const createRes = await fetch(`${BASE_URL}/api/execution-cycles?projectId=${projectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: cycleName,
        description: 'Test',
        testCaseIds: testCaseIds,
      }),
    })

    const cycleData = await createRes.json()
    const cycleId = cycleData.id
    console.log(`   ✓ Cycle ID: ${cycleId}`)

    // Get test runs
    console.log('\n3️⃣ EXECUTE TESTS')
    
    const cycle = await prisma.executionCycle.findUnique({
      where: { id: cycleId },
      include: { testRuns: true },
    })

    const testRuns = cycle?.testRuns || []
    const statuses = ['PASS', 'FAIL', 'PASS', 'FAIL', 'BLOCKED']

    for (let i = 0; i < Math.min(testRuns.length, 5); i++) {
      await fetch(`${BASE_URL}/api/test-runs/${testRuns[i].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statuses[i] }),
      })
      console.log(`   ✓ Test ${i + 1}: ${statuses[i]}`)
      await new Promise(r => setTimeout(r, 100))
    }

    // Verify
    console.log('\n4️⃣ VERIFY DATABASE')

    const finalCycle = await prisma.executionCycle.findUnique({
      where: { id: cycleId },
      include: { testRuns: true },
    })

    const passCount = finalCycle?.testRuns.filter(r => r.status === 'PASS').length || 0
    const failCount = finalCycle?.testRuns.filter(r => r.status === 'FAIL').length || 0
    const blockedCount = finalCycle?.testRuns.filter(r => r.status === 'BLOCKED').length || 0
    const total = finalCycle?.testRuns.length || 0

    console.log(`   ✓ Total: ${total}`)
    console.log(`   ✓ Pass: ${passCount}`)
    console.log(`   ✓ Fail: ${failCount}`)
    console.log(`   ✓ Blocked: ${blockedCount}`)

    // Final check
    console.log('\n' + '='.repeat(80))
    const success = passCount === 2 && failCount === 2 && blockedCount === 1 && total === 5
    
    if (success) {
      console.log('WORKING')
    } else {
      console.log('NOT WORKING')
      console.log(`Expected: Pass=2, Fail=2, Blocked=1, Total=5`)
      console.log(`Got: Pass=${passCount}, Fail=${failCount}, Blocked=${blockedCount}, Total=${total}`)
      process.exit(1)
    }

  } catch (error) {
    console.log('NOT WORKING')
    console.error('Error:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

test()
