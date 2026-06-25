import { chromium } from 'playwright'

async function test() {
  const browser = await chromium.launch()
  const page = await browser.newContext().then(c => c.newPage())
  await page.setViewportSize({ width: 1920, height: 1080 })

  try {
    console.log('\n✨ FINAL METRICS DASHBOARD TEST\n')

    // Go directly to dashboard
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)

    // Get all text on page
    const bodyText = await page.textContent('body')

    // Check for metric values from API response
    const checks = [
      { name: 'Total Tests', value: '2436', found: bodyText?.includes('2436') },
      { name: 'Manual Tests', value: '2373', found: bodyText?.includes('2373') },
      { name: 'Automated Tests', value: '63', found: bodyText?.includes('63') },
      { name: 'Draft Cycles', value: '5', found: bodyText?.includes('5') },
      { name: 'Coverage %', regex: /2\.6/, found: /2\.6/.test(bodyText || '') },
    ]

    console.log('🎯 Metrics Displayed:')
    checks.forEach(c => {
      const status = c.found ? '✅' : '❌'
      const val = 'value' in c ? c.value : 'regex'
      console.log(`   ${status} ${c.name} (${val})`)
    })

    // Screenshot
    await page.screenshot({ path: './final-dashboard.png', fullPage: true })
    console.log('\n📸 Screenshot saved\n')

  } catch (err) {
    console.error('ERROR:', err)
  } finally {
    await browser.close()
  }
}

test()
