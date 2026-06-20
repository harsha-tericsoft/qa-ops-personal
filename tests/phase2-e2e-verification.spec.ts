import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE_URL = 'http://localhost:3000'
const TEST_USER_EMAIL = 'test@example.com'

// Kinergy test project (1484 test cases, 1 repository)
const KINERGY_TEST_PROJECT_ID = '79d857b2-36dd-4810-88ae-3ca8d9aaa8d4'

test.describe('PHASE 2 Browser Verification: E2E Test Suite Management', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authentication
    const testUser = {
      id: 'cmqmjeko900007kfg2mant8kh',
      email: TEST_USER_EMAIL,
      name: 'Test User',
      role: 'LEAD',
    }

    const token = 'test-token-' + Date.now()

    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' })

    await page.evaluate(({ user, token }) => {
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
    }, { user: testUser, token })

    console.log('✓ Authentication session established')
  })

  test('[1] CREATE SUITE WITH HIERARCHY SELECTION', async ({ page }) => {
    console.log('\n' + '='.repeat(60))
    console.log('[1] CREATE SUITE WITH HIERARCHY SELECTION')
    console.log('='.repeat(60))

    // Navigate to test-suites
    await page.goto(`${BASE_URL}/test-suites`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    // Select Kinergy test project
    const projectSelector = page.locator('select')
    const options = await page.locator('select > option').all()

    for (const opt of options) {
      const text = await opt.textContent()
      if (text?.includes('Kinergy test') && !text?.includes('New test') && !text?.includes('QA')) {
        const value = await opt.getAttribute('value')
        if (value) {
          await projectSelector.selectOption(value)
          await page.waitForTimeout(2000)
          break
        }
      }
    }

    // Open create modal
    const createBtn = page.locator('button:has-text("Create Test Suite")').first()
    await createBtn.click()
    await page.waitForTimeout(1000)

    // Verify modal is open
    const modal = page.locator('h2:has-text("Create Test Suite")')
    expect(await modal.isVisible()).toBe(true)

    // Fill suite name
    const suiteName = `Phase2-E2E-${Date.now()}`
    const nameInput = page.locator('input[placeholder="e.g., Smoke Suite"]')
    await nameInput.fill(suiteName)

    console.log(`Suite Name: ${suiteName}`)

    // Find expand button for first node (TestSuite : Kinergy)
    const expandButtons = page.locator('button').filter({ hasText: '▶' })
    const firstExpand = expandButtons.first()

    // Expand the first node
    await firstExpand.click()
    await page.waitForTimeout(500)

    // Find the first checkbox under expanded node (should be "Clients")
    const checkboxes = page.locator('input[type="checkbox"]')
    const firstCheckbox = checkboxes.first()
    await firstCheckbox.click()
    await page.waitForTimeout(500)

    // Verify test count updates
    const allSpans = await page.locator('span').allTextContents()
    const countSpan = allSpans.find((text) => text.includes('tests selected'))
    const selectedCount = parseInt(countSpan?.match(/\d+/)?.[0] || '0', 10)

    console.log(`Selected: ${selectedCount} tests from hierarchy`)

    // Create suite
    const createSuiteBtn = page.locator('button:has-text("Create Suite")')
    await createSuiteBtn.click()
    await page.waitForTimeout(3000)

    // Wait for modal to close and page to reload
    const modalGone = await modal.isVisible().then(() => false).catch(() => true)
    console.log(`Modal closed: ${modalGone}`)

    // Reload page to see the new suite
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    // Re-select project
    const projectSelector2 = page.locator('select')
    const options2 = await page.locator('select > option').all()
    for (const opt of options2) {
      const text = await opt.textContent()
      if (text?.includes('Kinergy test') && !text?.includes('New test') && !text?.includes('QA')) {
        const value = await opt.getAttribute('value')
        if (value) {
          await projectSelector2.selectOption(value)
          await page.waitForTimeout(2000)
          break
        }
      }
    }

    // Verify suite appears in list
    const suiteLink = page.locator(`text="${suiteName}"`).first()
    const visible = await suiteLink.isVisible().catch(() => false)
    console.log(`Suite visible after reload: ${visible}`)

    expect(visible).toBe(true)

    // Get UI count from the suite row using a more specific selector
    const allTextContent = await page.textContent('body')
    // Find the suite name in the text
    const suiteIndex = allTextContent?.indexOf(suiteName)
    let uiCount = 0
    if (suiteIndex !== undefined && suiteIndex >= 0) {
      // Look ahead for "X test cases" after the suite name
      const afterSuite = allTextContent?.substring(suiteIndex + suiteName.length, suiteIndex + suiteName.length + 100)
      const match = afterSuite?.match(/(\d+) test cases/)
      uiCount = parseInt(match?.[1] || '0', 10)
    }

    // Get DB count
    const dbSuite = await prisma.testSuite.findFirst({
      where: { name: suiteName },
      include: { testCases: true },
    })
    const dbCount = dbSuite?.testCases.length || 0

    // Verify counts match
    console.log(`\n✓ VERIFICATION [1]:`)
    console.log(`  Suite Name: ${suiteName}`)
    console.log(`  UI Count: ${uiCount}`)
    console.log(`  DB Count: ${dbCount}`)
    console.log(`  Match: ${uiCount === dbCount ? '✓' : '✗'}`)

    expect(uiCount).toBe(dbCount)
    expect(dbCount).toBeGreaterThan(0)

    console.log('\n✓ PHASE 2 VERIFIED: Suite creation with hierarchy selection works!')
  })
})

test.afterAll(async () => {
  await prisma.$disconnect()
})
