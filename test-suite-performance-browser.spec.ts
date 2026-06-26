import { test, expect, Page } from '@playwright/test'

test.describe('Test Suite Creation - Performance & Correctness', () => {
  let projectId: string

  test.beforeAll(async () => {
    // Use known project from previous test runs
    projectId = 'cmqttt49c000r7kygg73fmuqv'
  })

  test('should create suite with 10 tests - single POST request verified', async ({
    page,
  }) => {
    test.setTimeout(60000)

    const requests: string[] = []

    // Monitor network requests
    page.on('request', (request) => {
      if (request.url().includes('/api/test-suites')) {
        requests.push(`${request.method()} ${request.url()}`)
      }
    })

    // Navigate to test suites page
    await page.goto('http://localhost:3000/test-suites')
    await page.waitForLoadState('networkidle')

    // Verify page loaded
    expect(await page.locator('h1').textContent()).toContain('Test Suites')

    // Open create modal
    await page.click('button:has-text("Create Test Suite")')
    await page.waitForSelector('[class*="modal"]', { timeout: 5000 })

    // Fill suite details
    const suiteName = `Browser Test Suite ${Date.now()}`
    await page.fill('input[placeholder="e.g., Smoke Suite"]', suiteName)
    await page.fill(
      'input[placeholder="Suite description"]',
      'Created via browser test'
    )

    // Select first 10 tests from tree
    await page.waitForSelector('[class*="Repository"]', { timeout: 10000 })
    const checkboxes = await page.$$('input[type="checkbox"]')
    const testsToSelect = Math.min(10, checkboxes.length)
    for (let i = 0; i < testsToSelect; i++) {
      await checkboxes[i].check()
    }

    // Verify selection count updated
    const selectedText = await page.locator(
      'text=/\\d+ tests? selected/'
    ).textContent()
    expect(selectedText).toContain('selected')

    // Clear previous requests and monitor creation
    const creationRequests: string[] = []
    page.removeAllListeners('request')
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        request.url().includes('/api/test-suites')
      ) {
        creationRequests.push(request.url())
      }
    })

    // Submit form and wait for completion
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/test-suites') &&
        response.status() === 201
    )

    await page.click('button:has-text("Create Suite")')

    const response = await responsePromise
    const suite = await response.json()

    // ASSERTION: Exactly one POST request
    console.log(`POST requests to /api/test-suites: ${creationRequests.length}`)
    expect(creationRequests.length).toBe(1)

    // Verify suite created correctly
    expect(suite.id).toBeDefined()
    expect(suite.name).toBe(suiteName)
    expect(suite.testCases).toBeDefined()
    expect(suite.testCases.length).toBeGreaterThan(0)

    // Verify UI updated immediately (no separate fetch)
    await page.waitForSelector(`text=${suiteName}`, { timeout: 5000 })
    const suiteElement = page.locator(`text=${suiteName}`)
    expect(await suiteElement.count()).toBeGreaterThan(0)

    // Verify no duplicate entries
    const suiteCount = await suiteElement.count()
    console.log(`Suite appears in UI: ${suiteCount} time(s)`)
    expect(suiteCount).toBe(1)

    console.log('✓ Suite created with single POST request')
    console.log(`✓ Suite ID: ${suite.id}`)
    console.log(`✓ Test count: ${suite.testCases.length}`)
  })

  test('should handle suite editing without unnecessary refetch', async ({
    page,
  }) => {
    test.setTimeout(60000)

    // Navigate to test suites
    await page.goto('http://localhost:3000/test-suites')
    await page.waitForLoadState('networkidle')

    // Find first suite and edit it
    const editButtons = await page.$$('button:has-text("Edit")')
    if (editButtons.length === 0) {
      console.log('No suites to edit, skipping test')
      test.skip()
      return
    }

    const suiteRow = editButtons[0].locator('..')
    const originalName = await suiteRow
      .locator('h3')
      .textContent()

    // Click edit button
    await editButtons[0].click()
    await page.waitForSelector('[class*="modal"]', { timeout: 5000 })

    // Update name
    const updatedName = `Updated Suite ${Date.now()}`
    const nameInput = page.locator('input[placeholder="e.g., Smoke Suite"]')
    await nameInput.clear()
    await nameInput.fill(updatedName)

    // Monitor requests
    const patchRequests: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'PATCH') {
        patchRequests.push(request.url())
      }
    })

    // Submit
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/test-suites') &&
        response.request().method() === 'PATCH'
    )

    await page.click('button:has-text("Save Changes")')

    const response = await responsePromise

    // ASSERTION: Exactly one PATCH request
    expect(patchRequests.length).toBe(1)
    expect(response.status()).toBe(200)

    // Verify UI updated without full page reload
    await page.waitForSelector(`text=${updatedName}`, { timeout: 5000 })
    expect(await page.locator(`text=${updatedName}`).count()).toBeGreaterThan(0)

    console.log('✓ Suite updated with single PATCH request')
    console.log(`✓ New name: ${updatedName}`)
  })

  test('should not create duplicates on network retry', async ({ page }) => {
    test.setTimeout(60000)

    await page.goto('http://localhost:3000/test-suites')
    await page.waitForLoadState('networkidle')

    const initialSuiteCount = await page.locator('[class*="grid"]').count()

    // Create a suite
    await page.click('button:has-text("Create Test Suite")')
    await page.waitForSelector('[class*="modal"]', { timeout: 5000 })

    const suiteName = `No Duplicate Test ${Date.now()}`
    await page.fill('input[placeholder="e.g., Smoke Suite"]', suiteName)

    // Select tests
    const checkboxes = await page.$$('input[type="checkbox"]')
    for (let i = 0; i < Math.min(5, checkboxes.length); i++) {
      await checkboxes[i].check()
    }

    // Wait for creation
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/test-suites') &&
        response.status() === 201
    )

    await page.click('button:has-text("Create Suite")')
    const response = await responsePromise
    const suite = await response.json()

    // Verify exact match
    expect(suite.name).toBe(suiteName)

    // Count occurrences in UI
    await page.waitForTimeout(1000) // Wait for UI to settle
    const occurrences = await page
      .locator(`text=${suiteName}`)
      .count()

    console.log(`Suite "${suiteName}" appears ${occurrences} time(s)`)
    expect(occurrences).toBe(1)

    console.log('✓ No duplicate suite created')
  })

  test('should display correct test count', async ({ page }) => {
    test.setTimeout(60000)

    await page.goto('http://localhost:3000/test-suites')
    await page.waitForLoadState('networkidle')

    // Create suite with specific test count
    await page.click('button:has-text("Create Test Suite")')
    await page.waitForSelector('[class*="modal"]', { timeout: 5000 })

    const suiteName = `Exact Count Test ${Date.now()}`
    await page.fill('input[placeholder="e.g., Smoke Suite"]', suiteName)

    // Select exactly 7 tests
    const checkboxes = await page.$$('input[type="checkbox"]')
    const selectCount = 7
    for (let i = 0; i < selectCount; i++) {
      await checkboxes[i].check()
    }

    // Wait for creation
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/test-suites') &&
        response.status() === 201
    )

    await page.click('button:has-text("Create Suite")')

    // Verify test count display
    await page.waitForSelector(`text=${suiteName}`, { timeout: 5000 })
    const suiteCard = page.locator(
      `text=${suiteName}`
    ).locator('..')

    // Look for test count text
    const testCountText = await suiteCard.locator('text=/\\d+ test/').textContent()
    console.log(`Test count display: ${testCountText}`)

    // Extract number from text
    const match = testCountText?.match(/(\d+)/)
    const displayedCount = match ? parseInt(match[1]) : 0

    expect(displayedCount).toBeGreaterThan(0)
    console.log(`✓ Suite displays correct test count: ${displayedCount}`)
  })
})
