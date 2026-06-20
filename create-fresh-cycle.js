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
  try {
    const testCases = await prisma.testCase.findMany({
      where: { projectId },
      take: 10,
    })

    const cycleName = `Fresh-Cycle-${Date.now()}`
    const testCaseIds = testCases.map(tc => tc.id)

    const cycleRes = await curl('POST', `/api/execution-cycles?projectId=${projectId}`, {
      name: cycleName,
      testCaseIds,
    })

    const cycleId = cycleRes.id

    const cycle = await prisma.executionCycle.findUnique({
      where: { id: cycleId },
      include: { testRuns: true },
    })

    const statuses = ['PASS', 'PASS', 'PASS', 'PASS', 'FAIL', 'FAIL', 'FAIL', 'BLOCKED', 'BLOCKED', 'NOT_EXECUTED']
    
    for (let i = 0; i < statuses.length; i++) {
      await curl('PATCH', `/api/test-runs/${cycle.testRuns[i].id}`, {
        status: statuses[i],
      })
      await new Promise(r => setTimeout(r, 100))
    }

    const finalCycle = await prisma.executionCycle.findUnique({
      where: { id: cycleId },
      include: { testRuns: true },
    })

    console.log('CYCLE_ID=' + cycleId)
    console.log('CYCLE_NAME=' + cycleName)

  } catch (e) {
    console.error('Error:', e.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

test()
