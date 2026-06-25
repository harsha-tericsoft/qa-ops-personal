import { chromium } from 'playwright'

async function debugSelectAll() {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.setViewportSize({ width: 1920, height: 1080 })

  // Capture console logs
  page.on('console', (msg) => {
    console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`)
  })

  console.log('🔐 Logging in...')
  await page.goto('http://localhost:3000/login')
  await page.fill('input[placeholder="you@example.com"]', 'lead@test.com')
  await page.fill('input[placeholder="••••••••"]', 'hashedpassword123')
  await page.click('button:has-text("Sign In")')
  await page.waitForURL('http://localhost:3000/dashboard')
  console.log('✓ Logged in\n')

  console.log('📄 Going to test-cases...')
  await page.goto('http://localhost:3000/test-cases', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  console.log('📊 Page state:')
  const checkboxes = await page.locator('input[type="checkbox"]')
  const count = await checkboxes.count()
  console.log(`  - Checkboxes found: ${count}`)

  // Check what's in sessionStorage
  const storage = await page.evaluate(() => {
    return {
      testCasesSelection: sessionStorage.getItem('test-cases-selection'),
    }
  })
  console.log(`  - sessionStorage["test-cases-selection"]: ${storage.testCasesSelection}`)

  if (count > 0) {
    console.log('\n🖱️  Clicking "Select All" checkbox...')
    await checkboxes.first().click()
    await page.waitForTimeout(2000)

    // Check console logs for the [Selection] message
    console.log('\n📋 Checking page state after click:')

    // Check sessionStorage again
    const storage2 = await page.evaluate(() => {
      return {
        testCasesSelection: sessionStorage.getItem('test-cases-selection'),
      }
    })
    console.log(`  - sessionStorage["test-cases-selection"]: ${storage2.testCasesSelection}`)

    // Check if selection bar is visible
    const selectionBar = await page.locator('[class*="blue-50"], [class*="selected"]')
    console.log(`  - Selection bar elements found: ${await selectionBar.count()}`)

    // Get all visible text
    const bodyText = await page.textContent('body')
    const selectedMatches = bodyText?.match(/\d+\s+selected/gi)
    console.log(`  - "X selected" text in body: ${selectedMatches?.join(', ') || 'NOT FOUND'}`)

    // Screenshot
    await page.screenshot({ path: 'debug-select-all-state.png', fullPage: true })
    console.log('  📸 Screenshot saved: debug-select-all-state.png')

    // Check the actual React state via the DOM
    const selected = await page.evaluate(() => {
      // Try to find all checked checkboxes
      const allCheckboxes = document.querySelectorAll('input[type="checkbox"]')
      const checkedCount = Array.from(allCheckboxes).filter((cb: any) => cb.checked).length
      return checkedCount
    })
    console.log(`  - Checked checkboxes in DOM: ${selected}`)
  }

  await browser.close()
}

debugSelectAll().catch(console.error)
