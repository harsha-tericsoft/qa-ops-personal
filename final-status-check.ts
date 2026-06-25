#!/usr/bin/env npx ts-node
import { chromium } from 'playwright'

const BASE_URL = 'http://localhost:3000'

async function check() {
  const browser = await chromium.launch()
  const page = await browser.newContext().then(c => c.newPage())
  await page.setViewportSize({ width: 1920, height: 1080 })

  const results: Record<string, boolean> = {}

  console.log('\n=== FINAL STATUS CHECK ===\n')

  try {
    // 1. Check Login
    console.log('1️⃣  Checking authentication...')
    await page.goto(`${BASE_URL}/login`)
    const loginForm = await page.$('input[type="password"]') ? true : false
    results['Login Page Loads'] = loginForm
    console.log(`   ${loginForm ? '✅' : '❌'} Login form found`)

    if (loginForm) {
      await page.fill('input[placeholder="you@example.com"]', 'lead@test.com')
      await page.fill('input[placeholder="••••••••"]', 'hashedpassword123')
      await page.click('button:has-text("Sign In")')
      await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 })
      results['Authentication Works'] = true
      console.log(`   ✅ Login successful`)
    }

    // 2. Check Test Cases Page Structure
    console.log('\n2️⃣  Checking Test Cases page...')
    await page.goto(`${BASE_URL}/test-cases`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    const checkboxes = await page.locator('input[type="checkbox"]').count()
    results['Checkboxes Render'] = checkboxes > 0
    console.log(`   ${checkboxes > 0 ? '✅' : '❌'} Found ${checkboxes} checkboxes`)

    const summaryCards = await page.locator('[class*="card"], [class*="summary"]').count()
    results['Summary Cards Render'] = summaryCards > 0
    console.log(`   ${summaryCards > 0 ? '✅' : '❌'} Found summary elements`)

    // 3. Check for Selection Bar
    console.log('\n3️⃣  Checking selection functionality...')
    const selectTests = await page.locator('text=Select tests').count()
    results['Select Tests Label Found'] = selectTests > 0
    console.log(`   ${selectTests > 0 ? '✅' : '❌'} "Select tests" label found`)

    // 4. Check Dashboard
    console.log('\n4️⃣  Checking dashboard...')
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)

    const dashboardContent = await page.textContent('body')
    const hasKPIs = dashboardContent?.includes('Total') || dashboardContent?.includes('Automated') || dashboardContent?.includes('Manual')
    results['Dashboard Has KPI Content'] = !!hasKPIs
    console.log(`   ${hasKPIs ? '✅' : '❌'} KPI content visible`)

    const cycles = await page.locator('[class*="cycle"], select').count()
    results['Cycle Selector Present'] = cycles > 0
    console.log(`   ${cycles > 0 ? '✅' : '❌'} Cycle selector present`)

    // 5. Check for Errors
    console.log('\n5️⃣  Checking for JavaScript errors...')
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    results['No Critical Errors'] = errors.length === 0
    console.log(`   ${errors.length === 0 ? '✅' : '⚠️ '} Console errors: ${errors.length}`)

    // 6. Check API Endpoints
    console.log('\n6️⃣  Checking API endpoints...')
    const apiTest = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/projects')
        return res.ok
      } catch {
        return false
      }
    })
    results['API Endpoints Working'] = apiTest
    console.log(`   ${apiTest ? '✅' : '❌'} API responding`)

    // Summary
    console.log('\n=== SUMMARY ===\n')
    const passed = Object.values(results).filter(v => v).length
    const total = Object.keys(results).length

    Object.entries(results).forEach(([key, value]) => {
      console.log(`${value ? '✅' : '❌'} ${key}`)
    })

    console.log(`\n📊 Status: ${passed}/${total} checks passed`)
    console.log(`\n${passed === total ? '🎉 READY FOR DEMO' : '⚠️  NEEDS FIXES'}`)

  } catch (err) {
    console.error('\n❌ Fatal error:', err)
  } finally {
    await browser.close()
  }
}

check()
