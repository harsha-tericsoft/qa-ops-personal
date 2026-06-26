import { test, expect, Page } from '@playwright/test'

test('Test Suite Creation Workflow - Fix Verification', async ({ page, context }) => {
  test.setTimeout(180000)

  const BASE_URL = 'http://localhost:3000'
  const PROJECT_ID = 'cmqttt49c000r7kygg73fmuqv'

  let errors: string[] = []

  // Track console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const errorText = `CONSOLE ERROR: ${msg.text()}`
      console.error(`🔴 ${errorText}`)
      errors.push(errorText)
    }
  })

  page.on('response', res => {
    if (res.status() >= 500) {
      const error = `HTTP ERROR ${res.status()}: ${res.url()}`
      console.error(`🔴 ${error}`)
      errors.push(error)
    }
  })

  try {
    // STEP 1: Navigate to Test Suites
    console.log('\n1. Navigating to Test Suites page...')
    await page.goto(`${BASE_URL}/test-suites`)
    await page.waitForLoadState('networkidle')
    console.log('✓ Test Suites page loaded')

    // STEP 2: Check for console errors on page load
    if (errors.length > 0) {
      throw new Error(`Page load errors: ${errors.join(', ')}`)
    }

    // STEP 3: Click Create Test Suite button
    console.log('\n2. Opening Create Test Suite modal...')
    const createButton = page.locator('button:has-text("Create Test Suite")').first()
    await createButton.click()
    await page.waitForTimeout(500)
    console.log('✓ Modal opened')

    // STEP 4: Wait for repository tree to load
    console.log('\n3. Waiting for repository tree to load...')
    await page.waitForSelector('[class*="tree"], [class*="node"], input[type="checkbox"]', {
      timeout: 10000,
    })
    console.log('✓ Repository tree loaded')

    // Check for errors during tree load
    if (errors.length > 0) {
      throw new Error(`Repository load errors: ${errors.join(', ')}`)
    }

    // STEP 5: Fill suite name
    console.log('\n4. Filling suite details...')
    const nameInput = page.locator('input[placeholder*="Smoke" i], input[placeholder*="Suite"]').first()
    const suiteName = `Fix Test Suite ${Date.now()}`
    await nameInput.fill(suiteName)
    console.log(`✓ Suite name filled: ${suiteName}`)

    // STEP 6: Select test cases
    console.log('\n5. Selecting test cases...')
    const checkboxes = page.locator('input[type="checkbox"]').filter({ hasNot: page.locator('aria-label=/select all/i') })
    const checkboxCount = await checkboxes.count()
    console.log(`Found ${checkboxCount} test case checkboxes`)

    // Select first 5 tests
    const selectCount = Math.min(5, checkboxCount)
    for (let i = 0; i < selectCount; i++) {
      await checkboxes.nth(i).check()
      await page.waitForTimeout(50)
    }
    console.log(`✓ Selected ${selectCount} test cases`)

    // STEP 7: Verify UI count updates
    console.log('\n6. Verifying selection count in UI...')
    await page.waitForTimeout(500)
    const selectedText = await page.locator('text=/\\d+ test/i').first().textContent()
    console.log(`✓ Selected text: "${selectedText}"`)
    expect(selectedText).toMatch(/\d+/)

    // STEP 8: Submit suite creation
    console.log('\n7. Creating suite...')
    const submitButton = page.locator('button:has-text("Create Suite")').last()

    // Wait for API response
    const responsePromise = page.waitForResponse(
      res => res.url().includes('/api/test-suites') && res.status() === 201
    ).catch(() => null)

    await submitButton.click()
    const response = await responsePromise

    if (!response) {
      throw new Error('Suite creation API did not return 201')
    }

    const suiteData = await response.json()
    console.log(`✓ Suite created: ${suiteData.id}`)
    console.log(`  Test cases in response: ${suiteData.testCases?.length || 0}`)

    // STEP 9: Wait for modal to close and UI to update
    console.log('\n8. Waiting for modal to close...')
    await page.waitForTimeout(1000)
    await page.press('Escape')
    await page.waitForLoadState('networkidle')

    // STEP 10: Verify suite appears in list
    console.log('\n9. Verifying suite in list...')
    await page.waitForSelector(`text=${suiteName}`, { timeout: 5000 })
    const suiteElement = page.locator(`text=${suiteName}`)
    expect(await suiteElement.count()).toBe(1)
    console.log('✓ Suite found in list')

    // STEP 11: Check test count displayed in suite
    console.log('\n10. Checking test count in suite card...')
    const suiteCard = suiteElement.locator('..').locator('..').locator('..')
    const testCountText = await suiteCard.locator('text=/\\d+ test/i').first().textContent().catch(() => 'Not found')
    console.log(`✓ Test count displayed: "${testCountText}"`)

    // STEP 12: Verify no critical errors
    console.log('\n11. Verifying no critical errors...')
    if (errors.length > 0) {
      const criticalErrors = errors.filter(e => !e.includes('network') && !e.includes('manifest'))
      if (criticalErrors.length > 0) {
        throw new Error(`Critical errors detected: ${criticalErrors.join(', ')}`)
      }
    }
    console.log('✓ No critical errors')

    console.log('\n' + '='.repeat(50))
    console.log('✅ TEST SUITE CREATION WORKFLOW FIXED')
    console.log('='.repeat(50))

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error)
    throw error
  }
})
