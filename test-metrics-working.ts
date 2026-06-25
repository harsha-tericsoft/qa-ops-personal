import { chromium } from 'playwright'

async function test() {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.setViewportSize({ width: 1920, height: 1080 })

  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  try {
    console.log('\n🎯 PHASE 2: PROJECT DASHBOARD WITH METRICS\n')

    // Login
    await page.goto('http://localhost:3000/login')
    await page.fill('input[placeholder="you@example.com"]', 'lead@test.com')
    await page.fill('input[placeholder="••••••••"]', 'hashedpassword123')
    await page.click('button:has-text("Sign In")')
    await page.waitForTimeout(3000)

    // Wait for metrics to load
    await page.waitForTimeout(2000)

    // Check for metric cards
    const totalTestsCard = await page.locator('text=Total Tests').isVisible()
    const manualCard = await page.locator('text=Manual Tests').isVisible()
    const automatedCard = await page.locator('text=Automated Tests').isVisible()
    const coverageCard = await page.locator('text=Automation Coverage').isVisible()

    console.log('📊 Metric Cards:')
    console.log(`   ${totalTestsCard ? '✅' : '❌'} Total Tests`)
    console.log(`   ${manualCard ? '✅' : '❌'} Manual Tests`)
    console.log(`   ${automatedCard ? '✅' : '❌'} Automated Tests`)
    console.log(`   ${coverageCard ? '✅' : '❌'} Coverage %`)

    // Check cycle cards
    const draftCard = await page.locator('text=Draft Cycles').isVisible()
    const activeCard = await page.locator('text=Active Cycles').isVisible()
    const completedCard = await page.locator('text=Completed Cycles').isVisible()

    console.log('\n🔄 Execution Cycles:')
    console.log(`   ${draftCard ? '✅' : '❌'} Draft Cycles`)
    console.log(`   ${activeCard ? '✅' : '❌'} Active Cycles`)
    console.log(`   ${completedCard ? '✅' : '❌'} Completed Cycles`)

    // Check tags section
    const tagsSection = await page.locator('text=Test Tags').isVisible().catch(() => false)
    console.log(`\n🏷️  Tags Section: ${tagsSection ? '✅' : '⚠️  (No tags in this project)'}`)

    // Check for actual metric values
    const bodyText = await page.textContent('body')
    const hasNumbers = /\d{2,}/.test(bodyText || '')
    console.log(`\n📈 Metric Values: ${hasNumbers ? '✅ Displaying' : '⚠️  Loading'}`)

    // Check errors
    console.log(`\n❌ Errors: ${errors.length === 0 ? '✅ None' : errors.length}`)
    errors.forEach((e, i) => console.log(`   ${i+1}. ${e}`))

    // Screenshot
    await page.screenshot({ path: './dashboard-with-metrics.png', fullPage: true })
    console.log('\n📸 Screenshot saved\n')

  } catch (err) {
    console.error('\n❌ ERROR:', err)
  } finally {
    await browser.close()
  }
}

test()
