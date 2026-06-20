const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const projectId = '79d857b2-36dd-4810-88ae-3ca8d9aaa8d4'

async function test() {
  try {
    // Count all test runs
    const allRuns = await prisma.testRun.findMany({
      where: { cycle: { projectId } },
      include: { cycle: true },
    })

    const passes = allRuns.filter(r => r.status === 'PASS').length
    const fails = allRuns.filter(r => r.status === 'FAIL').length
    const blocked = allRuns.filter(r => r.status === 'BLOCKED').length
    const notExecuted = allRuns.filter(r => r.status === 'NOT_EXECUTED').length

    console.log('ALL_TEST_RUNS')
    console.log('Total: ' + allRuns.length)
    console.log('PASS: ' + passes)
    console.log('FAIL: ' + fails)
    console.log('BLOCKED: ' + blocked)
    console.log('NOT_EXECUTED: ' + notExecuted)
    console.log('')

    // Count cycles
    const cycles = await prisma.executionCycle.findMany({
      where: { projectId },
    })

    console.log('CYCLES')
    console.log('Total Cycles: ' + cycles.length)

  } catch (e) {
    console.error('Error:', e.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

test()
