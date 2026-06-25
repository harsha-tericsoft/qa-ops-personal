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

    // Check page content
    const body = await page.textContent('body')
    console.log('\n📄 PAGE CONTENT ANALYSIS\n')

    const hasExecutionCycles = body?.includes('Execution Cycles')
    const hasVersionDropdown = await page.locator('select').count() > 0
    const hasSelect = await page.locator('select').count()
    const hasButton = await page.locator('button').count()

    console.log(`Has "Execution Cycles": ${hasExecutionCycles}`)
    console.log(`Total selects on page: ${hasSelect}`)
    console.log(`Total buttons on page: ${hasButton}`)

    // List all selects
    if (hasSelect > 0) {
      console.log('\n📋 SELECT ELEMENTS:\n')
      const selects = await page.locator('select')
      for (let i = 0; i < Math.min(5, hasSelect); i++) {
        const opts = await selects.nth(i).locator('option').count()
        const firstOpt = await selects.nth(i).locator('option').first().textContent()
        console.log(`   ${i+1}. Options: ${opts}, First option: ${firstOpt}`)
      }
    }

    // Look for buttons
    console.log('\n🔘 BUTTONS:\n')
    const buttons = await page.locator('button').allTextContents()
    buttons.slice(0, 10).forEach((btn, i) => {
      console.log(`   ${i+1}. ${btn}`)
    })

  } catch (err) {
    console.error('ERROR:', err)
  } finally {
    await browser.close()
  }
}

test()
