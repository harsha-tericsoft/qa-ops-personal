import { chromium } from 'playwright'

async function test() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  try {
    // Login
    await page.goto('http://localhost:3000/login')
    await page.fill('input[placeholder="you@example.com"]', 'lead@test.com')
    await page.fill('input[placeholder="••••••••"]', 'hashedpassword123')
    await page.click('button:has-text("Sign In")')
    await page.waitForURL('http://localhost:3000/dashboard')

    // Go to cycles
    await page.goto('http://localhost:3000/cycles')
    await page.waitForFunction(() => !document.body.innerText.includes('Loading'), { timeout: 10000 })

    // Click first cycle
    const cycleButtons = page.locator('button:has-text("execution cycle")')
    await cycleButtons.first().click()
    await page.waitForTimeout(2000)

    // Try to select version by index
    const versionSelect = page.locator('select').first()
    await versionSelect.selectOption({ index: 2 })
    await page.waitForTimeout(2000)

    // Get page content
    const body = await page.textContent('body')
    console.log('\n📄 PAGE AFTER VERSION SELECTION (first 1500 chars):\n')
    const lines = body?.split('\n') || []
    lines.slice(0, 50).forEach(line => console.log(line))

  } catch (err) {
    console.error('ERROR:', err)
  } finally {
    await browser.close()
  }
}

test()
