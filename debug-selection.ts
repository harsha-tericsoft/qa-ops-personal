import { chromium } from 'playwright'

async function testSelection() {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.setViewportSize({ width: 1920, height: 1080 })

  console.log('🔐 Logging in...')
  await page.goto('http://localhost:3000/login')
  await page.fill('input[placeholder="you@example.com"]', 'lead@test.com')
  await page.fill('input[placeholder="••••••••"]', 'hashedpassword123')
  await page.click('button:has-text("Sign In")')
  await page.waitForURL('http://localhost:3000/dashboard')
  console.log('✓ Logged in')

  console.log('\n📄 Going to test-cases page...')
  await page.goto('http://localhost:3000/test-cases', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  // Wait for checkboxes to be rendered
  const checkboxLoaded = await page.waitForSelector('input[type="checkbox"]', { timeout: 10000 }).catch(() => null)
  if (!checkboxLoaded) {
    console.log('⚠️  Checkboxes not loaded, trying to reload...')
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)
  }

  console.log('📸 Screenshot 1: Initial page')
  await page.screenshot({ path: 'debug-1-initial.png', fullPage: true })

  // Count checkboxes
  const checkboxes = await page.locator('input[type="checkbox"]')
  const count = await checkboxes.count()
  console.log(`Found ${count} checkboxes`)

  if (count > 1) {
    console.log('\n🖱️  Clicking first checkbox...')
    await checkboxes.nth(1).click()
    await page.waitForTimeout(1000)

    console.log('📸 Screenshot 2: After selecting')
    await page.screenshot({ path: 'debug-2-selected.png', fullPage: true })

    // Check for selection bar
    const selectionBar = await page.locator('[class*="selected"], [data-testid*="selection"]').first()
    const isVisible = await selectionBar.isVisible().catch(() => false)
    console.log(`Selection bar visible: ${isVisible}`)

    // Check for Create Suite button
    const createBtn = await page.locator('button:has-text("Create Suite")')
    const createCount = await createBtn.count()
    console.log(`Create Suite buttons found: ${createCount}`)

    if (createCount > 0) {
      const isCreateVisible = await createBtn.first().isVisible()
      console.log(`Create Suite button visible: ${isCreateVisible}`)

      if (isCreateVisible) {
        console.log('✅ SUCCESS: Create Suite button is visible!')
      }
    } else {
      // Try to find what buttons ARE there
      const allButtons = await page.locator('button').allTextContents()
      console.log('All button texts:')
      allButtons.forEach((text, i) => {
        if (text.trim()) console.log(`  ${i}: "${text.trim()}"`)
      })
    }

    // Check localStorage/sessionStorage
    const storage = await page.evaluate(() => {
      return {
        sessionStorage: Object.fromEntries(
          Object.keys(sessionStorage).map(key => [key, sessionStorage.getItem(key)])
        ),
        localStorage: Object.fromEntries(
          Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])
        )
      }
    })

    console.log('\n💾 Storage contents:')
    console.log('sessionStorage:', JSON.stringify(storage.sessionStorage, null, 2))
    console.log('localStorage keys:', Object.keys(storage.localStorage).join(', '))
  }

  await browser.close()
}

testSelection().catch(console.error)
