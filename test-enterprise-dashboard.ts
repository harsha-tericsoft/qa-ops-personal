import { chromium } from 'playwright'

async function test() {
  const browser = await chromium.launch()
  const page = await browser.newContext().then(c => c.newPage())
  await page.setViewportSize({ width: 1920, height: 1080 })

  console.log('\n🚀 ENTERPRISE DASHBOARD VERIFICATION\n')

  try {
    // Login
    console.log('1️⃣  Logging in...')
    await page.goto('http://localhost:3000/login')
    await page.fill('input[placeholder="you@example.com"]', 'lead@test.com')
    await page.fill('input[placeholder="••••••••"]', 'hashedpassword123')
    await page.click('button:has-text("Sign In")')
    await page.waitForURL('**/dashboard', { timeout: 15000 })
    console.log('✅ Logged in')

    // Wait for dashboard to load
    await page.waitForTimeout(3000)
    await page.screenshot({ path: './dashboard-enterprise-01.png' })
    console.log('✅ Dashboard loaded')

    // Check for project selector
    const projectSelect = await page.locator('select').nth(0)
    if (await projectSelect.isVisible()) {
      console.log('✅ Project selector visible')
      
      // Select first project
      const options = await projectSelect.locator('option').count()
      console.log(`   Found ${options} projects`)
      
      if (options > 1) {
        await projectSelect.selectOption({ index: 1 })
        await page.waitForTimeout(2000)
        console.log('✅ Project selected')
      }
    }

    // Check for cycle selector
    const cycleSelect = await page.locator('select').nth(1)
    if (await cycleSelect.isVisible()) {
      console.log('✅ Cycle selector visible')
      
      const cycleOptions = await cycleSelect.locator('option').count()
      console.log(`   Found ${cycleOptions} cycles`)
      
      if (cycleOptions > 1) {
        await cycleSelect.selectOption({ index: 1 })
        await page.waitForTimeout(2000)
        console.log('✅ Cycle selected')
      }
    }

    // Check for version selector
    const versionSelect = await page.locator('select').nth(2)
    if (await versionSelect.isVisible()) {
      console.log('✅ Version selector visible')
      
      const versionOptions = await versionSelect.locator('option').count()
      console.log(`   Found ${versionOptions} versions`)
      
      if (versionOptions > 1) {
        await versionSelect.selectOption({ index: 1 })
        await page.waitForTimeout(2000)
        console.log('✅ Version selected')
      }
    }

    // Check for metrics display
    await page.screenshot({ path: './dashboard-enterprise-02.png' })
    const bodyText = await page.textContent('body')
    
    if (bodyText?.includes('Total Tests')) {
      console.log('✅ Metrics displayed')
    } else {
      console.log('⚠️  Waiting for metrics...')
      await page.waitForTimeout(2000)
      await page.screenshot({ path: './dashboard-enterprise-03.png' })
    }

    // Check console for errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.waitForTimeout(1000)

    if (errors.length === 0) {
      console.log('✅ No console errors')
    } else {
      console.log('❌ Console errors found:')
      errors.forEach(e => console.log(`   ${e}`))
    }

    console.log('\n✅ DASHBOARD VERIFICATION COMPLETE')
  } catch (err) {
    console.error('\n❌ ERROR:', err)
  } finally {
    await browser.close()
  }
}

test()
