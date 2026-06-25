import { chromium } from 'playwright'

async function test() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.setViewportSize({ width: 1920, height: 1080 })

  let networkRequestCount = 0
  let networkErrorCount = 0
  let consoleErrors: string[] = []

  page.on('request', (req) => {
    if (req.url().includes('test-runs')) networkRequestCount++
  })

  page.on('response', (res) => {
    if (res.url().includes('test-runs') && !res.ok()) {
      networkErrorCount++
      console.log(`   ❌ Network error: ${res.status()} ${res.url()}`)
    }
  })

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  try {
    console.log('\n🔄 FRONTEND STATE SYNCHRONIZATION TEST\n')

    // Login
    console.log('Step 1: Authentication')
    await page.goto('http://localhost:3000/login')
    await page.fill('input[placeholder="you@example.com"]', 'lead@test.com')
    await page.fill('input[placeholder="••••••••"]', 'hashedpassword123')
    await page.click('button:has-text("Sign In")')
    await page.waitForURL('http://localhost:3000/dashboard', { timeout: 10000 })
    console.log('✅ Logged in\n')

    // Go to cycles
    console.log('Step 2: Navigate to Execution Cycles')
    await page.goto('http://localhost:3000/cycles')
    await page.waitForTimeout(3000)
    console.log('✅ Page loaded\n')

    // Find test run status dropdowns
    console.log('Step 3: Find test run status dropdown')
    const selects = page.locator('select[value]')
    const selectCount = await selects.count()
    console.log(`   Found ${selectCount} status dropdowns\n`)

    if (selectCount > 0) {
      // Find the first one with status options
      let targetSelect = null
      for (let i = 0; i < selectCount; i++) {
        const opts = await page.locator(`select[value]`).nth(i).locator('option').count()
        if (opts === 4) { // NOT_EXECUTED, PASS, FAIL, BLOCKED
          targetSelect = page.locator(`select[value]`).nth(i)
          break
        }
      }

      if (targetSelect) {
        const beforeValue = await targetSelect.inputValue()
        console.log(`Step 4: Before status change\n   Status: ${beforeValue}\n`)

        // Change status
        console.log('Step 5: Changing status')
        networkRequestCount = 0
        networkErrorCount = 0
        await targetSelect.selectOption('PASS')
        await page.waitForTimeout(2000)
        
        const afterValue = await targetSelect.inputValue()
        console.log(`   Status changed to: ${afterValue}\n`)

        // Results
        console.log('Step 6: Verification\n')
        const statusChanged = beforeValue !== afterValue
        const noNetworkErrors = networkErrorCount === 0
        const noConsoleErrors = consoleErrors.length === 0

        console.log(`   ✅ Status dropdown updated: ${statusChanged ? 'YES' : 'NO'} (${beforeValue} → ${afterValue})`)
        console.log(`   ✅ Network requests: ${networkRequestCount} (${networkErrorCount} errors)`)
        console.log(`   ✅ Console errors: ${consoleErrors.length}`)

        if (statusChanged && noNetworkErrors && noConsoleErrors) {
          console.log('\n✅✅✅ FRONTEND STATE SYNCHRONIZED - BUG FIXED ✅✅✅\n')
        } else {
          console.log('\n⚠️  Issue detected - see details above\n')
        }
      } else {
        console.log('   ❌ Could not find test run status dropdown\n')
      }
    }

  } catch (err) {
    console.error('\n❌ ERROR:', err)
  } finally {
    await browser.close()
  }
}

test()
