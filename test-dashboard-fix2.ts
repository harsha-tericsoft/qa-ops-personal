import { chromium } from 'playwright'

async function test() {
  const browser = await chromium.launch()
  const page = await browser.newContext().then(c => c.newPage())
  await page.setViewportSize({ width: 1920, height: 1080 })

  console.log('\n✅ Testing Dashboard with Auto-Selected Project (Extended Wait)\n')

  // Login
  await page.goto('http://localhost:3000/login')
  await page.fill('input[placeholder="you@example.com"]', 'lead@test.com')
  await page.fill('input[placeholder="••••••••"]', 'hashedpassword123')
  await page.click('button:has-text("Sign In")')
  await page.waitForURL('http://localhost:3000/dashboard', { timeout: 15000 })

  // Wait longer for dashboard to fully load
  console.log('Waiting for dashboard to load...')
  await page.waitForTimeout(5000)

  // Check if still loading
  const isLoading = await page.locator('text=Loading').count()
  console.log(`Still loading: ${isLoading > 0 ? 'Yes' : 'No'}`)

  // Wait for main content to appear
  try {
    await page.waitForSelector('main', { timeout: 10000 })
    console.log('✅ Main content loaded')
  } catch (e) {
    console.log('❌ Main content timeout')
  }

  // Get text content
  const bodyText = await page.textContent('body')
  const lines = bodyText?.split('\n').filter(l => l.trim().length > 0) || []

  console.log('\nDashboard content (first 20 lines):')
  lines.slice(0, 20).forEach((line, i) => {
    console.log(`  ${line}`)
  })

  // Take screenshot
  await page.screenshot({ path: './dashboard-test2.png', fullPage: true })
  console.log('\n📸 Screenshot saved')

  await browser.close()
}

test().catch(console.error)
