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
  console.log('EXECUTION CYCLES VERIFICATION')
  console.log('='.repeat(80))

  try {
    // Get test cases
    console.log('\n1️⃣ FETCH TEST DATA')
    const testCases = await prisma.testCase.findMany({
      where: { projectId },
      take: 5,
    })

    if (testCases.length < 5) {
      throw new Error(`Not enough test cases: ${testCases.length}`)
    }

    console.log(`   ✓ Test cases found: ${testCases.length}`)

    // Create execution cycle
    console.log('\n2️⃣ CREATE EXECUTION CYCLE')
    const cycleName = `Cycle-${Date.now()}`
    const testCaseIds = testCases.map(tc => tc.id)

    const cycleRes = await curl('POST', `/api/execution-cycles?projectId=${projectId}`, {
      name: cycleName,
      testCaseIds,
    })

    if (!cycleRes || !cycleRes.id) {
      throw new Error('Failed to create cycle: ' + JSON.stringify(cycleRes))
    }

    const cycleId = cycleRes.id
    console.log(`   ✓ Cycle created: ${cycleName}`)
    console.log(`   ✓ ID: ${cycleId}`)

    // Get test runs
    console.log('\n3️⃣ EXECUTE TESTS')
    const cycle = await prisma.executionCycle.findUnique({
      where: { id: cycleId },
      include: { testRuns: true },
    })

    const testRuns = cycle.testRuns
    console.log(`   ✓ Test runs: ${testRuns.length}`)

    const statuses = ['PASS', 'FAIL', 'PASS', 'FAIL', 'BLOCKED']
    for (let i = 0; i < Math.min(testRuns.length, 5); i++) {
      const res = await curl('PATCH', `/api/test-runs/${testRuns[i].id}`, {
        status: statuses[i],
      })
      console.log(`   ✓ Test ${i + 1}: ${statuses[i]}`)
      await new Promise(r => setTimeout(r, 100))
    }

    // Verify
    console.log('\n4️⃣ VERIFY PERSISTENCE')
    const final = await prisma.executionCycle.findUnique({
      where: { id: cycleId },
      include: { testRuns: true },
    })

    const passCount = final.testRuns.filter(r => r.status === 'PASS').length
    const failCount = final.testRuns.filter(r => r.status === 'FAIL').length
    const blockedCount = final.testRuns.filter(r => r.status === 'BLOCKED').length
    const total = final.testRuns.length

    console.log(`   ✓ Total: ${total}`)
    console.log(`   ✓ Pass: ${passCount}`)
    console.log(`   ✓ Fail: ${failCount}`)
    console.log(`   ✓ Blocked: ${blockedCount}`)

    console.log('\n' + '='.repeat(80))
    const success = passCount === 2 && failCount === 2 && blockedCount === 1 && total === 5
    
    if (success) {
      console.log('WORKING')
    } else {
      console.log('NOT WORKING')
      process.exit(1)
    }

  } catch (e) {
    console.log('NOT WORKING')
    console.error('Error:', e.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

test()
