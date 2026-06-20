const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const cycleName = 'Dashboard-Test-1781980639756'

async function test() {
  console.log('\n' + '='.repeat(80))
  console.log('VERIFY SPECIFIC CYCLE')
  console.log('='.repeat(80))

  try {
    const cycle = await prisma.executionCycle.findFirst({
      where: { name: cycleName },
      include: { testRuns: true },
    })

    if (!cycle) {
      throw new Error(`Cycle not found: ${cycleName}`)
    }

    console.log(`\nCycle: ${cycle.name}`)
    console.log(`ID: ${cycle.id}`)

    const pass = cycle.testRuns.filter(r => r.status === 'PASS').length
    const fail = cycle.testRuns.filter(r => r.status === 'FAIL').length
    const blocked = cycle.testRuns.filter(r => r.status === 'BLOCKED').length
    const notExecuted = cycle.testRuns.filter(r => r.status === 'NOT_EXECUTED').length
    const total = cycle.testRuns.length

    console.log(`\nDatabase Counts:`)
    console.log(`PASS:          ${pass}`)
    console.log(`FAIL:          ${fail}`)
    console.log(`BLOCKED:       ${blocked}`)
    console.log(`NOT_EXECUTED:  ${notExecuted}`)
    console.log(`TOTAL:         ${total}`)

    const isCorrect = (
      pass === 4 &&
      fail === 3 &&
      blocked === 2 &&
      notExecuted === 1 &&
      total === 10
    )

    console.log(`\nMatch (4/3/2/1/10):`)
    console.log(`Pass: ${pass === 4 ? '✓' : '✗'}`)
    console.log(`Fail: ${fail === 3 ? '✓' : '✗'}`)
    console.log(`Blocked: ${blocked === 2 ? '✓' : '✗'}`)
    console.log(`Not Executed: ${notExecuted === 1 ? '✓' : '✗'}`)
    console.log(`Total: ${total === 10 ? '✓' : '✗'}`)

    console.log('\n' + '='.repeat(80))
    console.log(isCorrect ? 'RESULTS: CORRECT' : 'RESULTS: INCORRECT')

  } catch (e) {
    console.error('Error:', e.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

test()
