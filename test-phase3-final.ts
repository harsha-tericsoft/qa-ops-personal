import { chromium } from 'playwright'

async function test() {
  const browser = await chromium.launch()
  const page = await browser.newContext().then(c => c.newPage())
  await page.setViewportSize({ width: 1920, height: 1080 })

  try {
    console.log('\n🚀 PHASE 3 FINAL TEST\n')

    // Go to dashboard
    await page.goto('http://localhost:3000/dashboard')

    // Wait for select elements to appear
    await page.waitForSelector('select', { timeout: 10000 })
    await page.waitForTimeout(2000)

    console.log('✅ Dashboard loaded')

    // Count selectors
    const selects = await page.locator('select').count()
    console.log(`📋 Selectors: ${selects} (expected 3)`)

    // Get content
    const body = await page.textContent('body')
    const checks = [
      { name: 'Total Tests metric', check: body?.includes('2436') },
      { name: 'Project & Execution header', check: body?.includes('Project & Execution') },
      { name: 'Execution Cycle label', check: body?.includes('Execution Cycle') },
      { name: 'Version label', check: body?.includes('Version') },
      { name: 'Execution Metrics header', check: body?.includes('Execution Metrics') },
    ]

    checks.forEach(c => {
      console.log(`${c.check ? '✅' : '❌'} ${c.name}`)
    })

    await page.screenshot({ path: './phase3-final.png', fullPage: true })
    console.log('\n📸 Screenshot saved\n')

  } catch (err) {
    console.error('ERROR:', err)
  } finally {
    await browser.close()
  }
}

test()
