const http = require('http')

const BASE_URL = 'http://localhost:3000'

function makeRequest(method, path, body = null) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL)
    const startTime = Date.now()
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        const duration = Date.now() - startTime
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), duration })
        } catch {
          resolve({ status: res.statusCode, duration })
        }
      })
    })
    req.on('error', e => resolve({ error: e.message }))
    req.on('timeout', () => {
      req.destroy()
      resolve({ error: 'Timeout' })
    })
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

async function test() {
  console.log('\n========== EXECUTION CYCLE STATUS UPDATE TEST ==========\n')

  try {
    // Test 1: Get execution cycles
    console.log('1. Fetching execution cycles...')
    const cyclesRes = await makeRequest('GET', '/api/execution-cycles?projectId=cmqttt49c000r7kygg73fmuqv')

    if (cyclesRes.error || cyclesRes.status !== 200) {
      console.log(`❌ Failed to fetch cycles`)
      process.exit(1)
    }

    const cycles = cyclesRes.body || []
    if (!Array.isArray(cycles) || cycles.length === 0) {
      console.log(`❌ No cycles found`)
      process.exit(1)
    }

    const cycle = cycles[0]
    console.log(`✓ Found ${cycles.length} cycles`)
    console.log(`  First cycle: ${cycle.name}`)

    // Test 2: Get test runs from the cycle
    console.log('\n2. Checking test runs in first cycle...')
    const testRuns = cycle.testRuns || []
    if (testRuns.length === 0) {
      console.log(`⚠️  No test runs in cycle`)
      process.exit(0)
    }

    const testRun = testRuns[0]
    const originalStatus = testRun.status
    console.log(`✓ Found ${testRuns.length} test runs`)
    console.log(`  First run: ${testRun.id}`)
    console.log(`  Current status: ${originalStatus}`)

    // Test 3: Update status
    console.log('\n3. Updating test run status...')
    const newStatus = originalStatus === 'PASS' ? 'FAIL' : 'PASS'
    console.log(`  Changing from ${originalStatus} to ${newStatus}`)

    const updateRes = await makeRequest('PATCH', `/api/test-runs/${testRun.id}`, {
      status: newStatus,
    })

    if (updateRes.error || updateRes.status !== 200) {
      console.log(`❌ Failed to update status: ${updateRes.status}`)
      console.log(`   Response: ${JSON.stringify(updateRes.body)}`)
      process.exit(1)
    }

    console.log(`✓ API returned 200 (success)`)
    console.log(`  Updated run status: ${updateRes.body.status}`)

    // Test 4: Verify status in list
    console.log('\n4. Verifying status in cycles list...')
    const cyclesRes2 = await makeRequest('GET', '/api/execution-cycles?projectId=cmqttt49c000r7kygg73fmuqv')
    
    const cycles2 = cyclesRes2.body || []
    const updatedCycle = cycles2.find(c => c.id === cycle.id)
    if (!updatedCycle) {
      console.log(`❌ Cycle not found in list after update`)
      process.exit(1)
    }

    const updatedTestRun = updatedCycle.testRuns?.find(r => r.id === testRun.id)
    if (!updatedTestRun) {
      console.log(`❌ Test run not found in cycle after update`)
      process.exit(1)
    }

    console.log(`✓ Status in list: ${updatedTestRun.status}`)
    
    if (updatedTestRun.status !== newStatus) {
      console.log(`❌ Status mismatch! Expected ${newStatus}, got ${updatedTestRun.status}`)
      process.exit(1)
    }

    // Test 5: Revert status back
    console.log('\n5. Reverting status back to original...')
    const revertRes = await makeRequest('PATCH', `/api/test-runs/${testRun.id}`, {
      status: originalStatus,
    })

    if (revertRes.status !== 200) {
      console.log(`⚠️  Failed to revert`)
    } else {
      console.log(`✓ Reverted to ${originalStatus}`)
    }

    console.log('\n' + '='.repeat(50))
    console.log('✅ EXECUTION CYCLE STATUS UPDATE WORKS')
    console.log('='.repeat(50))

  } catch (error) {
    console.error('❌ TEST ERROR:', error.message)
    process.exit(1)
  }
}

test()
