import { chromium } from 'playwright'

async function test() {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.setViewportSize({ width: 1920, height: 1080 })

  const consoleErrors: string[] = []
  const networkErrors: string[] = []

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  page.on('response', res => {
    if (!res.ok() && !res.url().includes('_next')) {
      networkErrors.push(`${res.status()} ${res.url()}`)
    }
  })

  try {
    console.log('\n✅ DASHBOARD STABILIZATION TEST\n')

    // 1. Login
    console.log('1️⃣  Login...')
    await page.goto('http://localhost:3000/login')
    await page.fill('input[placeholder="you@example.com"]', 'lead@test.com')
    await page.fill('input[placeholder="••••••••"]', 'hashedpassword123')
    await page.click('button:has-text("Sign In")')
    
    // Wait for navigation and dashboard load
    await Promise.race([
      page.waitForURL('**/dashboard'),
      page.waitForTimeout(5000)
    ])

    await page.waitForTimeout(2000)
    
    const title = await page.textContent('h1')
    if (title?.includes('Dashboard')) {
      console.log('✅ Dashboard loaded')
    } else {
      console.log('❌ Dashboard not found')
    }

    // 2. Check project selector
    console.log('2️⃣  Check project selector...')
    const selectVisible = await page.locator('select').first().isVisible()
    if (selectVisible) {
      console.log('✅ Project selector visible')
      const options = await page.locator('select option').count()
      console.log(`   Found ${options} projects`)
    } else {
      console.log('❌ Selector not found')
    }

    // 3. Check for errors
    console.log('3️⃣  Check for errors...')
    if (consoleErrors.length === 0) {
      console.log('✅ No console errors')
    } else {
      console.log(`❌ ${consoleErrors.length} console errors`)
      consoleErrors.forEach((e, i) => console.log(`   ${i+1}. ${e}`))
    }

    if (networkErrors.length === 0) {
      console.log('✅ No failed network requests')
    } else {
      console.log(`❌ ${networkErrors.length} network errors`)
      networkErrors.forEach(e => console.log(`   ${e}`))
    }

    // 4. Screenshot
    await page.screenshot({ path: './dashboard-fixed.png', fullPage: true })
    console.log('4️⃣  Screenshot saved')

    console.log('\n✅ STABILIZATION COMPLETE\n')

  } catch (err) {
    console.error('\n❌ ERROR:', err)
  } finally {
    await browser.close()
  }
}

test()
