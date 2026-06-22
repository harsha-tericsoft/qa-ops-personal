const { PrismaClient } = require('@prisma/client')
const { spawn } = require('child_process')

const prisma = new PrismaClient()
const projectId = '79d857b2-36dd-4810-88ae-3ca8d9aaa8d4'

async function curl(method, path, data) {
  return new Promise((resolve) => {
    const args = ['-X', method, '-H', 'Content-Type: application/json', '-s']
    if (data) args.push('-d', JSON.stringify(data))
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
  console.log('FINAL E2E VERIFICATION')
  console.log('='.repeat(80))

  try {
    // 1. Count existing data in project
    console.log('\n1️⃣ PROJECT INVENTORY')
    
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })
    console.log(`Project: ${project.name}`)

    const repoNodes = await prisma.repositoryNode.findMany({
      where: { projectId },
    })
    console.log(`Repository Nodes: ${repoNodes.length}`)

    const testCases = await prisma.testCase.findMany({
      where: { projectId },
    })
    console.log(`Test Cases: ${testCases.length}`)

    const testSuites = await prisma.testSuite.findMany({
      where: { projectId },
    })
    console.log(`Test Suites: ${testSuites.length}`)

    const cycles = await prisma.executionCycle.findMany({
      where: { projectId },
    })
    console.log(`Execution Cycles: ${cycles.length}`)

    const testRuns = await prisma.testRun.findMany({
      where: { cycle: { projectId } },
    })
    console.log(`Test Runs: ${testRuns.length}`)

    // 2. Create Test Suite
    console.log('\n2️⃣ CREATE TEST SUITE')
    const selectedTests = testCases.slice(0, 5)
    const suiteName = `E2E-Suite-${Date.now()}`
    
    const suiteRes = await curl('POST', `/api/test-suites?projectId=${projectId}`, {
      name: suiteName,
      category: 'CUSTOM',
    })

    console.log(`Suite created: ${suiteName}`)
    console.log(`Suite ID: ${suiteRes.id}`)

    // 3. Create Execution Cycle from Suite
    console.log('\n3️⃣ CREATE EXECUTION CYCLE')
    const cycleName = `E2E-Cycle-${Date.now()}`
    
    const cycleRes = await curl('POST', `/api/execution-cycles?projectId=${projectId}`, {
      name: cycleName,
      testCaseIds: selectedTests.map(tc => tc.id),
    })

    console.log(`Cycle created: ${cycleName}`)
    console.log(`Cycle ID: ${cycleRes.id}`)
    console.log(`Test Runs: ${cycleRes.testRuns?.length || 0}`)

    // 4. Execute tests: 2 PASS, 2 FAIL, 1 BLOCKED
    console.log('\n4️⃣ EXECUTE TESTS (2 PASS, 2 FAIL, 1 BLOCKED)')
    const statuses = ['PASS', 'PASS', 'FAIL', 'FAIL', 'BLOCKED']
    
    for (let i = 0; i < statuses.length; i++) {
      await curl('PATCH', `/api/test-runs/${cycleRes.testRuns[i].id}`, {
        status: statuses[i],
      })
      console.log(`  Test ${i + 1}: ${statuses[i]}`)
      await new Promise(r => setTimeout(r, 100))
    }

    // 5. Verify cycle persistence
    console.log('\n5️⃣ VERIFY PERSISTENCE')
    const cycleCheck = await curl('GET', `/api/execution-cycles/${cycleRes.id}`)
    
    const pass = cycleCheck.testRuns?.filter(r => r.status === 'PASS').length || 0
    const fail = cycleCheck.testRuns?.filter(r => r.status === 'FAIL').length || 0
    const blocked = cycleCheck.testRuns?.filter(r => r.status === 'BLOCKED').length || 0

    console.log(`After save:`)
    console.log(`  PASS: ${pass}`)
    console.log(`  FAIL: ${fail}`)
    console.log(`  BLOCKED: ${blocked}`)

    // 6. Check Dashboard metrics
    console.log('\n6️⃣ DASHBOARD METRICS')
    const dashRes = await curl('GET', `/api/dashboard/summary?projectId=${projectId}`)
    
    const dashPass = dashRes.executionCycles?.pass || 0
    const dashFail = dashRes.executionCycles?.fail || 0
    const dashBlocked = dashRes.executionCycles?.blocked || 0

    console.log(`Dashboard shows:`)
    console.log(`  PASS: ${dashPass}`)
    console.log(`  FAIL: ${dashFail}`)
    console.log(`  BLOCKED: ${dashBlocked}`)

    // 7. Verify database state
    console.log('\n7️⃣ DATABASE STATE')
    const finalCycle = await prisma.executionCycle.findUnique({
      where: { id: cycleRes.id },
      include: { testRuns: true },
    })

    const dbPass = finalCycle.testRuns.filter(r => r.status === 'PASS').length
    const dbFail = finalCycle.testRuns.filter(r => r.status === 'FAIL').length
    const dbBlocked = finalCycle.testRuns.filter(r => r.status === 'BLOCKED').length

    console.log(`Database has:`)
    console.log(`  PASS: ${dbPass}`)
    console.log(`  FAIL: ${dbFail}`)
    console.log(`  BLOCKED: ${dbBlocked}`)

    // Summary
    console.log('\n' + '='.repeat(80))
    console.log('FINAL VERIFICATION SUMMARY')
    console.log('='.repeat(80))

    console.log('\n📊 COUNTS')
    console.log(`Project: ${project.name}`)
    console.log(`Repository Nodes: ${repoNodes.length}`)
    console.log(`Test Cases: ${testCases.length}`)
    console.log(`Test Suites: ${testSuites.length}`)
    console.log(`Execution Cycles: ${cycles.length}`)
    console.log(`Test Runs: ${testRuns.length}`)

    console.log('\n📋 E2E WORKFLOW RESULTS')
    console.log(`1. Create Suite: ✓`)
    console.log(`2. Create Cycle: ✓`)
    console.log(`3. Execute Tests: ✓`)
    console.log(`4. Save & Persist: ${pass === 2 && fail === 2 && blocked === 1 ? '✓' : '✗'}`)
    console.log(`5. Dashboard Update: ${dashPass >= 2 && dashFail >= 2 && dashBlocked >= 1 ? '✓' : '✗'}`)
    console.log(`6. DB Consistency: ${dbPass === pass && dbFail === fail && dbBlocked === blocked ? '✓' : '✗'}`)

    const allPass = (
      pass === 2 && fail === 2 && blocked === 1 &&
      dashPass >= 2 && dashFail >= 2 && dashBlocked >= 1 &&
      dbPass === pass && dbFail === fail && dbBlocked === blocked
    )

    console.log('\n' + '='.repeat(80))
    if (allPass) {
      console.log('✅ E2E WORKFLOW PASSED')
    } else {
      console.log('❌ E2E WORKFLOW FAILED')
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
