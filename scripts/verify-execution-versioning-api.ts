import { prisma } from '@/lib/prisma'

const BASE_URL = process.env.API_URL || 'http://localhost:3000'

interface TestResult {
  test: string
  status: 'PASS' | 'FAIL'
  details: string
}

const results: TestResult[] = []

async function apiCall(
  method: string,
  path: string,
  body?: any
): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await response.json()
    return {
      ok: response.ok,
      status: response.status,
      data,
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: { error: error instanceof Error ? error.message : 'Unknown error' },
    }
}

async function verify() {
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('EXECUTION VERSIONING - API VERIFICATION')
  console.log('═══════════════════════════════════════════════════════════\n')

  try {
    // Get a test cycle
    const cycle = await prisma.executionCycle.findFirst({
      include: { versions: true },
    })

    if (!cycle) {
      console.log('No execution cycles found. Cannot test API.\n')
      process.exit(1)
    }

    const cycleId = cycle.id
    console.log(`Using Cycle ID: ${cycleId}\n`)

    // 1. Create Version
    console.log('TEST 1: Create Version')
    const createResponse = await apiCall('POST', `/api/execution-cycles/${cycleId}/versions`, {
      buildVersion: `test-build-${Date.now()}`,
      releaseNotes: 'Test version',
    })

    let versionId = ''
    if (createResponse.ok && createResponse.data.id) {
      versionId = createResponse.data.id
      results.push({
        test: 'Create Version API returns 201',
        status: createResponse.status === 201 ? 'PASS' : 'FAIL',
        details: `Status: ${createResponse.status}, ID: ${versionId}`,
      })
      console.log(`✓ Created Version: ${versionId}`)
      console.log(`  Response:`, JSON.stringify(createResponse.data, null, 2))
    } else {
      results.push({
        test: 'Create Version API returns 201',
        status: 'FAIL',
        details: `Status: ${createResponse.status}, Error: ${createResponse.data.error}`,
      })
      console.log(`✗ Failed to create version`)
    }

    // 2. List Versions
    console.log('\nTEST 2: List Versions')
    const listResponse = await apiCall('GET', `/api/execution-cycles/${cycleId}/versions`)
    if (listResponse.ok && Array.isArray(listResponse.data)) {
      results.push({
        test: 'List Versions API returns array',
        status: 'PASS',
        details: `Found ${listResponse.data.length} versions`,
      })
      console.log(`✓ Listed ${listResponse.data.length} versions`)
      console.log(`  Latest version:`, JSON.stringify(listResponse.data[0], null, 2))
    } else {
      results.push({
        test: 'List Versions API returns array',
        status: 'FAIL',
        details: `Status: ${listResponse.status}`,
      })
    }

    // 3. Save Draft (Update Status to IN_PROGRESS)
    if (versionId) {
      console.log('\nTEST 3: Save Draft (Update Status)')
      const saveDraftResponse = await apiCall(
        'PATCH',
        `/api/execution-cycles/${cycleId}/versions/${versionId}`,
        {
          status: 'IN_PROGRESS',
        }
      )

      if (saveDraftResponse.ok && saveDraftResponse.data.status === 'IN_PROGRESS') {
        results.push({
          test: 'Save Draft sets status to IN_PROGRESS',
          status: 'PASS',
          details: `Status: ${saveDraftResponse.data.status}`,
        })
        console.log(`✓ Draft saved, status: ${saveDraftResponse.data.status}`)
      } else {
        results.push({
          test: 'Save Draft sets status to IN_PROGRESS',
          status: 'FAIL',
          details: `Status: ${saveDraftResponse.status}, Response: ${JSON.stringify(saveDraftResponse.data)}`,
        })
      }

      // 4. Complete Execution
      console.log('\nTEST 4: Complete Execution')
      const completeResponse = await apiCall(
        'PATCH',
        `/api/execution-cycles/${cycleId}/versions/${versionId}`,
        {
          status: 'COMPLETED',
        }
      )

      if (completeResponse.ok && completeResponse.data.status === 'COMPLETED') {
        results.push({
          test: 'Complete Execution sets status to COMPLETED',
          status: 'PASS',
          details: `Status: ${completeResponse.data.status}, CompletedAt set: ${completeResponse.data.completedAt ? 'YES' : 'NO'}`,
        })
        console.log(`✓ Execution completed`)
        console.log(`  Status: ${completeResponse.data.status}`)
        console.log(`  CompletedAt: ${completeResponse.data.completedAt}`)
      } else {
        results.push({
          test: 'Complete Execution sets status to COMPLETED',
          status: 'FAIL',
          details: `Status: ${completeResponse.status}`,
        })
      }
    }

    // 5. Duplicate Build Version Validation
    console.log('\nTEST 5: Duplicate Build Version Validation')
    const firstVersion = cycle.versions[0]
    if (firstVersion) {
      const duplicateResponse = await apiCall('POST', `/api/execution-cycles/${cycleId}/versions`, {
        buildVersion: firstVersion.buildVersion,
      })

      if (!duplicateResponse.ok && duplicateResponse.status === 409) {
        results.push({
          test: 'Duplicate build version returns 409 Conflict',
          status: 'PASS',
          details: `Error: ${duplicateResponse.data.error}`,
        })
        console.log(`✓ Duplicate validation works`)
        console.log(`  Error: ${duplicateResponse.data.error}`)
      } else {
        results.push({
          test: 'Duplicate build version returns 409 Conflict',
          status: 'FAIL',
          details: `Status: ${duplicateResponse.status}, Expected: 409`,
        })
      }
    }

    // 6. Get Version Details
    if (versionId) {
      console.log('\nTEST 6: Get Version Details')
      const getResponse = await apiCall('GET', `/api/execution-cycles/${cycleId}/versions/${versionId}`)

      if (getResponse.ok && getResponse.data.id === versionId) {
        results.push({
          test: 'Get Version returns correct data',
          status: 'PASS',
          details: `Version ${versionId} with ${getResponse.data.testRuns?.length || 0} test runs`,
        })
        console.log(`✓ Version details retrieved`)
        console.log(`  Test Runs Count: ${getResponse.data.testRuns?.length || 0}`)
      } else {
        results.push({
          test: 'Get Version returns correct data',
          status: 'FAIL',
          details: `Status: ${getResponse.status}`,
        })
      }
    }

    // 7. Version History (Multiple Versions)
    console.log('\nTEST 7: Version History Display')
    const historyResponse = await apiCall('GET', `/api/execution-cycles/${cycleId}/versions`)
    if (historyResponse.ok && historyResponse.data.length > 0) {
      results.push({
        test: 'Version History shows all versions',
        status: 'PASS',
        details: `Total versions: ${historyResponse.data.length}`,
      })
      console.log(`✓ Version history loaded`)
      historyResponse.data.slice(0, 3).forEach((v: any, i: number) => {
        console.log(`  V${i + 1}: Build=${v.buildVersion}, Status=${v.status}, Created=${v.createdAt}`)
      })
    } else {
      results.push({
        test: 'Version History shows all versions',
        status: 'FAIL',
        details: `Status: ${historyResponse.status}`,
      })
    }
  } catch (error) {
    results.push({
      test: 'API connection',
      status: 'FAIL',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }

  // Print results
  console.log('\n───────────────────────────────────────────────────────────')
  console.log('TEST RESULTS')
  console.log('───────────────────────────────────────────────────────────\n')

  results.forEach((r) => {
    const icon = r.status === 'PASS' ? '✓' : '✗'
    console.log(`${icon} ${r.test}`)
    console.log(`  ${r.details}\n`)
  })

  const passed = results.filter((r) => r.status === 'PASS').length
  const total = results.length
  console.log(`Result: ${passed}/${total} PASSED`)
  console.log(`Status: ${passed === total ? 'PASS' : 'FAIL'}\n`)

  process.exit(passed === total ? 0 : 1)
}

verify().catch((error) => {
  console.error('API verification failed:', error)
  process.exit(1)
})
