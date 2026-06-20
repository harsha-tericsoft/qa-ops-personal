const { PrismaClient } = require('@prisma/client')
const { spawn } = require('child_process')

const prisma = new PrismaClient()
const projectId = '79d857b2-36dd-4810-88ae-3ca8d9aaa8d4'

async function curl(method, path) {
  return new Promise((resolve) => {
    const args = ['-X', method, '-H', 'Content-Type: application/json', '-s', `http://localhost:3000${path}`]
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
  console.log('FINAL DASHBOARD VERIFICATION')
  console.log('='.repeat(80))

  try {
    // Get specific test cycle
    console.log('\n1️⃣ TARGET TEST CYCLE')
    const targetCycle = await prisma.executionCycle.findFirst({
      where: { name: 'Dashboard-Test-1781980639756' },
      include: { testRuns: true },
    })

    const dbPass = targetCycle.testRuns.filter(r => r.status === 'PASS').length
    const dbFail = targetCycle.testRuns.filter(r => r.status === 'FAIL').length
    const dbBlocked = targetCycle.testRuns.filter(r => r.status === 'BLOCKED').length
    const dbNotExecuted = targetCycle.testRuns.filter(r => r.status === 'NOT_EXECUTED').length
    const dbTotal = targetCycle.testRuns.length

    console.log(`Database Counts:`)
    console.log(`PASS:       ${dbPass}`)
    console.log(`FAIL:       ${dbFail}`)
    console.log(`BLOCKED:    ${dbBlocked}`)
    console.log(`NOT_RUN:    ${dbNotExecuted}`)
    console.log(`TOTAL:      ${dbTotal}`)

    // Query dashboard API
    console.log('\n2️⃣ DASHBOARD API RESPONSE')
    const dashboardRes = await curl('GET', `/api/dashboard/summary?projectId=${projectId}`)
    
    const apiTotal = dashboardRes.executionCycles?.total || 0
    const apiPass = dashboardRes.executionCycles?.pass || 0
    const apiFail = dashboardRes.executionCycles?.fail || 0
    const apiBlocked = dashboardRes.executionCycles?.blocked || 0
    const apiNotExecuted = dashboardRes.executionCycles?.notExecuted || 0

    console.log(`API Counts (All Cycles):`)
    console.log(`PASS:       ${apiPass}`)
    console.log(`FAIL:       ${apiFail}`)
    console.log(`BLOCKED:    ${apiBlocked}`)
    console.log(`NOT_RUN:    ${apiNotExecuted}`)
    console.log(`TOTAL:      ${apiTotal}`)

    // Calculate pass rate for target cycle
    const targetExecuted = dbPass + dbFail + dbBlocked
    const targetPassRate = targetExecuted > 0 ? Math.round((dbPass / targetExecuted) * 100) : 0
    const targetExecutionRate = dbTotal > 0 ? Math.round((targetExecuted / dbTotal) * 100) : 0

    console.log(`\n3️⃣ TARGET CYCLE METRICS`)
    console.log(`Pass Rate: ${targetPassRate}%`)
    console.log(`Execution Rate: ${targetExecutionRate}%`)

    // Verify
    console.log('\n' + '='.repeat(80))
    console.log('VERIFICATION RESULTS')
    console.log('='.repeat(80))

    console.log(`\nDatabase Counts (Target Cycle):`)
    console.log(`PASS=4:           ${dbPass === 4 ? '✓' : '✗'}`)
    console.log(`FAIL=3:           ${dbFail === 3 ? '✓' : '✗'}`)
    console.log(`BLOCKED=2:        ${dbBlocked === 2 ? '✓' : '✗'}`)
    console.log(`NOT_RUN=1:        ${dbNotExecuted === 1 ? '✓' : '✗'}`)

    console.log(`\nDashboard Counts (API):`)
    console.log(`Total Tests: ${apiTotal}`)
    console.log(`Pass:        ${apiPass}`)
    console.log(`Fail:        ${apiFail}`)
    console.log(`Blocked:     ${apiBlocked}`)
    console.log(`Not Executed: ${apiNotExecuted}`)

    console.log(`\nMatch:`)
    const allCorrect = (
      dbPass === 4 &&
      dbFail === 3 &&
      dbBlocked === 2 &&
      dbNotExecuted === 1 &&
      dbTotal === 10
    )

    console.log(allCorrect ? 'YES ✓' : 'NO ✗')

    if (allCorrect) {
      console.log(`\nCycle ID: ${targetCycle.id}`)
      console.log(`Cycle Name: ${targetCycle.name}`)
    }

  } catch (e) {
    console.error('Error:', e.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

test()
