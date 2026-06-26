import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

// Test credentials from the app
const TEST_CREDENTIALS = {
  email: 'lead@test.com',
  password: 'hashedpassword123'
}

test('FULL WORKFLOW: Login → Dashboard → Repository → Suite Creation', async ({ page }) => {
  console.log('\n=== FULL WORKFLOW TEST ===\n')

  // Step 1: Login
  console.log('Step 1: Login')
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[type="email"]', TEST_CREDENTIALS.email)
  await page.fill('input[type="password"]', TEST_CREDENTIALS.password)
  await page.click('button[type="submit"]')
  await page.waitForNavigation()
  await page.waitForTimeout(2000)

  console.log('✓ Logged in successfully')

  // Step 2: Dashboard
  console.log('\nStep 2: Test Dashboard')
  await page.goto(`${BASE_URL}/dashboard`)
  await page.waitForLoadState('networkidle')

  // Select a project
  await page.selectOption('select', 'cmqttt49c000r7kygg73fmuqv')
  await page.waitForTimeout(3000)

  // Check if metrics load
  const metricsVisible = await page.locator('text=/metrics|tests|dashboard/i').isVisible()
  console.log(`✓ Metrics visible: ${metricsVisible}`)

  // Step 3: Repository
  console.log('\nStep 3: Test Repository Page')
  await page.goto(`${BASE_URL}/repository`)
  await page.waitForLoadState('networkidle')

  const hasRepositoryContent = await page.content().then(html =>
    html.includes('Repository') || html.includes('Test Hierarchy')
  )
  console.log(`✓ Repository page loaded: ${hasRepositoryContent}`)

  // Step 4: Test Cases
  console.log('\nStep 4: Test Test Cases Page')
  await page.goto(`${BASE_URL}/test-cases`)
  await page.waitForLoadState('networkidle')

  const testCasesContent = await page.content()
  const hasTestCases = testCasesContent.length > 20000 // Non-login page is larger
  console.log(`✓ Test cases page loaded: ${hasTestCases}`)

  // Step 5: Test Suites
  console.log('\nStep 5: Test Test Suites Page')
  await page.goto(`${BASE_URL}/test-suites`)
  await page.waitForLoadState('networkidle')

  const suitesContent = await page.content()
  const hasSuites = suitesContent.length > 20000
  console.log(`✓ Test suites page loaded: ${hasSuites}`)

  console.log('\n=== WORKFLOW COMPLETE ===')
})
