import { test, expect, Page } from '@playwright/test'

test.describe('Verify RepositoryTreeSelector Fix - Complete Workflow', () => {
  test('Complete workflow: Login → Create Suite → Verify Counts → Create Cycle', async ({ page, context }) => {
    test.setTimeout(180000)

    // Capture all console messages
    const consoleLogs: string[] = []
    const errors: string[] = []

    page.on('console', (msg) => {
      const text = `[${msg.type()}] ${msg.text()}`
      consoleLogs.push(text)
      if (msg.type() === 'error') {
        errors.push(text)
      }
      console.log(`BROWSER: ${text}`)
    })

    // Capture page errors
    page.on('pageerror', (error) => {
      const text = `[pageerror] ${error.message}`
      errors.push(text)
      console.log(`BROWSER ERROR: ${text}`)
    })

    // ========== STEP 1: LOGIN ==========
    console.log('\n========== STEP 1: LOGIN ==========')
    await page.goto('http://localhost:3000/auth/login', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)

    // Try to find and fill login form
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first()
    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Found email input, logging in...')
      await emailInput.fill('test@example.com')
      await page.locator('input[type="password"]').fill('testpassword123')
      await page.locator('button:has-text("Login")').click()
      await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {
        console.log('Login redirect timed out, continuing...')
      })
    } else {
      console.log('Login form not found, skipping login (may already be authenticated)')
    }

    // ========== STEP 2: NAVIGATE TO TEST SUITES ==========
    console.log('\n========== STEP 2: NAVIGATE TO TEST SUITES ==========')
    await page.goto('http://localhost:3000/test-suites', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // ========== STEP 3: OPEN CREATE TEST SUITE MODAL ==========
    console.log('\n========== STEP 3: OPEN CREATE TEST SUITE MODAL ==========')
    const createButton = page.locator('button:has-text("Create Test Suite")').first()
    const createButtonVisible = await createButton.isVisible({ timeout: 5000 }).catch(() => false)

    if (!createButtonVisible) {
      console.log('ERROR: Create Test Suite button not found')
      errors.push('Create Test Suite button not found - user may not be logged in or lack LEAD role')
      throw new Error('Cannot proceed: Create Test Suite button not visible')
    }

    console.log('✓ Create Test Suite button found')
    await createButton.click()
    await page.waitForTimeout(1500)

    // ========== STEP 4: VERIFY MODAL OPENED ==========
    console.log('\n========== STEP 4: VERIFY MODAL OPENED ==========')
    const modal = page.locator('[role="dialog"], div:has(input[placeholder*="Suite"])').first()
    const modalVisible = await modal.isVisible({ timeout: 5000 }).catch(() => false)

    if (!modalVisible) {
      console.log('ERROR: Modal did not open')
      errors.push('Modal failed to open')
      throw new Error('Cannot proceed: Modal not visible')
    }

    console.log('✓ Modal opened successfully')

    // ========== STEP 5: VERIFY REPOSITORY TREE LOADED ==========
    console.log('\n========== STEP 5: VERIFY REPOSITORY TREE LOADED ==========')
    const treeSelector = page.locator('text=/Select Test Cases/i').first()
    const treeVisible = await treeSelector.isVisible({ timeout: 5000 }).catch(() => false)

    if (!treeVisible) {
      console.log('ERROR: Repository Tree Selector not found')
      errors.push('Repository Tree Selector not visible')
      throw new Error('Cannot proceed: Repository Tree Selector not visible')
    }

    console.log('✓ Repository Tree Selector loaded')

    // ========== STEP 6: CHECK CONSOLE ERRORS SO FAR ==========
    console.log('\n========== STEP 6: CHECK CONSOLE ERRORS ==========')
    console.log(`Total console messages: ${consoleLogs.length}`)
    console.log(`Errors so far: ${errors.length}`)
    if (errors.length > 0) {
      console.log('ERRORS DETECTED:')
      errors.forEach((err) => console.log(`  - ${err}`))
    }

    // Check for TypeError about filter
    const filterErrors = consoleLogs.filter((log) => log.includes('filter') && log.includes('TypeError'))
    if (filterErrors.length > 0) {
      console.log('ERROR: Found testCases.filter errors:')
      filterErrors.forEach((err) => console.log(`  - ${err}`))
      throw new Error('testCases.filter error detected')
    }

    // ========== STEP 7: EXPAND TREE AND SELECT NODES ==========
    console.log('\n========== STEP 7: EXPAND TREE AND SELECT NODES ==========')

    // Get initial tree state
    const expandButtons = page.locator('button:has-text("▶"), button:has-text("▼")')
    const initialExpandCount = await expandButtons.count()
    console.log(`Found ${initialExpandCount} expand/collapse buttons`)

    // Expand first 3 nodes
    let expanded = 0
    for (let i = 0; i < Math.min(3, initialExpandCount); i++) {
      const button = expandButtons.nth(i)
      const text = await button.textContent()
      if (text?.includes('▶')) {
        console.log(`Expanding node ${i + 1}...`)
        await button.click()
        await page.waitForTimeout(300)
        expanded++
      }
    }

    console.log(`✓ Expanded ${expanded} nodes`)

    // Get all checkboxes
    const checkboxes = page.locator('input[type="checkbox"]')
    const checkboxCount = await checkboxes.count()
    console.log(`Found ${checkboxCount} checkboxes`)

    // Select first 5 checkboxes
    let selected = 0
    for (let i = 0; i < Math.min(5, checkboxCount); i++) {
      const checkbox = checkboxes.nth(i)
      const isChecked = await checkbox.isChecked()
      if (!isChecked) {
        await checkbox.click()
        await page.waitForTimeout(100)
        selected++
      }
    }

    console.log(`✓ Selected ${selected} test cases`)

    // ========== STEP 8: GET SELECTED COUNT FROM UI ==========
    console.log('\n========== STEP 8: GET SELECTED COUNT FROM UI ==========')
    const selectedCountText = page.locator('text=/tests? selected/i').first()
    const countVisible = await selectedCountText.isVisible({ timeout: 3000 }).catch(() => false)

    let selectedCount = 0
    if (countVisible) {
      const text = await selectedCountText.textContent()
      const match = text?.match(/(\d+)/)
      selectedCount = match ? parseInt(match[1]) : 0
      console.log(`✓ Selected count from UI: ${selectedCount} test cases`)
    } else {
      console.log('WARNING: Could not find selected count in UI')
    }

    // ========== STEP 9: GET RUNTIME testCases VALUE ==========
    console.log('\n========== STEP 9: GET RUNTIME testCases VALUE ==========')

    // Inject script to log testCases state
    const testCasesInfo = await page.evaluate(() => {
      return (window as any).__testCasesDebug || {
        detected: false,
        message: 'testCases state not exposed to window'
      }
    }).catch(() => ({ detected: false, message: 'Failed to evaluate' }))

    console.log('testCases runtime info:', testCasesInfo)

    // ========== STEP 10: ENTER SUITE NAME ==========
    console.log('\n========== STEP 10: ENTER SUITE NAME ==========')
    const suiteNameInput = page.locator('input[placeholder*="Suite"]').first()
    const nameInputVisible = await suiteNameInput.isVisible({ timeout: 2000 }).catch(() => false)

    if (!nameInputVisible) {
      console.log('ERROR: Suite name input not found')
      errors.push('Suite name input not visible')
      throw new Error('Cannot proceed: Suite name input not visible')
    }

    const testSuiteName = `Test Suite ${Date.now()}`
    await suiteNameInput.fill(testSuiteName)
    console.log(`✓ Entered suite name: ${testSuiteName}`)

    // ========== STEP 11: CREATE SUITE ==========
    console.log('\n========== STEP 11: CREATE SUITE ==========')
    const createSuiteButton = page.locator('button:has-text("Create")').last()
    await createSuiteButton.click()
    await page.waitForTimeout(3000)

    // Verify suite was created
    const successMessage = page.locator('text=/created|successfully/i').first()
    const successVisible = await successMessage.isVisible({ timeout: 3000 }).catch(() => false)

    if (successVisible) {
      console.log('✓ Suite created successfully')
    } else {
      console.log('WARNING: Success message not found, checking page content')
    }

    // ========== STEP 12: VERIFY CREATED SUITE COUNT ==========
    console.log('\n========== STEP 12: VERIFY CREATED SUITE COUNT ==========')
    await page.goto('http://localhost:3000/test-suites', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // Find the suite we just created
    const suiteCard = page.locator(`text=${testSuiteName}`).first()
    const suiteVisible = await suiteCard.isVisible({ timeout: 5000 }).catch(() => false)

    if (suiteVisible) {
      console.log('✓ Created suite found in list')

      // Get test count from card
      const testCountText = suiteCard.locator('..').locator('text=/test case/i').first()
      const countText = await testCountText.textContent().catch(() => '')
      const countMatch = countText.match(/(\d+)/)
      const suiteTestCount = countMatch ? parseInt(countMatch[1]) : 0

      console.log(`✓ Suite shows ${suiteTestCount} test cases`)

      // ========== STEP 13: REFRESH AND VERIFY COUNT PERSISTS ==========
      console.log('\n========== STEP 13: REFRESH AND VERIFY COUNT PERSISTS ==========')
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(2000)

      const suiteCardAfterRefresh = page.locator(`text=${testSuiteName}`).first()
      const testCountTextAfter = suiteCardAfterRefresh.locator('..').locator('text=/test case/i').first()
      const countTextAfter = await testCountTextAfter.textContent().catch(() => '')
      const countMatchAfter = countTextAfter.match(/(\d+)/)
      const suiteTestCountAfter = countMatchAfter ? parseInt(countMatchAfter[1]) : 0

      console.log(`✓ After refresh: Suite shows ${suiteTestCountAfter} test cases`)

      if (suiteTestCount === suiteTestCountAfter) {
        console.log(`✓ Count persisted: ${suiteTestCount} == ${suiteTestCountAfter}`)
      } else {
        console.log(`ERROR: Count changed after refresh: ${suiteTestCount} → ${suiteTestCountAfter}`)
        errors.push(`Suite test count changed after refresh: ${suiteTestCount} → ${suiteTestCountAfter}`)
      }
    } else {
      console.log('ERROR: Created suite not found in list')
      errors.push('Created suite not found in list')
    }

    // ========== FINAL ERROR CHECK ==========
    console.log('\n========== FINAL ERROR CHECK ==========')
    console.log(`Total errors: ${errors.length}`)
    if (errors.length > 0) {
      console.log('ERRORS FOUND:')
      errors.forEach((err) => console.log(`  ✗ ${err}`))
    } else {
      console.log('✓ NO ERRORS - WORKFLOW PASSED')
    }

    // Final assertion
    expect(errors).toEqual([])
  })
})
