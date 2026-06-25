import { chromium } from 'playwright'

async function test() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.setViewportSize({ width: 1920, height: 1080 })

  try {
    // Login
    await page.goto('http://localhost:3000/login')
    await page.fill('input[placeholder="you@example.com"]', 'lead@test.com')
    await page.fill('input[placeholder="••••••••"]', 'hashedpassword123')
    await page.click('button:has-text("Sign In")')
    await page.waitForURL('http://localhost:3000/dashboard')

    // Go to cycles
    await page.goto('http://localhost:3000/cycles')
    await page.waitForTimeout(3000)

    // Get page text
    const body = await page.textContent('body')
    
    console.log('\n📄 CYCLES PAGE CONTENT (first 2000 chars):\n')
    console.log(body?.substring(0, 2000))

  } catch (err) {
    console.error('ERROR:', err)
  } finally {
    await browser.close()
  }
}

test()
