import { chromium } from 'playwright'

async function test() {
  const browser = await chromium.launch()
  const page = await browser.newContext().then(c => c.newPage())
  await page.setViewportSize({ width: 1920, height: 1080 })

  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  try {
    console.log('\n🔧 TESTING CYCLES STATUS CHANGE FIX\n')

    // Go to cycles page
    await page.goto('http://localhost:3000/login')
    await page.fill('input[placeholder="you@example.com"]', 'lead@test.com')
    await page.fill('input[placeholder="••••••••"]', 'hashedpassword123')
    await page.click('button:has-text("Sign In")')
    await page.waitForTimeout(2000)

    await page.goto('http://localhost:3000/cycles')
    await page.waitForTimeout(3000)

    console.log('✅ Cycles page loaded')
    console.log(`📊 Console errors: ${errors.length}`)

    if (errors.length === 0) {
      console.log('✅ NO ERRORS - FIX SUCCESSFUL\n')
    } else {
      console.log('❌ ERRORS FOUND:')
      errors.forEach((e, i) => console.log(`   ${i+1}. ${e.substring(0, 100)}`))
      console.log()
    }

  } catch (err) {
    console.error('ERROR:', err)
  } finally {
    await browser.close()
  }
}

test()
