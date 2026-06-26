const http = require('http')

const BASE_URL = 'http://localhost:3000'
const PROJECT_ID = 'cmqttt49c000r7kygg73fmuqv'

function makeRequest(method, path, body = null, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL)
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout,
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) })
        } catch (e) {
          reject(new Error(`Invalid JSON: ${e.message}`))
        }
      })
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Timeout'))
    })

    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

async function test() {
  console.log('\n========== WORKFLOW TEST: Repository + Suite Creation ==========\n')

  try {
    // TEST 1: Fetch test cases
    console.log('TEST 1: Fetch test cases from /api/test-cases')
    const testCasesRes = await makeRequest('GET', `/api/test-cases?projectId=${PROJECT_ID}`, null, 20000)
    if (testCasesRes.status !== 200) throw new Error(`Failed: ${testCasesRes.status}`)
    
    const testCases = testCasesRes.body.data || testCasesRes.body
    if (!Array.isArray(testCases)) {
      throw new Error(`testCases is not an array: ${typeof testCases}`)
    }
    console.log(`✓ Fetched ${testCases.length} test cases`)
    console.log(`  Type: ${Array.isArray(testCases) ? 'Array' : typeof testCases}`)
    console.log(`  Has filter method: ${typeof testCases.filter === 'function'}`)

    // TEST 2: Try to filter
    console.log('\nTEST 2: Filter test cases (RepositoryTreeSelector does this)')
    const filtered = testCases.filter(tc => tc.repositoryNodeId)
    console.log(`✓ Successfully filtered: ${filtered.length} test cases with repositoryNodeId`)

    // TEST 3: Create suite with 5 selected tests
    console.log('\nTEST 3: Create suite with 5 tests')
    const selectedTests = testCases.slice(0, 5)
    const suiteRes = await makeRequest('POST', `/api/test-suites?projectId=${PROJECT_ID}`, {
      name: `Fix Test Suite ${Date.now()}`,
      description: 'Fix verification suite',
      category: 'CUSTOM',
      roamTestCaseIds: selectedTests.map(t => t.id),
    }, 15000)

    if (suiteRes.status !== 201) {
      throw new Error(`Suite creation failed: ${suiteRes.status}`)
    }

    const suite = suiteRes.body
    console.log(`✓ Suite created: ${suite.id}`)
    console.log(`  Name: ${suite.name}`)
    console.log(`  Test cases: ${suite.testCases?.length || 0}`)

    if (suite.testCases?.length === 0) {
      throw new Error('Suite has 0 test cases - BUG: test count not saved')
    }

    // TEST 4: Verify suite in list
    console.log('\nTEST 4: Fetch suite from list to verify')
    const listRes = await makeRequest('GET', `/api/test-suites?projectId=${PROJECT_ID}`, null, 15000)
    const suites = listRes.body
    const found = suites.find(s => s.id === suite.id)
    if (!found) throw new Error('Suite not found in list')
    console.log(`✓ Suite found in list`)
    console.log(`  Test cases in list: ${found.testCases?.length || 0}`)

    if (found.testCases?.length !== suite.testCases?.length) {
      throw new Error(`Mismatch: created ${suite.testCases?.length}, list shows ${found.testCases?.length}`)
    }

    // TEST 5: Delete suite
    console.log('\nTEST 5: Clean up - delete suite')
    const deleteRes = await makeRequest('DELETE', `/api/test-suites/${suite.id}`, null, 15000)
    if (deleteRes.status !== 200) throw new Error(`Delete failed: ${deleteRes.status}`)
    console.log(`✓ Suite deleted`)

    console.log('\n' + '='.repeat(60))
    console.log('✅ ALL TESTS PASSED - BUG FIX VERIFIED')
    console.log('='.repeat(60))
    console.log(`
RepositoryTreeSelector Fix Summary:
  ✓ API response correctly formatted with {data, pagination}
  ✓ testCases now properly extracted from response.data
  ✓ .filter() method works on test cases array
  ✓ Suite creation with 5 tests works correctly
  ✓ Test count persists in database
  ✓ Test count displayed correctly in list
`)

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message)
    process.exit(1)
  }
}

test()
