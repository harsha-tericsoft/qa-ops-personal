import { chromium } from 'playwright'

async function test() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.setViewportSize({ width: 1920, height: 1080 })

  try {
    console.log('\n🔄 STATUS UPDATE TEST (WITH PROPER WAITS)\n')

    // Login
    console.log('Step 1: Login...')
    await page.goto('http://localhost:3000/login')
    await page.fill('input[placeholder="you@example.com"]', 'lead@test.com')
    await page.fill('input[placeholder="••••••••"]', 'hashedpassword123')
    await page.click('button:has-text("Sign In")')
    await page.waitForURL('http://localhost:3000/dashboard')
    console.log('✅ Logged in\n')

    // Go to cycles
    console.log('Step 2: Go to Cycles page...')
    await page.goto('http://localhost:3000/cycles')
    
    // Wait for the "Loading execution cycles..." message to disappear
    console.log('Step 3: Waiting for cycles to load...')
    await page.waitForFunction(() => {
      const text = document.body.innerText
      return !text.includes('Loading execution cycles')
    }, { timeout: 10000 })
    await page.waitForTimeout(2000)
    console.log('✅ Cycles loaded\n')

    // Check what cycles are available
    const cycleText = await page.textContent('body')
    const hasCycles = cycleText?.includes('View') || cycleText?.includes('Cycle')
    console.log(`Has cycles: ${hasCycles}\n`)

    if (hasCycles) {
      // Get all buttons that might lead to cycles
      const buttons = await page.locator('button').allTextContents()
      console.log('Available buttons:')
      buttons.forEach((b, i) => console.log(`  ${i+1}. ${b}`))
    }

  } catch (err) {
    console.error('\n❌ ERROR:', err)
  } finally {
    await browser.close()
  }
}

test()
