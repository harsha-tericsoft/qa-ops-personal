import { chromium } from 'playwright'

async function debugNetworkIssues() {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.setViewportSize({ width: 1920, height: 1080 })

  // Capture network responses
  const responses: { status: number; url: string; error?: string }[] = []
  page.on('response', (resp) => {
    if (resp.url().includes('test-cases') || resp.url().includes('api')) {
      const url = new URL(resp.url())
      responses.push({
        status: resp.status(),
        url: `${url.pathname}${url.search}`,
      })
    }
  })

  page.on('requestfailed', (req) => {
    if (req.url().includes('test-cases') || req.url().includes('api')) {
      responses.push({
        status: 0,
        url: req.url(),
        error: 'Failed',
      })
    }
  })

  console.log('🔐 Logging in...')
  await page.goto('http://localhost:3000/login')
  await page.fill('input[placeholder="you@example.com"]', 'lead@test.com')
  await page.fill('input[placeholder="••••••••"]', 'hashedpassword123')
  await page.click('button:has-text("Sign In")')
  await page.waitForURL('http://localhost:3000/dashboard')
  console.log('✓ Logged in\n')

  // Clear responses from login
  responses.length = 0

  console.log('📄 Going to test-cases...')
  await page.goto('http://localhost:3000/test-cases', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  console.log('✓ Initial page load complete')
  console.log(`  Responses during page load: ${responses.length}`)
  responses.forEach((r) => {
    console.log(`    - ${r.status} ${r.url}`)
  })

  // Clear responses
  responses.length = 0

  const checkboxes = await page.locator('input[type="checkbox"]')
  const count = await checkboxes.count()

  if (count > 0) {
    console.log(`\n🖱️  Clicking "Select All" checkbox (first of ${count} checkboxes)...`)
    await checkboxes.first().click()
    await page.waitForTimeout(3000)

    console.log(`✓ Click completed`)
    console.log(`  API Responses after click: ${responses.length}`)
    responses.forEach((r) => {
      console.log(`    - ${r.status} ${r.url} ${r.error || ''}`)
    })

    // Try to manually call the API to test it
    console.log('\n🧪 Testing /api/test-cases/all-filtered-ids endpoint...')
    const testResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/test-cases/all-filtered-ids?projectId=test')
        const data = await response.json()
        return { status: response.status, data }
      } catch (err: any) {
        return { error: err.message }
      }
    })
    console.log(`  Result: ${JSON.stringify(testResponse)}`)

    // Screenshot
    await page.screenshot({ path: 'debug-network-state.png', fullPage: true })
    console.log('\n  📸 Screenshot saved: debug-network-state.png')
  }

  await browser.close()
}

debugNetworkIssues().catch(console.error)
