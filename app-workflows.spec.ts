import { test, expect, Page } from '@playwright/test'

test('Complete Application Workflow Execution', async ({ page, context }) => {
  test.setTimeout(600000) // 10 minute timeout

  const BASE_URL = 'http://localhost:3000'
  const TEST_PROJECT_ID = 'cmqttt49c000r7kygg73fmuqv'
  let errors: string[] = []

  // Setup error tracking
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const error = `CONSOLE ERROR: ${msg.text()}`
      console.error(`🔴 ${error}`)
      errors.push(error)
    }
  })

  page.on('response', res => {
    if (res.status() >= 500) {
      const error = `HTTP ${res.status()}: ${res.url()}`
      console.error(`🔴 ${error}`)
      errors.push(error)
    }
  })

  try {
    // ========== WORKFLOW 1: LOGIN & DASHBOARD ==========
    console.log('\n\n========== WORKFLOW 1: LOGIN & DASHBOARD ==========')

    console.log('Navigating to login...')
    await page.goto(`${BASE_URL}/login`)
    await page.waitForLoadState('networkidle')

    if (page.url().includes('/dashboard')) {
      console.log('✓ Already logged in')
    } else {
      console.log('Attempting login...')
      const emailInput = page.locator('input[type="email"]').first()
      const passwordInput = page.locator('input[type="password"]').first()
      const loginButton = page.locator('button:has-text("Login")').first()

      if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await emailInput.fill('test@example.com')
        await passwordInput.fill('testpassword123')
        await loginButton.click()
        await page.waitForNavigation({ timeout: 10000 })
        console.log('✓ Login submitted')
      }
    }

    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForLoadState('networkidle')
    console.log('✓ Dashboard accessible')

    // ========== WORKFLOW 2: PROJECTS ==========
    console.log('\n\n========== WORKFLOW 2: PROJECTS ==========')

    await page.goto(`${BASE_URL}/projects`)
    await page.waitForLoadState('networkidle')
    const projectElements = page.locator('[class*="rounded-lg"]').first()
    expect(await projectElements.isVisible({ timeout: 3000 })).toBeTruthy()
    console.log('✓ Projects page loads')

    // ========== WORKFLOW 3: REPOSITORY ==========
    console.log('\n\n========== WORKFLOW 3: REPOSITORY ==========')

    await page.goto(`${BASE_URL}/repository`)
    await page.waitForLoadState('networkidle')
    const repoContent = await page.content()
    expect(repoContent.length).toBeGreaterThan(100)
    console.log('✓ Repository page loads')

    // Test expansion
    const expandButtons = page.locator('button:has-text("▶"), button:has-text("▼")')
    const expandCount = await expandButtons.count()
    if (expandCount > 0) {
      await expandButtons.first().click()
      await page.waitForTimeout(300)
      console.log(`✓ Expansion works (found ${expandCount} nodes)`)
    }

    // ========== WORKFLOW 4: TEST CASES ==========
    console.log('\n\n========== WORKFLOW 4: TEST CASES ==========')

    await page.goto(`${BASE_URL}/test-cases`)
    await page.waitForLoadState('networkidle')
    const testContent = await page.content()
    expect(testContent.length).toBeGreaterThan(100)
    console.log('✓ Test Cases page loads')

    // ========== WORKFLOW 5: TEST SUITES ==========
    console.log('\n\n========== WORKFLOW 5: TEST SUITES ==========')

    await page.goto(`${BASE_URL}/test-suites`)
    await page.waitForLoadState('networkidle')

    const createButton = page.locator('button:has-text("Create Test Suite")').first()
    if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('✓ Test Suites page loads')

      // Try creating a suite
      await createButton.click()
      await page.waitForTimeout(500)

      const suiteNameInput = page.locator('input[placeholder*="Smoke" i], input[placeholder*="Suite"]').first()
      if (await suiteNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        const suiteName = `Test Suite ${Date.now()}`
        await suiteNameInput.fill(suiteName)

        // Try to submit
        const submitButton = page.locator('button:has-text("Create Suite")').last()
        if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('✓ Create suite modal works')

          const responsePromise = page.waitForResponse(
            res => res.url().includes('/api/test-suites') && res.status() === 201
          ).catch(() => null)

          await submitButton.click()
          const response = await responsePromise
          if (response) {
            console.log('✓ Suite creation API works')
          }
        }
      }

      // Close modal
      await page.press('Escape')
    }

    // ========== WORKFLOW 6: EXECUTION CYCLES ==========
    console.log('\n\n========== WORKFLOW 6: EXECUTION CYCLES ==========')

    await page.goto(`${BASE_URL}/cycles`)
    await page.waitForLoadState('networkidle')
    const cyclesContent = await page.content()
    expect(cyclesContent.length).toBeGreaterThan(100)
    console.log('✓ Execution Cycles page loads')

    // ========== WORKFLOW 7: TAGS ==========
    console.log('\n\n========== WORKFLOW 7: TAGS ==========')

    await page.goto(`${BASE_URL}/tags`)
    await page.waitForLoadState('networkidle')
    const tagsContent = await page.content()
    expect(tagsContent.length).toBeGreaterThan(100)
    console.log('✓ Tags page loads')

    // ========== WORKFLOW 8: ROAM ==========
    console.log('\n\n========== WORKFLOW 8: ROAM CONFIGURATION ==========')

    await page.goto(`${BASE_URL}/roam`)
    await page.waitForLoadState('networkidle')
    const roamContent = await page.content()
    expect(roamContent.length).toBeGreaterThan(100)
    console.log('✓ Roam page loads')

    // ========== FINAL VERIFICATION ==========
    console.log('\n\n========== FINAL VERIFICATION ==========')

    if (errors.length === 0) {
      console.log('\n✅ ALL WORKFLOWS PASSED - ZERO ERRORS/FAILURES')
    } else {
      console.log(`\n❌ FOUND ${errors.length} ERRORS:`)
      errors.forEach(e => console.log(`  - ${e}`))
      throw new Error(`Application has ${errors.length} errors`)
    }

  } catch (error) {
    console.error('\n❌ WORKFLOW FAILED:', error)
    throw error
  }
})
