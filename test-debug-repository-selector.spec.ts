import { test, expect } from '@playwright/test'

test('Debug: Repository Tree Selector and Test Case Counts', async ({ page }) => {
  // Capture console messages
  const consoleLogs: string[] = []
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`)
    console.log(`[BROWSER ${msg.type()}] ${msg.text()}`)
  })

  // Navigate to test suites
  console.log('Navigating to test suites...')
  await page.goto('http://localhost:3000/test-suites', { waitUntil: 'networkidle' })

  // Wait for page to load
  await page.waitForTimeout(2000)

  // Click Create Test Suite
  console.log('Looking for Create Test Suite button...')
  const createButton = page.locator('button:has-text("Create Test Suite")').first()
  const isVisible = await createButton.isVisible({ timeout: 5000 }).catch(() => false)

  if (!isVisible) {
    console.log('Button not visible, taking screenshot...')
    await page.screenshot({ path: 'debug-screenshot.png' })
    throw new Error('Create Test Suite button not found')
  }

  console.log('Clicking Create Test Suite button...')
  await createButton.click()

  // Wait for modal to appear
  console.log('Waiting for modal...')
  await page.waitForSelector('[class*="modal"]', { timeout: 5000 }).catch(() => {
    console.log('Modal selector not found, looking for any dialog...')
  })

  // Wait for the suite name input
  console.log('Waiting for suite name input...')
  const suiteNameInput = page.locator('input[placeholder*="Suite"]').first()
  await suiteNameInput.waitFor({ timeout: 5000 }).catch(() => {
    console.log('Suite name input not found')
  })

  // Check if repository tree selector is visible
  console.log('Checking for repository tree selector...')
  const repositorySection = page.locator('text=Select Test Cases')
  const repoVisible = await repositorySection.isVisible({ timeout: 5000 }).catch(() => false)

  if (repoVisible) {
    console.log('✓ Repository tree selector found')
    // Take a screenshot to see the tree
    await page.screenshot({ path: 'repository-tree.png' })
  } else {
    console.log('✗ Repository tree selector not found')
  }

  // Print all console logs collected
  console.log('\n=== BROWSER CONSOLE LOGS ===')
  consoleLogs.forEach(log => console.log(log))
  console.log('=== END CONSOLE LOGS ===\n')

  // Check for any errors
  const errors = consoleLogs.filter(log => log.includes('error') || log.includes('Error') || log.includes('TypeError'))
  if (errors.length > 0) {
    console.log('ERRORS FOUND:')
    errors.forEach(err => console.log(err))
  }
})
