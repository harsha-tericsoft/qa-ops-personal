import { chromium } from 'playwright'

async function debugAPIEndpoint() {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  console.log('🔐 Logging in...')
  await page.goto('http://localhost:3000/login')
  await page.fill('input[placeholder="you@example.com"]', 'lead@test.com')
  await page.fill('input[placeholder="••••••••"]', 'hashedpassword123')
  await page.click('button:has-text("Sign In")')
  await page.waitForURL('http://localhost:3000/dashboard')
  await page.goto('http://localhost:3000/test-cases')
  await page.waitForTimeout(2000)

  // Get the project ID from the page
  const projectId = await page.evaluate(() => {
    // Check if we can get projectId from the page state or URL
    const url = new URL(window.location.href)
    const params = Object.fromEntries(url.searchParams.entries())
    return params.projectId || 'unknown'
  })

  console.log('\n🧪 Testing API endpoint...')
  console.log(`Project ID: ${projectId}`)

  // Test the API directly
  const testResults = await page.evaluate(async () => {
    const results: Record<string, any> = {}

    // Test 1: Simple call without filters
    try {
      console.log('[API_TEST] Calling /api/test-cases/all-filtered-ids...')
      const response = await fetch('/api/test-cases/all-filtered-ids?projectId=cmqsa0ry402m67k1cl468rjjg')
      console.log('[API_TEST] Response status:', response.status)
      const data = await response.json()
      console.log('[API_TEST] Response data:', data)
      results.simple = { status: response.status, data }
    } catch (err: any) {
      console.log('[API_TEST] Error:', err.message)
      results.simple = { error: err.message }
    }

    return results
  })

  console.log('\nTest results:', testResults)
  await browser.close()
}

debugAPIEndpoint().catch(console.error)
