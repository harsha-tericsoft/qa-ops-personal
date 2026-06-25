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
    console.log('\n╔════════════════════════════════════════╗')
    console.log('║  FRONTEND STATE SYNCHRONIZATION TEST   ║')
    console.log('╚════════════════════════════════════════╝\n')

    // Login
    console.log('1️⃣  LOGIN')
    await page.goto('http://localhost:3000/login')
    await page.fill('input[placeholder="you@example.com"]', 'lead@test.com')
    await page.fill('input[placeholder="••••••••"]', 'hashedpassword123')
    await page.click('button:has-text("Sign In")')
    await page.waitForURL('http://localhost:3000/dashboard')
    console.log('✅ Authenticated\n')

    // Go to cycles
    console.log('2️⃣  NAVIGATE TO CYCLES')
    await page.goto('http://localhost:3000/cycles')
    await page.waitForFunction(() => !document.body.innerText.includes('Loading'), { timeout: 10000 })
    await page.waitForTimeout(1000)
    console.log('✅ Cycles page loaded\n')

    // Click first cycle (the one with "execution cycle" text)
    console.log('3️⃣  SELECT CYCLE')
    const cycleButtons = page.locator('button:has-text("execution cycle")')
    const count = await cycleButtons.count()
    
    if (count > 0) {
      await cycleButtons.first().click()
      await page.waitForTimeout(2000)
      console.log('✅ Cycle selected\n')

      // Select a version
      console.log('4️⃣  SELECT VERSION')
      const versionSelect = page.locator('select').first()
      const options = await versionSelect.locator('option').count()
      console.log(`   Found ${options} versions`)
      
      if (options > 1) {
        const beforeValue = await versionSelect.inputValue()
        await versionSelect.selectOption({ index: 1 })
        await page.waitForTimeout(2000)
        const afterValue = await versionSelect.inputValue()
        console.log(`   Version: ${beforeValue} → ${afterValue}`)
        console.log('✅ Version selected\n')

        // Find test run status dropdown
        console.log('5️⃣  FIND TEST RUN STATUS DROPDOWN')
        const statusSelects = page.locator('select:has(option[value="PASS"])')
        const statusCount = await statusSelects.count()
        console.log(`   Found ${statusCount} test run dropdowns\n`)

        if (statusCount > 0) {
          const statusSelect = statusSelects.first()
          const currentStatus = await statusSelect.inputValue()
          
          console.log('6️⃣  CHANGE TEST RUN STATUS')
          console.log(`   Current status: ${currentStatus}`)

          patchRequests = 0
          const newStatus = currentStatus === 'PASS' ? 'FAIL' : 'PASS'
          await statusSelect.selectOption(newStatus)
          await page.waitForTimeout(2000)

          const updatedStatus = await statusSelect.inputValue()
          console.log(`   New status: ${updatedStatus}\n`)

          console.log('7️⃣  VERIFICATION')
          console.log(`   ✅ UI updated: ${currentStatus} → ${updatedStatus}`)
          console.log(`   ✅ PATCH requests: ${patchRequests}`)
          console.log(`   ✅ PATCH success: ${patchSuccess}`)
          console.log(`   ✅ Status matches: ${updatedStatus === newStatus}`)

          if (updatedStatus === newStatus && patchSuccess && patchRequests > 0) {
            console.log('\n✅✅✅ FRONTEND STATE SYNCHRONIZED ✅✅✅\n')
          } else {
            console.log('\n⚠️  Issue detected\n')
          }
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
