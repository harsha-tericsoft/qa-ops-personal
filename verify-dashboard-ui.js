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
  console.log('DASHBOARD API VERIFICATION')
  console.log('='.repeat(80))

  try {
    // Query API
    console.log('\n1️⃣ QUERY DASHBOARD API')
    const dashboardRes = await curl('GET', `/api/dashboard/summary?projectId=${projectId}`)
    
    if (!dashboardRes) {
      throw new Error('Failed to fetch dashboard API')
    }

    console.log(`   API Response:`)
    if (dashboardRes.executionCycles) {
      console.log(`   Total: ${dashboardRes.executionCycles.total}`)
      console.log(`   Pass: ${dashboardRes.executionCycles.pass}`)
      console.log(`   Fail: ${dashboardRes.executionCycles.fail}`)
      console.log(`   Blocked: ${dashboardRes.executionCycles.blocked}`)
      console.log(`   Not Executed: ${dashboardRes.executionCycles.notExecuted}`)
    }

    // Query database directly
    console.log('\n2️⃣ QUERY DATABASE DIRECTLY')
    const testRuns = await prisma.testRun.findMany({
      where: {
        cycle: {
          projectId,
        },
      },
    })

    const dbPass = testRuns.filter(r => r.status === 'PASS').length
    const dbFail = testRuns.filter(r => r.status === 'FAIL').length
    const dbBlocked = testRuns.filter(r => r.status === 'BLOCKED').length
    const dbNotExecuted = testRuns.filter(r => r.status === 'NOT_EXECUTED').length
    const dbTotal = testRuns.length

    console.log(`   Database Counts:`)
    console.log(`   Total: ${dbTotal}`)
    console.log(`   Pass: ${dbPass}`)
    console.log(`   Fail: ${dbFail}`)
    console.log(`   Blocked: ${dbBlocked}`)
    console.log(`   Not Executed: ${dbNotExecuted}`)

    // Verify match
    console.log('\n3️⃣ VERIFY API = DATABASE')
    const apiMatch = (
      dashboardRes.executionCycles?.total === dbTotal &&
      dashboardRes.executionCycles?.pass === dbPass &&
      dashboardRes.executionCycles?.fail === dbFail &&
      dashboardRes.executionCycles?.blocked === dbBlocked &&
      dashboardRes.executionCycles?.notExecuted === dbNotExecuted
    )

    console.log(`   Total: ${dashboardRes.executionCycles?.total} = ${dbTotal}? ${dashboardRes.executionCycles?.total === dbTotal ? '✓' : '✗'}`)
    console.log(`   Pass: ${dashboardRes.executionCycles?.pass} = ${dbPass}? ${dashboardRes.executionCycles?.pass === dbPass ? '✓' : '✗'}`)
    console.log(`   Fail: ${dashboardRes.executionCycles?.fail} = ${dbFail}? ${dashboardRes.executionCycles?.fail === dbFail ? '✓' : '✗'}`)
    console.log(`   Blocked: ${dashboardRes.executionCycles?.blocked} = ${dbBlocked}? ${dashboardRes.executionCycles?.blocked === dbBlocked ? '✓' : '✗'}`)
    console.log(`   Not Executed: ${dashboardRes.executionCycles?.notExecuted} = ${dbNotExecuted}? ${dashboardRes.executionCycles?.notExecuted === dbNotExecuted ? '✓' : '✗'}`)

    console.log('\n' + '='.repeat(80))
    if (apiMatch) {
      console.log('DASHBOARD METRICS: OK')
    } else {
      console.log('DASHBOARD METRICS: MISMATCH')
      process.exit(1)
    }

  } catch (e) {
    console.error('Error:', e.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

test()
