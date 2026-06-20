const { PrismaClient } = require('@prisma/client')
const { spawn } = require('child_process')

const prisma = new PrismaClient()
const projectId = '79d857b2-36dd-4810-88ae-3ca8d9aaa8d4'

async function curl(method, path, data) {
  return new Promise((resolve) => {
    const args = ['-X', method, '-H', 'Content-Type: application/json', '-s']
    if (data) {
      args.push('-d', JSON.stringify(data))
    }
    args.push(`http://localhost:3000${path}`)
    
    const proc = spawn('curl', args)
    let output = ''
    proc.stdout.on('data', (d) => { output += d })
    proc.on('close', () => {
      try {
        resolve(JSON.parse(output))
      } catch {
        resolve(null)
      }
    })
  })
}

async function test() {
  console.log('\n' + '='.repeat(80))
  console.log('DASHBOARD METRICS VERIFICATION')
  console.log('='.repeat(80))

  try {
    // Get 10 test cases
    console.log('\n1️⃣ FETCH TEST CASES')
    const testCases = await prisma.testCase.findMany({
      where: { projectId },
      take: 10,
    })

    if (testCases.length < 10) {
      throw new Error(`Not enough test cases: ${testCases.length} (need 10)`)
    }

    console.log(`   ✓ Found: ${testCases.length} test cases`)

    // Create execution cycle
    console.log('\n2️⃣ CREATE EXECUTION CYCLE')
    const cycleName = `Dashboard-Test-${Date.now()}`
    const testCaseIds = testCases.map(tc => tc.id)

    const cycleRes = await curl('POST', `/api/execution-cycles?projectId=${projectId}`, {
      name: cycleName,
      testCaseIds,
    })

    const cycleId = cycleRes.id
    console.log(`   ✓ Cycle: ${cycleName}`)
    console.log(`   ✓ ID: ${cycleId}`)

    // Set statuses: 4 PASS, 3 FAIL, 2 BLOCKED, 1 NOT_EXECUTED
    console.log('\n3️⃣ EXECUTE TESTS')
    const cycle = await prisma.executionCycle.findUnique({
      where: { id: cycleId },
      include: { testRuns: true },
    })

    const statuses = ['PASS', 'PASS', 'PASS', 'PASS', 'FAIL', 'FAIL', 'FAIL', 'BLOCKED', 'BLOCKED', 'NOT_EXECUTED']
    
    for (let i = 0; i < statuses.length; i++) {
      const runId = cycle.testRuns[i].id
      const status = statuses[i]
      
      await curl('PATCH', `/api/test-runs/${runId}`, { status })
      console.log(`   ✓ Test ${i + 1}: ${status}`)
      await new Promise(r => setTimeout(r, 100))
    }

    // Query database
    console.log('\n4️⃣ VERIFY DATABASE COUNTS')
    const finalCycle = await prisma.executionCycle.findUnique({
      where: { id: cycleId },
      include: { testRuns: true },
    })

    const dbPass = finalCycle.testRuns.filter(r => r.status === 'PASS').length
    const dbFail = finalCycle.testRuns.filter(r => r.status === 'FAIL').length
    const dbBlocked = finalCycle.testRuns.filter(r => r.status === 'BLOCKED').length
    const dbNotExecuted = finalCycle.testRuns.filter(r => r.status === 'NOT_EXECUTED').length
    const dbTotal = finalCycle.testRuns.length

    console.log(`   Database Counts:`)
    console.log(`   PASS:          ${dbPass}`)
    console.log(`   FAIL:          ${dbFail}`)
    console.log(`   BLOCKED:       ${dbBlocked}`)
    console.log(`   NOT_EXECUTED:  ${dbNotExecuted}`)
    console.log(`   TOTAL:         ${dbTotal}`)

    // Query dashboard API
    console.log('\n5️⃣ QUERY DASHBOARD API')
    const dashboardRes = await curl('GET', `/api/dashboard/summary?projectId=${projectId}`, null)
    
    if (dashboardRes && dashboardRes.metrics) {
      console.log(`   API Dashboard Metrics:`)
      console.log(`   Pass:    ${dashboardRes.metrics.pass || 0}`)
      console.log(`   Fail:    ${dashboardRes.metrics.fail || 0}`)
      console.log(`   Blocked: ${dashboardRes.metrics.blocked || 0}`)
      console.log(`   Not Executed: ${dashboardRes.metrics.notExecuted || 0}`)
    }

    // Query cycle API
    console.log('\n6️⃣ QUERY CYCLE API')
    const cycleApiRes = await curl('GET', `/api/execution-cycles/${cycleId}`, null)
    
    if (cycleApiRes && cycleApiRes.metrics) {
      console.log(`   Cycle Metrics:`)
      console.log(`   Total:   ${cycleApiRes.metrics.total || 0}`)
      console.log(`   Pass:    ${cycleApiRes.metrics.pass || 0}`)
      console.log(`   Fail:    ${cycleApiRes.metrics.fail || 0}`)
      console.log(`   Blocked: ${cycleApiRes.metrics.blocked || 0}`)
      console.log(`   Not Executed: ${cycleApiRes.metrics.notExecuted || 0}`)
    }

    // Final summary
    console.log('\n' + '='.repeat(80))
    console.log('VERIFICATION SUMMARY')
    console.log('='.repeat(80))

    const dbMatch = (
      dbPass === 4 && 
      dbFail === 3 && 
      dbBlocked === 2 && 
      dbNotExecuted === 1 && 
      dbTotal === 10
    )

    console.log(`\nDatabase Counts:`)
    console.log(`PASS:          ${dbPass} (expected 4)    ${dbPass === 4 ? '✓' : '✗'}`)
    console.log(`FAIL:          ${dbFail} (expected 3)    ${dbFail === 3 ? '✓' : '✗'}`)
    console.log(`BLOCKED:       ${dbBlocked} (expected 2)    ${dbBlocked === 2 ? '✓' : '✗'}`)
    console.log(`NOT_EXECUTED:  ${dbNotExecuted} (expected 1)    ${dbNotExecuted === 1 ? '✓' : '✗'}`)
    console.log(`TOTAL:         ${dbTotal} (expected 10)   ${dbTotal === 10 ? '✓' : '✗'}`)

    console.log(`\nMatch: ${dbMatch ? 'YES' : 'NO'}`)

    if (!dbMatch) {
      process.exit(1)
    }

    console.log(`\nCycle ID: ${cycleId}`)
    console.log(`Cycle Name: ${cycleName}`)

  } catch (e) {
    console.error('Error:', e.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

test()
