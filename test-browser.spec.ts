import { test, expect } from '@playwright/test'

test('Test Suite Creation and Repository View', async ({ page }) => {
  test.setTimeout(180000)

  const BASE_URL = 'http://localhost:3000'

  let errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })

  try {
    // TEST 1: Create Test Suite (uses /api/repository)
    console.log('TEST 1: Create Test Suite Modal')
    await page.goto(`${BASE_URL}/test-suites`)
    await page.waitForLoadState('networkidle')

    const createBtn = page.locator('button:has-text("Create Test Suite")').first()
    await createBtn.waitFor({ timeout: 5000 })
    await createBtn.click()
    await page.waitForTimeout(500)

    // Wait for repository to load
    await page.waitForSelector('input[type="checkbox"]', { timeout: 30000 })
    console.log('✓ Repository loaded in modal')

    if (errors.length > 0) {
      throw new Error(`Modal load errors: ${errors.join(', ')}`)
    }

    // Fill suite details
    const nameInput = page.locator('input[placeholder*="Smoke" i], input[placeholder*="Suite"]').first()
    await nameInput.fill(`Browser Test ${Date.now()}`)

    // Select 2 tests
    const checkboxes = page.locator('input[type="checkbox"]')
    const count = await checkboxes.count()
    if (count > 0) {
      await checkboxes.first().check()
      if (count > 1) await checkboxes.nth(1).check()
    }

    console.log('✓ Tests selected')

    // Submit
    const submitBtn = page.locator('button:has-text("Create Suite")').last()
    await submitBtn.click()
    await page.waitForTimeout(2000)

    console.log('✓ Suite created')

    // Close modal
    await page.press('Escape')

    // TEST 2: View Repository Page (uses /api/repository/tree)
    console.log('\nTEST 2: Repository Page')
    await page.goto(`${BASE_URL}/repository`)
    await page.waitForLoadState('networkidle', { timeout: 60000 })

    // Check for repository tree
    const treeContent = await page.textContent('body')
    if (!treeContent || treeContent.length < 100) {
      throw new Error('Repository page did not load content')
    }

    console.log('✓ Repository page loaded')

    if (errors.length > 0) {
      throw new Error(`Page errors: ${errors.join(', ')}`)
    }

    console.log('\n✅ ALL TESTS PASSED')

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error)
    throw error
  }
})
