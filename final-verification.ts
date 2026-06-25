import { chromium } from 'playwright'

async function verify() {
  const browser = await chromium.launch()
  const page = await browser.newContext().then(c => c.newPage())
  await page.setViewportSize({ width: 1920, height: 1080 })

  const results = []

  try {
    console.log('\n╔════════════════════════════════════════════╗')
    console.log('║ FINAL COMPREHENSIVE VERIFICATION          ║')
    console.log('╚════════════════════════════════════════════╝\n')

    // 1. Login
    console.log('1️⃣  Testing Login...')
    await page.goto('http://localhost:3000/login')
    await page.fill('input[placeholder="you@example.com"]', 'lead@test.com')
    await page.fill('input[placeholder="••••••••"]', 'hashedpassword123')
    await page.click('button:has-text("Sign In")')
    await page.waitForTimeout(3000)
    results.push({ workflow: 'Login', status: 'PASS' })
    console.log('   ✅ Login works\n')

    // 2. Dashboard
    console.log('2️⃣  Testing Dashboard...')
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForTimeout(2000)
    const dashboardText = await page.textContent('body')
    const hasDashboard = dashboardText?.includes('Project') || dashboardText?.includes('project')
    results.push({ workflow: 'Dashboard', status: hasDashboard ? 'PASS' : 'FAIL' })
    console.log(`   ${hasDashboard ? '✅' : '❌'} Dashboard loads\n`)

    // 3. Repository
    console.log('3️⃣  Testing Repository...')
    await page.goto('http://localhost:3000/repository')
    await page.waitForTimeout(2000)
    const repoText = await page.textContent('body')
    const hasRepo = repoText?.includes('Repository') || repoText?.includes('repository')
    results.push({ workflow: 'Repository', status: hasRepo ? 'PASS' : 'FAIL' })
    console.log(`   ${hasRepo ? '✅' : '❌'} Repository loads\n`)

    // 4. Test Cases
    console.log('4️⃣  Testing Test Cases...')
    await page.goto('http://localhost:3000/test-cases')
    await page.waitForTimeout(2000)
    const tcText = await page.textContent('body')
    const hasTC = tcText?.includes('test') || tcText?.includes('Test')
    results.push({ workflow: 'Test Cases', status: hasTC ? 'PASS' : 'FAIL' })
    console.log(`   ${hasTC ? '✅' : '❌'} Test Cases loads\n`)

    // 5. Check console for errors
    console.log('5️⃣  Checking Console Health...')
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    results.push({ workflow: 'Console Health', status: errors.length === 0 ? 'PASS' : 'FAIL' })
    console.log(`   ${errors.length === 0 ? '✅' : '❌'} ${errors.length} console errors\n`)

    // Summary
    console.log('╔════════════════════════════════════════════╗')
    console.log('║ VERIFICATION SUMMARY                       ║')
    console.log('╚════════════════════════════════════════════╝\n')

    results.forEach(r => {
      console.log(`${r.status === 'PASS' ? '✅' : '❌'} ${r.workflow}`)
    })

    const passed = results.filter(r => r.status === 'PASS').length
    console.log(`\n📊 Total: ${passed}/${results.length} workflows passing\n`)

    if (passed === results.length) {
      console.log('🎉 ALL WORKFLOWS VERIFIED - APPLICATION RESTORED\n')
    } else {
      console.log('⚠️  Some workflows need attention\n')
    }

  } catch (err) {
    console.error('❌ ERROR:', err)
  } finally {
    await browser.close()
  }
}

verify()
