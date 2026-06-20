const { PrismaClient } = require('@prisma/client')
const { spawn } = require('child_process')

const prisma = new PrismaClient()
const cycleId = '772ba911-aae9-400a-9b93-5765d0cc1d02'
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
  try {
    // DATABASE
    const cycle = await prisma.executionCycle.findUnique({
      where: { id: cycleId },
      include: { testRuns: true },
    })

    const dbPass = cycle.testRuns.filter(r => r.status === 'PASS').length
    const dbFail = cycle.testRuns.filter(r => r.status === 'FAIL').length
    const dbBlocked = cycle.testRuns.filter(r => r.status === 'BLOCKED').length
    const dbNotRun = cycle.testRuns.filter(r => r.status === 'NOT_EXECUTED').length

    // API
    const apiRes = await curl('GET', `/api/dashboard/summary?projectId=${projectId}`)

    // Output
    console.log('DATABASE')
    console.log('Cycle ID: ' + cycleId)
    console.log('PASS: ' + dbPass)
    console.log('FAIL: ' + dbFail)
    console.log('BLOCKED: ' + dbBlocked)
    console.log('NOT_RUN: ' + dbNotRun)
    console.log('')

    console.log('API_RESPONSE')
    console.log(JSON.stringify(apiRes, null, 2))
    console.log('')

    console.log('API_VALUES')
    console.log('PASS: ' + (apiRes.executionCycles?.pass || 0))
    console.log('FAIL: ' + (apiRes.executionCycles?.fail || 0))
    console.log('BLOCKED: ' + (apiRes.executionCycles?.blocked || 0))
    console.log('NOT_RUN: ' + (apiRes.executionCycles?.notExecuted || 0))

  } catch (e) {
    console.error('Error:', e.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

test()
