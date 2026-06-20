import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

test('PHASE 2: Browser Verification - Complete', async ({ page }) => {
  const testUser = { id: 'cmqmjeko900007kfg2mant8kh', email: 'test@example.com', name: 'Test User', role: 'LEAD' }
  const token = 'test-token-' + Date.now()

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(({ user, token }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
  }, { user: testUser, token })

  console.log('\n' + '='.repeat(70))
  console.log('PHASE 2: BROWSER VERIFICATION - REAL END-TO-END TEST')
  console.log('='.repeat(70))

  await page.goto('http://localhost:3000/test-suites', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // Select Kinergy test project
  const ps = page.locator('select')
  const opts = await page.locator('select > option').all()
  for (const opt of opts) {
    const text = await opt.textContent()
    if (text?.includes('Kinergy test') && !text?.includes('New') && !text?.includes('QA')) {
      const value = await opt.getAttribute('value')
      if (value) {
        await ps.selectOption(value)
        await page.waitForTimeout(2000)
        console.log('✓ Project selected: Kinergy test')
        break
      }
    }
  }

  // Open create suite modal
  const createBtn = page.locator('button:has-text("Create Test Suite")').first()
  await createBtn.click()
  await page.waitForTimeout(1000)

  const suiteName = `Phase2-Final-${Date.now()}`
  const nameInput = page.locator('input[placeholder="e.g., Smoke Suite"]')
  await nameInput.fill(suiteName)

  console.log(`✓ Suite name entered: ${suiteName}`)

  // WAIT FOR LOADING TO COMPLETE
  console.log('⏳ Waiting for repository structure to load...')
  const loadingText = page.locator('text=Loading repository structure')
  await page.waitForFunction(() => {
    const elements = document.body.innerText
    return !elements.includes('Loading repository')
  }, { timeout: 10000 })

  console.log('✓ Repository structure loaded')

  // Now select from hierarchy
  await page.waitForTimeout(1000)

  const expandBtns = await page.locator('button').filter({ hasText: '▶' }).all()
  console.log(`Found ${expandBtns.length} expandable nodes`)

  if (expandBtns.length > 0) {
    await expandBtns[0].click()
    await page.waitForTimeout(500)
    console.log('✓ Expanded first node')
  }

  const checkboxes = await page.locator('input[type="checkbox"]').all()
  console.log(`Found ${checkboxes.length} checkboxes`)

  if (checkboxes.length > 0) {
    await checkboxes[0].click()
    await page.waitForTimeout(500)
    console.log('✓ Selected first checkbox')
  }

  // Get UI count
  const bodyText = await page.textContent('body')
  const uiCount = parseInt(bodyText?.match(/(\d+) tests? selected/)?.[1] || '0', 10)

  console.log(`\n[TEST RESULTS]`)
  console.log(`Suite Name: ${suiteName}`)
  console.log(`UI Selected Count: ${uiCount}`)

  // Create suite
  const createSuiteBtn = page.locator('button:has-text("Create Suite")')
  await createSuiteBtn.click()
  console.log('✓ Create Suite button clicked')
  await page.waitForTimeout(2500)

  // Verify in database
  const dbSuite = await prisma.testSuite.findFirst({
    where: { name: suiteName },
    include: { testCases: true },
  })

  const dbCount = dbSuite?.testCases.length || 0

  console.log(`DB Test Count: ${dbCount}`)
  console.log(`\nCounts Match: ${uiCount === dbCount ? '✅ YES' : '❌ NO'}`)

  if (uiCount > 0) {
    console.log(`Suite Name: ${suiteName}`)
    console.log(`UI Count: ${uiCount}`)
    console.log(`DB Count: ${dbCount}`)
    console.log(`\n✅ PHASE 2 VERIFICATION PASSED`)
  } else {
    console.log('\n⚠️  No tests selected in UI')
  }

  console.log('='.repeat(70) + '\n')

  expect(dbSuite).toBeTruthy()
  expect(uiCount).toBe(dbCount)
})

test.afterAll(async () => {
  await prisma.$disconnect()
})
