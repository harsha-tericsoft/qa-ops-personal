import { chromium } from 'playwright'

async function test() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.setViewportSize({ width: 1920, height: 1080 })

  let patchRequests = 0
  let patchSuccess = false

  page.on('response', (res) => {
    if (res.url().includes('/api/test-runs/') && res.request().method() === 'PATCH') {
      patchRequests++
      patchSuccess = res.ok()
    }
  })

  try {
    console.log('\n🔄 COMPLETE STATUS UPDATE FLOW TEST\n')

    // 1. Login
    console.log('STEP 1: Authentication')
    await page.goto('http://localhost:3000/login')
    await page.fill('input[placeholder="you@example.com"]', 'lead@test.com')
    await page.fill('input[placeholder="••••••••"]', 'hashedpassword123')
    await page.click('button:has-text("Sign In")')
    await page.waitForURL('http://localhost:3000/dashboard')
    console.log('✅ Logged in\n')

    // 2. Go to cycles
    console.log('STEP 2: Navigate to Execution Cycles')
    await page.goto('http://localhost:3000/cycles')
    await page.waitForTimeout(3000)
    console.log('✅ Page loaded\n')

    // 3. Find and click first cycle
    console.log('STEP 3: Select Execution Cycle')
    const cycleButtons = page.locator('button:has-text("View")')
    const cycleCount = await cycleButtons.count()
    console.log(`   Found ${cycleCount} cycles`)
    
    if (cycleCount > 0) {
      await cycleButtons.first().click()
      await page.waitForTimeout(2000)
      console.log('   ✅ Cycle selected\n')

      // 4. Find and select first version
      console.log('STEP 4: Select Version')
      const versionSelect = page.locator('select').first()
      const versionOptions = await versionSelect.locator('option').count()
      console.log(`   Found ${versionOptions} versions`)

      if (versionOptions > 1) {
        // Select second option if available
        await versionSelect.selectOption({ index: 1 })
        await page.waitForTimeout(2000)
        console.log('   ✅ Version selected\n')

        // 5. Find test run status dropdown
        console.log('STEP 5: Find Test Run Status Dropdown')
        const statusSelects = page.locator('select:has(option[value="PASS"])')
        const statusCount = await statusSelects.count()
        console.log(`   Found ${statusCount} test run status dropdowns\n`)

        if (statusCount > 0) {
          // 6. Get current status
          const statusSelect = statusSelects.first()
          const beforeStatus = await statusSelect.inputValue()
          console.log(`STEP 6: Change Status`)
          console.log(`   Before: ${beforeStatus}`)

          // 7. Change status
          patchRequests = 0
          const newStatus = beforeStatus === 'PASS' ? 'FAIL' : 'PASS'
          await statusSelect.selectOption(newStatus)
          await page.waitForTimeout(2000)

          const afterStatus = await statusSelect.inputValue()
          console.log(`   After: ${afterStatus}\n`)

          // 8. Verify
          console.log('STEP 7: Verification')
          console.log(`   ✅ Status in dropdown: ${beforeStatus} → ${afterStatus}`)
          console.log(`   ✅ PATCH requests: ${patchRequests}`)
          console.log(`   ✅ PATCH success: ${patchSuccess}`)

          const statusMatches = afterStatus === newStatus
          console.log(`\n${statusMatches && patchSuccess ? '✅✅✅' : '❌'} UI SYNCHRONIZED WITH API\n`)
        } else {
          console.log('⚠️  No test run status dropdowns found\n')
        }
      } else {
        console.log('⚠️  No versions available\n')
      }
    } else {
      console.log('⚠️  No cycles found\n')
    }

  } catch (err) {
    console.error('\n❌ ERROR:', err)
  } finally {
    await browser.close()
  }
}

test()
