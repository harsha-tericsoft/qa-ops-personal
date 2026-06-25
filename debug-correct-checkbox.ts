import { chromium } from 'playwright'

async function debugCorrectCheckbox() {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.setViewportSize({ width: 1920, height: 1080 })

  // Capture browser console with TestCaseGrid logs
  page.on('console', (msg) => {
    const text = msg.text()
    if (text.includes('[TestCaseGrid]') || text.includes('[handleSelectAll]')) {
      console.log(`[BROWSER] ${text}`)
    }
  })

  console.log('🔐 Logging in...')
  await page.goto('http://localhost:3000/login')
  await page.fill('input[placeholder="you@example.com"]', 'lead@test.com')
  await page.fill('input[placeholder="••••••••"]', 'hashedpassword123')
  await page.click('button:has-text("Sign In")')
  await page.waitForURL('http://localhost:3000/dashboard')

  console.log('📄 Going to test-cases...')
  await page.goto('http://localhost:3000/test-cases', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  console.log('\n🔍 Finding checkboxes...')
  const allCheckboxes = await page.locator('input[type="checkbox"]')
  const count = await allCheckboxes.count()
  console.log(`Total checkboxes: ${count}`)

  // Find all checkboxes and log their positions
  const checkboxInfo = await page.evaluate(() => {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]')
    return Array.from(checkboxes).map((cb, i) => ({
      index: i,
      parent: (cb.parentElement?.className || '').substring(0, 50),
      ariaLabel: (cb as any).getAttribute('aria-label'),
      id: (cb as any).id || 'none',
      hasOnChange: (cb as any).onchange !== null,
      parentText: cb.parentElement?.textContent?.substring(0, 50),
    }))
  })

  console.log('\nCheckbox details:')
  checkboxInfo.forEach((info) => {
    console.log(`  [${info.index}] parent="${info.parent}" text="${info.parentText}"`)
  })

  // Try clicking the checkbox in the header (should have "Select tests" nearby)
  console.log('\n🎯 Looking for "Select tests" text...')
  const selectTestsElement = await page.locator('text=Select tests')
  const selectTestsCount = await selectTestsElement.count()
  console.log(`Found ${selectTestsCount} elements with "Select tests" text`)

  if (selectTestsCount > 0) {
    // The checkbox should be near this text
    const parent = await selectTestsElement.first().locator('..').locator('..').locator('input[type="checkbox"]')
    const parentCount = await parent.count()
    console.log(`Found checkbox near "Select tests": ${parentCount}`)

    if (parentCount > 0) {
      console.log('\n🖱️  Clicking the correct checkbox...')
      await parent.first().click()
      await page.waitForTimeout(2000)

      const checked = await parent.first().isChecked()
      console.log(`  Checkbox checked: ${checked}`)

      const storage = await page.evaluate(() => sessionStorage.getItem('test-cases-selection'))
      console.log(`  sessionStorage updated: ${storage !== null}`)
    }
  } else {
    console.log('⚠️  Could not find "Select tests" text')
  }

  await page.screenshot({ path: 'debug-correct-checkbox.png', fullPage: true })
  console.log('\n📸 Screenshot saved')
  await browser.close()
}

debugCorrectCheckbox().catch(console.error)
