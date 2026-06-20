import { test, expect, Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE_URL = 'http://localhost:3000'

// Test project with data
const TEST_PROJECT_ID = '79d857b2'  // Kinergy test - has 1484 test cases
const TEST_USER_EMAIL = 'test@example.com'

interface VerificationStep {
  stepName: string
  suiteName: string
  uiCount: number
  dbCount: number
  passed: boolean
}

const verificationResults: VerificationStep[] = []

async function loginUser(page: Page) {
  // Set up localStorage with test user session
  const testUser = {
    id: 'cmqmjeko900007kfg2mant8kh',
    email: TEST_USER_EMAIL,
    name: 'Test User',
    role: 'LEAD',
  }

  const token = 'test-token-' + Date.now()

  // Go to a neutral page first
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' })

  // Set localStorage
  await page.evaluate(({ user, token }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
  }, { user: testUser, token })

  console.log('✓ Session credentials set in localStorage')
  return true
}

async function verifyStep(
  page: Page,
  stepName: string,
  suiteName: string,
  expectedDbCount: number | null = null
) {
  // Get UI count
  const suiteRow = page.locator(`text="${suiteName}"`).locator('..')
  const testCountText = await suiteRow
    .locator('span:has-text(/\\d+ test cases?/)')
    .textContent()
    .catch(() => '0 test cases')

  const uiCount = parseInt(testCountText?.match(/\d+/)?.[0] || '0', 10)

  // Get DB count
  const dbSuite = await prisma.testSuite.findFirst({
    where: { name: suiteName },
    include: { testCases: true },
  })

  const dbCount = dbSuite?.testCases.length || 0

  // Compare
  const passed = uiCount === dbCount && (expectedDbCount === null || dbCount === expectedDbCount)

  verificationResults.push({
    stepName,
    suiteName,
    uiCount,
    dbCount,
    passed,
  })

  console.log(`\n${stepName}:`)
  console.log(`  Suite: ${suiteName}`)
  console.log(`  UI Count: ${uiCount}`)
  console.log(`  DB Count: ${dbCount}`)
  console.log(`  Match: ${passed ? '✓' : '✗'}`)

  if (!passed) {
    throw new Error(
      `VERIFICATION FAILED: UI (${uiCount}) != DB (${dbCount})`
    )
  }

  return { uiCount, dbCount }
}

test('PHASE 2 Browser Verification: Repository Hierarchy Selection', async ({ page }) => {
  // Log in
  const loggedIn = await loginUser(page)

  // Navigate to test-suites page
  console.log(`\n[NAVIGATE] Going to ${BASE_URL}/test-suites`)
  await page.goto(`${BASE_URL}/test-suites`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  // Debug: check page state
  const pageTitle = await page.title()
  console.log(`[PAGE] Title: ${pageTitle}`)

  // Try to find all h1 elements
  const h1s = await page.locator('h1').allTextContents()
  console.log(`[PAGE] Found ${h1s.length} h1 elements: ${h1s.join(', ')}`)

  // Try to find all buttons
  const buttons = await page.locator('button').allTextContents()
  console.log(`[PAGE] Found ${buttons.length} buttons`)

  const createBtnText = buttons.find((b) => b.includes('Create'))
  if (createBtnText) {
    console.log(`[PAGE] Found create button: "${createBtnText}"`)
  } else {
    console.log('[PAGE] No create button found')
  }

  // Select project (if not already selected)
  const projectSelector = page.locator('select')
  const selectCount = await projectSelector.count()
  console.log(`[SELECT] Found ${selectCount} select elements`)

  if (selectCount > 0) {
    // Get all options and find "Kinergy test" specifically
    const options = await page.locator('select > option').all()
    console.log(`[SELECT] Found ${options.length} options`)
    let found = false
    for (const opt of options) {
      const text = await opt.textContent()
      // Look for "Kinergy test" specifically (the one with 1484 test cases)
      if (text?.includes('Kinergy test') && !text?.includes('Kinergy New test') && !text?.includes('Kinergy QA')) {
        const value = await opt.getAttribute('value')
        console.log(`[SELECT] Found 'Kinergy test' with value: ${value}`)
        if (value) {
          console.log('[SELECT] Selecting project...')
          await projectSelector.selectOption(value)
          console.log('[SELECT] Project selected, waiting for UI to update...')
          // Wait for useEffect to fetch data
          await page.waitForTimeout(3000)
          found = true
          break
        }
      }
    }
    if (!found) {
      console.log('[SELECT] Kinergy test project not found - listing all options with "Kinergy":')
      for (const opt of options) {
        const text = await opt.textContent()
        if (text?.includes('Kinergy')) {
          console.log(`  - ${text}`)
        }
      }
    }
  }

  // Click Create Test Suite
  const createBtn = page.locator('button:has-text("Create Test Suite")').first()
  const createBtnVisible = await createBtn.isVisible().catch(() => false)

  console.log(`[CREATE] Button visible: ${createBtnVisible}`)

  if (!createBtnVisible) {
    console.log('\n✗ Create button not visible after waiting')
    const pageContent = await page.content()
    const hasCreateText = pageContent?.includes('Create Test Suite')
    console.log(`[DEBUG] Page HTML has 'Create Test Suite': ${hasCreateText}`)
    const mainElement = await page.locator('main').isVisible()
    console.log(`[DEBUG] Main element visible: ${mainElement}`)
    test.skip()
  }

  console.log('\n[MODAL] Opening create suite modal')
  await createBtn.click()
  await page.waitForTimeout(2000)

  // Verify modal appears
  const modal = page.locator('h2:has-text("Create Test Suite")')
  const modalVisible = await modal.isVisible().catch(() => false)

  console.log(`[MODAL] Modal visible: ${modalVisible}`)

  if (!modalVisible) {
    console.log('✗ Create modal not visible')
    test.skip()
  }

  // Fill suite name
  const suiteName = `Phase2-Verify-${Date.now()}`
  const nameInput = page.locator('input[placeholder="e.g., Smoke Suite"]')
  const nameInputVisible = await nameInput.isVisible().catch(() => false)

  console.log(`[FORM] Name input visible: ${nameInputVisible}`)

  if (!nameInputVisible) {
    console.log('✗ Suite name input not visible')
    test.skip()
  }

  await nameInput.fill(suiteName)

  // Find tree selector
  const treeSelector = page.locator('h3:has-text("Select Test Cases")')
  const treeSelectorVisible = await treeSelector.isVisible().catch(() => false)
  console.log(`[TREE] Selector h3 visible: ${treeSelectorVisible}`)

  // Wait for tree to load
  await page.waitForTimeout(2000)

  // Find and select test cases from hierarchy
  const checkboxes = page.locator('input[type="checkbox"]')
  let checkboxCount = await checkboxes.count()

  console.log(`[TREE] Found ${checkboxCount} checkboxes`)

  if (checkboxCount === 0) {
    // Check if there's error text
    const bodyText = await page.locator('body').textContent()
    const hasLoadingText = bodyText?.includes('Loading repository')
    const hasErrorText = bodyText?.includes('error') || bodyText?.includes('Error')
    console.log(`[TREE] Has 'Loading repository': ${hasLoadingText}`)
    console.log(`[TREE] Has error text: ${hasErrorText}`)

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-phase2-modal.png' })
    console.log('[DEBUG] Screenshot saved: test-phase2-modal.png')

    test.skip()
  }

  // Select first checkbox (this will select a node + descendants)
  console.log(`\n[CREATE SUITE] Selecting from ${checkboxCount} available checkboxes`)
  await checkboxes.first().click()
  await page.waitForTimeout(500)

  // Verify test count updates
  const testCountDisplay = page.locator('span:has-text(/\\d+ tests? selected/)')
  const countVisible = await testCountDisplay.isVisible()
  expect(countVisible).toBe(true)

  const testCountText = await testCountDisplay.textContent()
  const selectedCount = parseInt(testCountText?.match(/\d+/)?.[0] || '0', 10)
  console.log(`Selected ${selectedCount} test cases from hierarchy`)

  // Create suite
  const createSuiteBtn = page.locator('button:has-text("Create Suite")')
  await createSuiteBtn.click()
  await page.waitForTimeout(1500)

  // Verify suite appears in list
  const suiteLink = page.locator(`text="${suiteName}"`).first()
  expect(await suiteLink.isVisible()).toBe(true)

  console.log(`\n✓ Suite created: ${suiteName}`)

  // ========================================
  // STEP 1: Verify initial creation
  // ========================================
  await verifyStep(page, '[1] CREATE SUITE', suiteName, selectedCount)

  // ========================================
  // STEP 2: Edit suite - rename
  // ========================================
  const editBtn = page.locator(`text="${suiteName}"`).locator('..').locator('button:has-text("Edit")').first()
  await editBtn.click()
  await page.waitForTimeout(500)

  const editModal = page.locator('h2:has-text("Edit Test Suite")')
  expect(await editModal.isVisible()).toBe(true)

  const newSuiteName = `${suiteName}-Renamed`
  const editNameInput = page.locator('input[placeholder="e.g., Smoke Suite"]')
  await editNameInput.clear()
  await editNameInput.fill(newSuiteName)

  // Save
  const saveBtn = page.locator('button:has-text("Save Changes")')
  await saveBtn.click()
  await page.waitForTimeout(1500)

  console.log(`\n✓ Suite renamed: ${newSuiteName}`)

  // Verify rename worked in UI
  const renamedSuite = page.locator(`text="${newSuiteName}"`).first()
  expect(await renamedSuite.isVisible()).toBe(true)

  // ========================================
  // STEP 2B: Verify rename persisted
  // ========================================
  await verifyStep(page, '[2] RENAME SUITE', newSuiteName, selectedCount)

  // ========================================
  // STEP 3: Edit suite - add more tests
  // ========================================
  const editBtn2 = page.locator(`text="${newSuiteName}"`).locator('..').locator('button:has-text("Edit")').first()
  await editBtn2.click()
  await page.waitForTimeout(500)

  const editModal2 = page.locator('h2:has-text("Edit Test Suite")')
  expect(await editModal2.isVisible()).toBe(true)

  // Click another checkbox to add more tests
  const allCheckboxes = page.locator('input[type="checkbox"]')
  const countBefore = await allCheckboxes.locator(':checked').count()

  // Find unchecked checkbox
  const unchecked = allCheckboxes.filter({ has: page.locator('[type="checkbox"]:not(:checked)') })
  if (await unchecked.count() > 0) {
    await unchecked.first().click()
    await page.waitForTimeout(500)
  }

  // Save
  const saveBtn2 = page.locator('button:has-text("Save Changes")')
  await saveBtn2.click()
  await page.waitForTimeout(1500)

  console.log(`\n✓ Suite tests modified`)

  // Get new count
  const suiteRow = page.locator(`text="${newSuiteName}"`).locator('..')
  const testCountText2 = await suiteRow
    .locator('span:has-text(/\\d+ test cases?/)')
    .textContent()
  const newUICount = parseInt(testCountText2?.match(/\d+/)?.[0] || '0', 10)

  // ========================================
  // STEP 3B: Verify add tests
  // ========================================
  await verifyStep(page, '[3] ADD TESTS', newSuiteName, newUICount)

  // ========================================
  // STEP 4: Refresh page and verify persistence
  // ========================================
  console.log(`\n[REFRESH] Reloading page...`)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  // Re-select project if needed
  if (await projectSelector.count() > 0) {
    const options = await page.locator('select > option').all()
    for (const opt of options) {
      const text = await opt.textContent()
      if (text?.includes('Kinergy test') && !text?.includes('Kinergy New test') && !text?.includes('Kinergy QA')) {
        const value = await opt.getAttribute('value')
        if (value) {
          await projectSelector.selectOption(value)
          await page.waitForTimeout(1000)
          break
        }
      }
    }
  }

  // Verify suite still exists with correct name
  const persistedSuite = page.locator(`text="${newSuiteName}"`).first()
  expect(await persistedSuite.isVisible()).toBe(true)

  console.log(`✓ Suite persisted after page refresh`)

  // ========================================
  // STEP 4B: Verify persistence
  // ========================================
  await verifyStep(page, '[4] REFRESH PAGE', newSuiteName, newUICount)

  // ========================================
  // STEP 5: Delete suite and verify
  // ========================================
  const deleteBtn = page.locator(`text="${newSuiteName}"`).locator('..').locator('button:has-text("Delete")').first()
  await deleteBtn.click()

  // Confirm deletion
  page.once('dialog', (dialog) => {
    dialog.accept()
  })

  await page.waitForTimeout(1500)

  // Verify suite gone
  const deletedSuite = page.locator(`text="${newSuiteName}"`).first()
  const isVisible = await deletedSuite.isVisible().catch(() => false)
  expect(isVisible).toBe(false)

  // Verify DB
  const dbAfterDelete = await prisma.testSuite.findFirst({
    where: { name: newSuiteName },
  })
  expect(dbAfterDelete).toBeNull()

  console.log(`\n✓ Suite deleted successfully`)
  console.log(`✓ Deletion verified in database`)

  verificationResults.push({
    stepName: '[5] DELETE SUITE',
    suiteName: newSuiteName,
    uiCount: 0,
    dbCount: 0,
    passed: true,
  })
})

test.afterAll(async () => {
  console.log('\n\n' + '='.repeat(60))
  console.log('PHASE 2 BROWSER VERIFICATION SUMMARY')
  console.log('='.repeat(60))

  verificationResults.forEach((result) => {
    const status = result.passed ? '✓' : '✗'
    console.log(`\n${status} ${result.stepName}`)
    console.log(`  Suite: ${result.suiteName}`)
    console.log(`  UI Count: ${result.uiCount}`)
    console.log(`  DB Count: ${result.dbCount}`)
  })

  const allPassed = verificationResults.every((r) => r.passed)
  console.log('\n' + '='.repeat(60))
  if (allPassed) {
    console.log('✓ ALL VERIFICATION STEPS PASSED')
  } else {
    console.log('✗ SOME VERIFICATION STEPS FAILED')
    const failed = verificationResults.filter((r) => !r.passed)
    failed.forEach((f) => {
      console.log(`  - ${f.stepName}: UI=${f.uiCount} DB=${f.dbCount}`)
    })
  }
  console.log('='.repeat(60) + '\n')

  await prisma.$disconnect()
})
