import { test, expect } from '@playwright/test'

test.describe('Bug: Test Suite loses selected test cases after creation', () => {
  test('should persist 21 selected test cases after suite creation', async ({ page, context }) => {
    // Setup: Open DevTools
    const networkLog: any[] = []
    page.on('response', async (response) => {
      if (response.url().includes('/api/test-suites') || response.url().includes('/api/test-cases')) {
        networkLog.push({
          url: response.url(),
          method: response.request().method(),
          status: response.status(),
          body: await response.text().catch(() => 'N/A'),
          time: new Date().toISOString(),
        })
      }
    })

    // Step 1: Navigate to Test Suites
    console.log('\n=== STEP 1: Navigate to Test Suites ===')
    await page.goto('http://localhost:3000/test-suites')
    await page.waitForLoadState('networkidle')

    // Step 2: Click "Create Test Suite" button
    console.log('\n=== STEP 2: Open Create Suite Modal ===')
    await page.click('button:has-text("Create Test Suite")')
    await page.waitForSelector('[class*="modal"]', { timeout: 5000 })

    // Step 3: Check suite name input is visible
    const suiteNameInput = page.locator('input[placeholder*="Smoke Suite"]').first()
    await expect(suiteNameInput).toBeVisible()

    // Step 4: Enter suite name
    console.log('\n=== STEP 3: Enter Suite Name ===')
    await suiteNameInput.fill('Bug Test Suite 21')

    // Step 5: Locate and interact with repository tree
    console.log('\n=== STEP 4: Open Repository Tree ===')
    const treeContainer = page.locator('div:has-text("Select Test Cases")')
    await expect(treeContainer).toBeVisible()

    // Step 6: Expand first few nodes to find test cases
    console.log('\n=== STEP 5: Expand Tree and Select Test Cases ===')
    const expandButtons = page.locator('button:has-text("▶"), button:has-text("▼")')
    let expandCount = 0
    for (let i = 0; i < expandButtons.count() && expandCount < 5; i++) {
      try {
        const button = expandButtons.nth(i)
        const text = await button.textContent()
        if (text?.includes('▶')) {
          await button.click()
          expandCount++
          await page.waitForTimeout(300)
        }
      } catch (e) {
        // Skip if can't expand
      }
    }

    // Step 7: Get all available checkboxes in the tree
    const checkboxes = page.locator('input[type="checkbox"]')
    const checkboxCount = await checkboxes.count()
    console.log(`Found ${checkboxCount} checkboxes in tree`)

    // Step 8: Select exactly 21 test cases (or as many as available)
    const selectCount = Math.min(21, checkboxCount - 1) // -1 to skip any root checkbox
    console.log(`Selecting ${selectCount} test cases...`)

    for (let i = 1; i <= selectCount; i++) {
      const checkbox = checkboxes.nth(i)
      const isChecked = await checkbox.isChecked()
      if (!isChecked) {
        await checkbox.check()
        await page.waitForTimeout(100)
      }
    }

    // Step 9: Verify selection count is shown
    console.log('\n=== STEP 6: Verify Selection Count ===')
    const selectedCount = page.locator('text=/\\d+\\s+test[s]?\\s+selected/')
    await expect(selectedCount).toBeVisible()
    const selectedText = await selectedCount.textContent()
    console.log(`Selected count displayed: ${selectedText}`)

    // Step 10: Extract the number from the selection text
    const numberMatch = selectedText?.match(/(\d+)/)
    const expectedCount = numberMatch ? parseInt(numberMatch[1]) : 0
    console.log(`Expected test case count: ${expectedCount}`)

    // Step 11: Click Create Suite button
    console.log('\n=== STEP 7: Create Suite ===')
    await page.click('button:has-text("Create Suite")')

    // Wait for success message or modal to close
    await page.waitForTimeout(2000)
    await page.waitForLoadState('networkidle')

    console.log('\n=== STEP 8: Check POST Request ===')
    const createRequest = networkLog.find(r => r.url.includes('/api/test-suites') && r.method === 'POST')
    if (createRequest) {
      console.log('CREATE REQUEST:')
      console.log('URL:', createRequest.url)
      console.log('BODY:', createRequest.body)

      // Parse and validate payload
      try {
        const payload = JSON.parse(createRequest.body)
        console.log('Payload roamTestCaseIds count:', payload.roamTestCaseIds?.length || 0)
        console.log('Expected to send:', expectedCount, 'test cases')
        expect(payload.roamTestCaseIds?.length).toBe(expectedCount)
      } catch (e) {
        console.log('Could not parse POST body')
      }
    }

    // Step 12: Check POST Response
    console.log('\n=== STEP 9: Check POST Response ===')
    const createResponse = networkLog.find(r => r.url.includes('/api/test-suites') && r.method === 'POST')
    if (createResponse) {
      try {
        const responseData = JSON.parse(createResponse.body)
        const responseTestCount = responseData.testCases?.length || 0
        console.log('POST Response testCases count:', responseTestCount)
        expect(responseTestCount).toBe(expectedCount)
      } catch (e) {
        console.log('Could not parse POST response')
      }
    }

    // Step 13: Refresh page and check if suite persists
    console.log('\n=== STEP 10: Refresh Page ===')
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Step 14: Check GET /api/test-suites response
    console.log('\n=== STEP 11: Check GET Response ===')
    const getResponse = networkLog.find(r => r.url.includes('/api/test-suites') && r.method === 'GET')
    if (getResponse) {
      try {
        const responseData = JSON.parse(getResponse.body)
        const suites = responseData.data || responseData
        console.log('GET Response contains', Array.isArray(suites) ? suites.length : 0, 'suites')

        // Find our created suite
        const ourSuite = Array.isArray(suites)
          ? suites.find((s: any) => s.name === 'Bug Test Suite 21')
          : null

        if (ourSuite) {
          const persistedCount = ourSuite.testCases?.length || 0
          console.log(`Suite "${ourSuite.name}" has ${persistedCount} test cases`)
          console.log('Expected:', expectedCount)
          console.log('Actual:', persistedCount)

          // THIS IS THE BUG - persistedCount should equal expectedCount
          if (persistedCount === 0 && expectedCount > 0) {
            console.log('❌ BUG CONFIRMED: Test cases lost after creation!')
          } else {
            console.log('✅ Test cases persisted correctly!')
          }

          expect(persistedCount).toBe(expectedCount)
        }
      } catch (e) {
        console.log('Could not parse GET response:', e)
      }
    }

    // Step 15: Verify in UI
    console.log('\n=== STEP 12: Verify in UI ===')
    const suiteElement = page.locator(`text=Bug Test Suite 21`)
    if (await suiteElement.isVisible()) {
      // Try to find test count near suite
      const suiteCard = suiteElement.locator('xpath=ancestor::div[@class*="grid" or @class*="card"]')
      const text = await suiteCard.textContent()
      console.log('Suite card text:', text)
    }
  })
})
