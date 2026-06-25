import { chromium } from 'playwright'

async function test() {
  const browser = await chromium.launch()
  const page = await browser.newContext().then(c => c.newPage())
  await page.setViewportSize({ width: 1920, height: 1080 })

  console.log('\n✅ Testing Dashboard with Auto-Selected Project\n')

  // Login
  await page.goto('http://localhost:3000/login')
  await page.fill('input[placeholder="you@example.com"]', 'lead@test.com')
  await page.fill('input[placeholder="••••••••"]', 'hashedpassword123')
  await page.click('button:has-text("Sign In")')
  await page.waitForURL('http://localhost:3000/dashboard', { timeout: 15000 })

  // Wait for dashboard to load
  await page.waitForTimeout(3000)

  // Check for KPI elements
  const totalTests = await page.locator('text=Total Tests').count()
  const manual = await page.locator('text=Manual').count()
  const automated = await page.locator('text=Automated').count()

  console.log(`Total Tests label: ${totalTests > 0 ? '✅' : '❌'}`)
  console.log(`Manual Tests label: ${manual > 0 ? '✅' : '❌'}`)
  console.log(`Automated Tests label: ${automated > 0 ? '✅' : '❌'}`)

  // Take screenshot
  await page.screenshot({ path: './dashboard-test.png', fullPage: true })
  console.log('📸 Screenshot saved to dashboard-test.png')

  // Get page content
  const dashboardContent = await page.textContent('body')
  if (dashboardContent?.includes('Project Test Kinergy')) {
    console.log('✅ Project auto-selected: Project Test Kinergy')
  }

  if (dashboardContent?.includes('2436')) {
    console.log('✅ Test count displayed: 2436')
  }

  await browser.close()
  console.log('\n✅ Test complete')
}

test().catch(console.error)
