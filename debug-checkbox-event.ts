import { chromium } from 'playwright'

async function debugCheckboxEvent() {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.setViewportSize({ width: 1920, height: 1080 })

  // Capture all console logs
  page.on('console', (msg) => {
    if (msg.text().includes('TestCaseGrid')) {
      console.log(`[BROWSER] ${msg.text()}`)
    }
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

  console.log('🧪 Finding select-all checkbox...')
  const checkboxes = await page.locator('input[type="checkbox"]')
  const count = await checkboxes.count()
  console.log(`  Total checkboxes: ${count}`)

  if (count > 0) {
    // Get the first checkbox (select-all)
    const selectAllCheckbox = checkboxes.first()
    const isChecked = await selectAllCheckbox.isChecked()
    const isEnabled = await selectAllCheckbox.isEnabled()

    console.log(`  Select-all checkbox: checked=${isChecked}, enabled=${isEnabled}`)

    // Try different ways to click/change it
    console.log('\n🔧 Method 1: Direct check() call...')
    await selectAllCheckbox.check()
    await page.waitForTimeout(1500)
    let checked = await selectAllCheckbox.isChecked()
    console.log(`  After check(): ${checked}`)

    console.log('\n🔧 Method 2: Click and wait...')
    await selectAllCheckbox.click()
    await page.waitForTimeout(1500)
    checked = await selectAllCheckbox.isChecked()
    console.log(`  After click(): ${checked}`)

    console.log('\n🔧 Method 3: Programmatic change...')
    await page.evaluate(() => {
      const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement
      if (checkbox) {
        checkbox.checked = !checkbox.checked
        // Trigger change event
        const event = new Event('change', { bubbles: true })
        checkbox.dispatchEvent(event)
        console.log('[TEST] Dispatched change event')
      }
    })
    await page.waitForTimeout(1500)
    checked = await selectAllCheckbox.isChecked()
    console.log(`  After programmatic change: ${checked}`)

    // Check storage
    const storage = await page.evaluate(() => sessionStorage.getItem('test-cases-selection'))
    console.log(`\n💾 sessionStorage["test-cases-selection"]: ${storage || 'null'}`)

    await page.screenshot({ path: 'debug-checkbox-methods.png', fullPage: true })
    console.log('\n📸 Screenshot saved: debug-checkbox-methods.png')
  }

  await browser.close()
}

debugCheckboxEvent().catch(console.error)
