import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE_URL = 'http://localhost:3000'

test('PHASE 2: Browser Verification - Hierarchy Selection', async ({ page }) => {
  // Setup auth
  const testUser = { id: 'cmqmjeko900007kfg2mant8kh', email: 'test@example.com', name: 'Test User', role: 'LEAD' }
  const token = 'test-token-' + Date.now()

  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(({ user, token }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
  }, { user: testUser, token })

  console.log('\n' + '='.repeat(70))
  console.log('PHASE 2: BROWSER VERIFICATION - TEST SUITE MANAGEMENT')
  console.log('='.repeat(70))

  // Navigate and select project
  await page.goto(`${BASE_URL}/test-suites`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  const projectSelector = page.locator('select')
  const options = await page.locator('select > option').all()

  for (const opt of options) {
    const text = await opt.textContent()
    if (text?.includes('Kinergy test') && !text?.includes('New') && !text?.includes('QA')) {
      const value = await opt.getAttribute('value')
      if (value) {
        await projectSelector.selectOption(value)
        await page.waitForTimeout(2000)
        break
      }
    }
  }

  // Create suite
  const createBtn = page.locator('button:has-text("Create Test Suite")').first()
  await createBtn.click()
  await page.waitForTimeout(1000)

  const suiteName = `Phase2-${Date.now()}`
  const nameInput = page.locator('input[placeholder="e.g., Smoke Suite"]')
  await nameInput.fill(suiteName)

  // Expand and select
  const expandButtons = await page.locator('button').filter({ hasText: '▶' }).all()
  if (expandButtons.length > 0) await expandButtons[0].click()
  await page.waitForTimeout(500)

  const checkboxes = await page.locator('input[type="checkbox"]').all()
  if (checkboxes.length > 0) await checkboxes[0].click()
  await page.waitForTimeout(500)

  // Get UI count
  const allText = await page.textContent('body')
  const uiCount = parseInt(allText?.match(/(\d+) tests? selected/)?.[1] || '0', 10)

  console.log(`\n[CREATE SUITE]`)
  console.log(`Suite Name: ${suiteName}`)
  console.log(`UI Count: ${uiCount}`)

  // Create
  const createSuiteBtn = page.locator('button:has-text("Create Suite")')
  await createSuiteBtn.click()
  await page.waitForTimeout(2000)

  // Verify in DB
  const dbSuite = await prisma.testSuite.findFirst({
    where: { name: suiteName },
    include: { testCases: true },
  })

  const dbCount = dbSuite?.testCases.length || 0

  console.log(`DB Count: ${dbCount}`)
  console.log(`Match: ${uiCount === dbCount ? '✓' : '✗'}`)

  expect(dbSuite).toBeTruthy()
  expect(dbCount).toBeGreaterThan(0)
  expect(uiCount).toBe(dbCount)

  console.log('\n✓ PHASE 2 VERIFIED: UI count == DB count')
  console.log('='.repeat(70) + '\n')
})

test.afterAll(async () => {
  await prisma.$disconnect()
})
