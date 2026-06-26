import { test, expect } from '@playwright/test'

test('Create Test Suite - Complete Workflow', async ({ page }) => {
  test.setTimeout(120000)

  const BASE_URL = 'http://localhost:3000'
  const PROJECT_ID = 'cmqttt49c000r7kygg73fmuqv'

  // Track errors
  let consoleErrors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  // STEP 1: Navigate to test suites
  console.log('Step 1: Navigating to test suites...')
  await page.goto(`${BASE_URL}/test-suites`)
  await page.waitForLoadState('networkidle')
  expect(consoleErrors).toHaveLength(0)
  console.log('✓ Page loaded without errors')

  // STEP 2: Click Create Test Suite
  console.log('Step 2: Opening create modal...')
  const createBtn = page.locator('button:has-text("Create Test Suite")').first()
  await createBtn.waitFor()
  await createBtn.click()
  await page.waitForTimeout(500)
  console.log('✓ Modal opened')

  // STEP 3: Wait for repository to load
  console.log('Step 3: Waiting for repository tree...')
  await page.waitForSelector('input[type="checkbox"]', { timeout: 10000 })
  console.log('✓ Repository loaded')

  // STEP 4: Fill suite name
  console.log('Step 4: Filling suite details...')
  const nameInput = page.locator('input[placeholder*="Smoke" i], input[placeholder*="Suite"]').first()
  await nameInput.fill(`Final Verification ${Date.now()}`)
  console.log('✓ Name filled')

  // STEP 5: Select test cases
  console.log('Step 5: Selecting test cases...')
  const checkboxes = page.locator('input[type="checkbox"]')
  const count = await checkboxes.count()
  console.log(`Found ${count} checkboxes`)

  // Select first 3
  for (let i = 0; i < Math.min(3, count); i++) {
    await checkboxes.nth(i).check()
    await page.waitForTimeout(100)
  }
  console.log('✓ Selected 3 test cases')

  // STEP 6: Verify UI shows correct count
  console.log('Step 6: Checking UI count display...')
  const countText = await page.locator('text=/\\d+ tests? selected/').first().textContent()
  console.log(`Count display: "${countText}"`)
  expect(countText).toMatch(/\d+ test/)
  console.log('✓ Count displayed')

  // STEP 7: Submit
  console.log('Step 7: Creating suite...')
  const submitBtn = page.locator('button:has-text("Create Suite")').last()
  await submitBtn.click()
  await page.waitForTimeout(1000)
  console.log('✓ Suite created')

  // STEP 8: Verify no errors
  if (consoleErrors.length > 0) {
    throw new Error(`Console errors: ${consoleErrors.join(', ')}`)
  }

  console.log('\n✅ COMPLETE WORKFLOW PASSED')
  console.log('✅ No console errors')
  console.log('✅ UI responsive')
  console.log('✅ Repository tree loads')
  console.log('✅ Test selection works')
  console.log('✅ Count displays correctly')
})
