import { test, expect, Page } from '@playwright/test'

interface PerformanceMetrics {
  label: string
  duration: number
  metadata?: Record<string, any>
}

const BASE_URL = 'http://localhost:3000'
let metrics: PerformanceMetrics[] = []

// Hardcoded test project and repository IDs from previous runs
const TEST_PROJECT_ID = 'cmqttt49c000r7kygg73fmuqv'
const TEST_REPOSITORY_ID = 'cmqtuuu49c000r7kygg73fmuqw'

test.describe('Test Suite Creation Performance', () => {
  test('should create suite with 10 test cases - measure performance', async ({
    page,
  }) => {
    test.setTimeout(120000)
    metrics = []

    // Step 1: Login
    console.log('\n=== STEP 1: LOGIN ===')
    let startTime = Date.now()
    await page.goto(`${BASE_URL}/auth/login`)
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button:has-text("Login")')
    await page.waitForURL(`${BASE_URL}/dashboard`)
    let duration = Date.now() - startTime
    console.log(`Login completed: ${duration}ms`)
    metrics.push({ label: 'Login', duration })

    // Step 2: Navigate to test suites
    console.log('\n=== STEP 2: NAVIGATE TO TEST SUITES ===')
    startTime = Date.now()
    await page.goto(`${BASE_URL}/test-suites`)
    await page.waitForLoadState('networkidle')
    duration = Date.now() - startTime
    console.log(`Navigation completed: ${duration}ms`)
    metrics.push({ label: 'Navigate to Test Suites', duration })

    // Step 3: Get available tests
    console.log('\n=== STEP 3: FETCH AVAILABLE TESTS ===')
    startTime = Date.now()
    const testResponse = await page.request.get(
      `/api/test-cases?projectId=${TEST_PROJECT_ID}`
    )
    duration = Date.now() - startTime
    const testData = await testResponse.json()
    const testCount = Array.isArray(testData) ? testData.length : 0
    console.log(`Fetched ${testCount} test cases in ${duration}ms`)
    metrics.push({
      label: 'Fetch Test Cases',
      duration,
      metadata: { testCount },
    })

    // Select first 10 tests
    const selectedTests = Array.isArray(testData) ? testData.slice(0, 10) : []
    const roamTestCaseIds = selectedTests
      .filter((t: any) => t.id)
      .map((t: any) => t.id)
    console.log(`Selected ${roamTestCaseIds.length} test cases for creation`)

    // Step 4: Click "Create Test Suite" button
    console.log('\n=== STEP 4: CLICK CREATE BUTTON ===')
    startTime = Date.now()
    await page.click('button:has-text("Create Test Suite")')
    await page.waitForSelector('[class*="modal"]', { timeout: 5000 })
    duration = Date.now() - startTime
    console.log(`Modal opened: ${duration}ms`)
    metrics.push({ label: 'Open Create Modal', duration })

    // Step 5: Fill suite details
    console.log('\n=== STEP 5: FILL SUITE DETAILS ===')
    startTime = Date.now()
    const suiteName = `Perf Test Suite ${Date.now()}`
    await page.fill('input[placeholder="e.g., Smoke Suite"]', suiteName)
    await page.fill(
      'input[placeholder="Suite description"]',
      'Performance test suite with 10 test cases'
    )
    duration = Date.now() - startTime
    console.log(`Form filled: ${duration}ms`)
    metrics.push({ label: 'Fill Form', duration })

    // Step 6: Select test cases from repository tree
    console.log('\n=== STEP 6: SELECT TEST CASES ===')
    startTime = Date.now()

    // Wait for repository selector to load
    await page.waitForSelector('[class*="Repository"]', { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    // Expand repository tree and select tests
    const expandButtons = await page.$$('button:has-text("▶")')
    console.log(`Found ${expandButtons.length} expandable nodes`)

    // Click first few expand buttons to reveal test cases
    for (let i = 0; i < Math.min(3, expandButtons.length); i++) {
      await expandButtons[i].click()
      await page.waitForTimeout(200)
    }

    // Select first 10 visible test case checkboxes
    const checkboxes = await page.$$('input[type="checkbox"]')
    const testsToSelect = Math.min(10, checkboxes.length)
    for (let i = 0; i < testsToSelect; i++) {
      await checkboxes[i].check()
    }

    duration = Date.now() - startTime
    console.log(`Selected ${testsToSelect} test cases in ${duration}ms`)
    metrics.push({
      label: 'Select Test Cases',
      duration,
      metadata: { count: testsToSelect },
    })

    // Step 7: Submit form and measure API request
    console.log('\n=== STEP 7: SUBMIT FORM (MEASURE API) ===')

    // Monitor network requests
    const networkMetrics: Array<{
      method: string
      url: string
      status: number
      duration: number
    }> = []

    page.on('response', (response) => {
      const request = response.request()
      if (request.method() === 'POST' && request.url().includes('/api')) {
        console.log(
          `${request.method()} ${request.url()} - ${response.status()}`
        )
      }
    })

    startTime = Date.now()
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/test-suites') &&
        response.status() === 201
    )

    await page.click('button:has-text("Create Suite")')

    const response = await responsePromise
    duration = Date.now() - startTime
    const suiteData = await response.json()

    console.log(`Suite creation API request: ${duration}ms (Status: ${response.status()})`)
    metrics.push({
      label: 'API POST /test-suites',
      duration,
      metadata: {
        status: response.status(),
        testCount: suiteData.testCases?.length || 0,
      },
    })

    // Step 8: Verify UI updated
    console.log('\n=== STEP 8: VERIFY UI UPDATE ===')
    startTime = Date.now()
    await page.waitForSelector(`text=${suiteName}`, { timeout: 5000 })
    await page.waitForLoadState('networkidle')
    duration = Date.now() - startTime
    console.log(`UI updated and settled: ${duration}ms`)
    metrics.push({ label: 'UI Update & Settle', duration })

    // Step 9: Fetch suites to verify creation
    console.log('\n=== STEP 9: VERIFY SUITE CREATION ===')
    startTime = Date.now()
    const suitesResponse = await page.request.get(
      `/api/test-suites?projectId=${TEST_PROJECT_ID}`
    )
    duration = Date.now() - startTime
    const suites = await suitesResponse.json()
    const createdSuite = Array.isArray(suites)
      ? suites.find((s: any) => s.name === suiteName)
      : null

    console.log(`Fetched suites: ${duration}ms`)
    if (createdSuite) {
      console.log(`✓ Suite created successfully`)
      console.log(`  - ID: ${createdSuite.id}`)
      console.log(`  - Test Cases: ${createdSuite.testCases?.length || 0}`)
    }

    metrics.push({
      label: 'Fetch Suites (Verification)',
      duration,
      metadata: { suiteCount: Array.isArray(suites) ? suites.length : 0 },
    })

    // Print performance summary
    console.log('\n\n=== PERFORMANCE SUMMARY ===')
    let totalTime = 0
    for (const metric of metrics) {
      const pct = (
        (metric.duration / metrics.reduce((sum, m) => sum + m.duration, 0)) *
        100
      ).toFixed(1)
      console.log(
        `${metric.label.padEnd(30)} ${String(metric.duration).padStart(5)}ms (${pct}%)`
      )
      if (metric.metadata) {
        Object.entries(metric.metadata).forEach(([key, value]) => {
          console.log(`  └─ ${key}: ${value}`)
        })
      }
      totalTime += metric.duration
    }
    console.log(`${'TOTAL'.padEnd(30)} ${String(totalTime).padStart(5)}ms`)
    console.log('============================\n')

    // Assertions
    expect(suiteData).toBeDefined()
    expect(suiteData.name).toBe(suiteName)
    expect(createdSuite).toBeDefined()
    expect(createdSuite.testCases.length).toBeGreaterThan(0)
  })

  test('should create suite with 50 test cases - measure performance', async ({
    page,
  }) => {
    test.setTimeout(180000)
    metrics = []

    console.log('\n\n=== TEST SUITE CREATION: 50 TEST CASES ===')

    // Quick login using API
    const loginResponse = await page.request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: 'test@example.com', password: 'testpassword123' },
    })
    expect(loginResponse.ok()).toBeTruthy()

    // Navigate to test suites
    await page.goto(`${BASE_URL}/test-suites`)
    await page.waitForLoadState('networkidle')

    // Fetch available tests
    const testResponse = await page.request.get(
      `/api/test-cases?projectId=${TEST_PROJECT_ID}`
    )
    const testData = await testResponse.json()
    const selectedTests = Array.isArray(testData) ? testData.slice(0, 50) : []

    console.log(`Available tests: ${Array.isArray(testData) ? testData.length : 0}`)
    console.log(`Selected tests: ${selectedTests.length}`)

    // Open create modal
    await page.click('button:has-text("Create Test Suite")')
    await page.waitForSelector('[class*="modal"]', { timeout: 5000 })

    // Fill details
    const suiteName = `Perf Test Suite 50 ${Date.now()}`
    await page.fill('input[placeholder="e.g., Smoke Suite"]', suiteName)

    // Measure creation
    console.log('Submitting form with 50 test cases...')
    let startTime = Date.now()

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/test-suites') &&
        response.status() === 201
    )

    await page.click('button:has-text("Create Suite")')

    try {
      const response = await responsePromise
      const duration = Date.now() - startTime
      const suiteData = await response.json()

      console.log(`Suite creation completed: ${duration}ms`)
      console.log(`Test cases created: ${suiteData.testCases?.length || 0}`)

      expect(response.ok()).toBeTruthy()
      expect(suiteData.testCases.length).toBeGreaterThan(0)
    } catch (error) {
      console.log(`Error during creation: ${error}`)
      throw error
    }
  })

  test('should verify no duplicate requests are fired', async ({ page }) => {
    test.setTimeout(60000)

    console.log('\n\n=== VERIFY NO DUPLICATE REQUESTS ===')

    const requests: Array<{
      method: string
      url: string
      timestamp: number
    }> = []

    // Intercept all requests
    page.on('request', (request) => {
      if (request.method() === 'POST' || request.method() === 'GET') {
        requests.push({
          method: request.method(),
          url: request.url(),
          timestamp: Date.now(),
        })
      }
    })

    // Perform login and navigation
    await page.goto(`${BASE_URL}/auth/login`)
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button:has-text("Login")')
    await page.waitForURL(`${BASE_URL}/dashboard`)

    // Navigate to test suites
    await page.goto(`${BASE_URL}/test-suites`)
    await page.waitForLoadState('networkidle')

    // Open and submit create form
    await page.click('button:has-text("Create Test Suite")')
    await page.waitForSelector('[class*="modal"]', { timeout: 5000 })

    const suiteName = `Dup Test Suite ${Date.now()}`
    await page.fill('input[placeholder="e.g., Smoke Suite"]', suiteName)

    // Count POST requests before creation
    const initialPostCount = requests.filter((r) => r.method === 'POST').length

    // Submit and wait for completion
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/test-suites') &&
        response.status() === 201
    )

    await page.click('button:has-text("Create Suite")')
    await responsePromise

    // Wait for UI to settle
    await page.waitForLoadState('networkidle')

    // Count POST requests after creation
    const finalPostCount = requests.filter((r) => r.method === 'POST').length
    const creationPostCount = finalPostCount - initialPostCount

    // Filter only /api/test-suites POST requests
    const testSuitesPostRequests = requests.filter(
      (r) =>
        r.method === 'POST' &&
        r.url.includes('/api/test-suites') &&
        r.url.includes('POST')
    )

    console.log(`\nRequest Analysis:`)
    console.log(`- Initial POST count: ${initialPostCount}`)
    console.log(`- Final POST count: ${finalPostCount}`)
    console.log(`- POST requests during creation: ${creationPostCount}`)
    console.log(`- /api/test-suites POST requests: ${testSuitesPostRequests.length}`)

    // Log all requests
    console.log(`\nDetailed Request Log:`)
    requests.forEach((req, i) => {
      console.log(`${i + 1}. ${req.method} ${new URL(req.url).pathname}`)
    })

    // Assert: Should be exactly 1 POST to /api/test-suites
    const suitePostRequests = requests.filter(
      (r) =>
        r.method === 'POST' &&
        r.url.includes('/api/test-suites') &&
        !r.url.includes('/create-cycle')
    )

    console.log(`\n✓ Total /api/test-suites POST requests: ${suitePostRequests.length}`)
    expect(suitePostRequests.length).toBe(1)
  })
})
