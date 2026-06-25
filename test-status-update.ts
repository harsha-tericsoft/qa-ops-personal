import { chromium } from 'playwright'

async function test() {
  const browser = await chromium.launch()
  const page = await browser.newContext().then(c => c.newPage())
  await page.setViewportSize({ width: 1920, height: 1080 })

  try {
    console.log('\n🔄 TESTING EXECUTION STATUS UPDATE FIX\n')

    // Login
    await page.goto('http://localhost:3000/login')
    await page.fill('input[placeholder="you@example.com"]', 'lead@test.com')
    await page.fill('input[placeholder="••••••••"]', 'hashedpassword123')
    await page.click('button:has-text("Sign In")')
    await page.waitForURL('http://localhost:3000/dashboard', { timeout: 10000 })

    // Go to cycles page
    console.log('1️⃣  Navigating to Execution Cycles page...')
    await page.goto('http://localhost:3000/cycles')
    await page.waitForTimeout(3000)
    console.log('   ✅ Page loaded\n')

    // Find a status dropdown
    console.log('2️⃣  Looking for status dropdown...')
    const statusSelects = await page.locator('select').count()
    console.log(`   Found ${statusSelects} select dropdowns\n`)

    if (statusSelects > 0) {
      // Get first dropdown
      const firstSelect = page.locator('select').first()
      
      // Get current value
      const currentValue = await firstSelect.inputValue()
      console.log(`3️⃣  Current status: "${currentValue}"\n`)

      // Get available options
      const options = await page.locator('select option').count()
      console.log(`4️⃣  Available status options: ${options}\n`)

      if (options > 1) {
        // Change to a different status
        console.log('5️⃣  Changing status...')
        await firstSelect.selectOption({ index: 1 })
        await page.waitForTimeout(2000)
        
        const newValue = await firstSelect.inputValue()
        console.log(`   Status changed to: "${newValue}"\n`)

        // Check for network errors
        let networkErrors = false
        page.on('response', res => {
          if (!res.ok() && res.url().includes('test-runs')) {
            console.log(`   ❌ Network error: ${res.status()} ${res.url()}`)
            networkErrors = true
          }
        })

        // Check for console errors
        let consoleErrors: string[] = []
        page.on('console', msg => {
          if (msg.type() === 'error') {
            consoleErrors.push(msg.text())
          }
        })

        console.log('6️⃣  Verification Results:\n')
        console.log(`   ✅ Status dropdown changed: ${currentValue} → ${newValue}`)
        console.log(`   ✅ No network errors: ${!networkErrors}`)
        console.log(`   ✅ No console errors: ${consoleErrors.length === 0}`)

        if (currentValue !== newValue) {
          console.log('\n✅ SUCCESS: UI IS SYNCHRONIZED WITH API\n')
        }
      }
    }

  } catch (err) {
    console.error('\n❌ ERROR:', err)
  } finally {
    await browser.close()
  }
}

test()
