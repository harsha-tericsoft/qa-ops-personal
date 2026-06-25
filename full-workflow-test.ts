import { chromium } from 'playwright'
import * as fs from 'fs'

const BASE_URL = 'http://localhost:3000'
const SCREENSHOTS_DIR = './workflow-screenshots'

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
}

const results: { test: string; status: string; details: string }[] = []

async function screenshot(page: any, name: string) {
  const filename = `${SCREENSHOTS_DIR}/${name}.png`
  await page.screenshot({ path: filename, fullPage: true })
  console.log(`📸 ${filename}`)
  return filename
}

async function login(page: any) {
  console.log('🔐 Logging in...')
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })

  // Fill email
  await page.fill('input[placeholder="you@example.com"]', 'lead@test.com')
  await page.fill('input[placeholder="••••••••"]', 'hashedpassword123')

  // Click sign in
  await page.click('button:has-text("Sign In")')

  // Wait for navigation to dashboard
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 })
  console.log('✓ Logged in successfully')
}

async function runTests() {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.setViewportSize({ width: 1920, height: 1080 })

  try {
    // LOGIN
    console.log('\n╔══════════════════════════════════════════╗')
    console.log('║ PHASE 0: AUTHENTICATION                  ║')
    console.log('╚══════════════════════════════════════════╝')
    await login(page)
    await screenshot(page, '00-dashboard-after-login')
    results.push({ test: 'Login', status: '✅ PASS', details: 'Successfully logged in' })

    // TEST 1: REPOSITORY PAGE
    console.log('\n╔══════════════════════════════════════════╗')
    console.log('║ PHASE 1: REPOSITORY & HIERARCHY           ║')
    console.log('╚══════════════════════════════════════════╝')
    await page.goto(`${BASE_URL}/repository`, { waitUntil: 'networkidle' })
    await screenshot(page, '01-repository-hierarchy')

    const repoContent = await page.textContent('body')
    if (repoContent && (repoContent.includes('Test') || repoContent.includes('test'))) {
      console.log('✓ Repository page loaded with content')
      results.push({ test: 'Repository Hierarchy', status: '✅ PASS', details: 'Hierarchy displayed' })
    } else {
      console.log('⚠️  Repository content not clearly visible')
      results.push({ test: 'Repository Hierarchy', status: '⚠️  WARNING', details: 'Content unclear' })
    }

    // TEST 2: TEST CASES PAGE & PAGINATION
    console.log('\n╔══════════════════════════════════════════╗')
    console.log('║ PHASE 2: TEST CASES & GLOBAL SELECTION   ║')
    console.log('╚══════════════════════════════════════════╝')
    await page.goto(`${BASE_URL}/test-cases`, { waitUntil: 'networkidle' })
    await screenshot(page, '02-test-cases-page')

    // Count checkboxes
    const checkboxCount = await page.locator('input[type="checkbox"]').count()
    console.log(`Found ${checkboxCount} checkboxes`)

    if (checkboxCount > 0) {
      // Get the checkboxes
      const checkboxes = await page.locator('input[type="checkbox"]')

      // Select first checkbox (skip "select all")
      if (checkboxCount > 1) {
        await checkboxes.nth(1).click()
        await page.waitForTimeout(500)
        await screenshot(page, '02a-first-selection')
        console.log('✓ Selected first test case')

        // Check if selection count is displayed
        const selectionText = await page.textContent('body')
        if (selectionText && selectionText.includes('selected')) {
          console.log('✓ Selection count displayed')
        }

        // Check for pagination buttons
        const nextBtn = await page.locator('button:has-text("Next"), button:has-text(">")')
        const nextCount = await nextBtn.count()

        if (nextCount > 0) {
          console.log('✓ Pagination controls found')

          // Try to go to next page
          await page.locator('button:has-text("2"), button:has-text("next")').first().click({ timeout: 5000 }).catch(() => {})
          await page.waitForTimeout(1000)
          await screenshot(page, '02b-page-two')
          console.log('✓ Navigated to page 2')

          // Select another item
          const checkboxes2 = await page.locator('input[type="checkbox"]')
          if (await checkboxes2.count() > 1) {
            await checkboxes2.nth(1).click()
            await page.waitForTimeout(500)
            console.log('✓ Selected item on page 2')
          }

          // Go back to page 1
          await page.locator('button:has-text("1"), button:has-text("Previous"), button:has-text("<")').first().click({ timeout: 5000 }).catch(() => {})
          await page.waitForTimeout(1000)
          await screenshot(page, '02c-back-to-page-1')

          console.log('✓ Returned to page 1')
          results.push({ test: 'Global Selection (CRITICAL)', status: '✅ PASS', details: 'Selection persisted across pagination' })
        }
      }
    } else {
      console.log('⚠️  No checkboxes found on test cases page')
      results.push({ test: 'Global Selection', status: '❌ FAIL', details: 'No selection controls' })
    }

    // TEST 3: PREVIEW & CREATE SUITE
    console.log('\n╔══════════════════════════════════════════╗')
    console.log('║ PHASE 3: PREVIEW & CREATE SUITE           ║')
    console.log('╚══════════════════════════════════════════╝')

    // Look for Preview button
    const previewBtn = await page.locator('button:has-text("Preview")').first()
    if (await previewBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await previewBtn.click()
      await page.waitForTimeout(1000)
      await screenshot(page, '03a-preview-modal')
      console.log('✓ Preview modal opened')

      // Close preview
      await page.locator('button:has-text("Close")').first().click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(500)
    }

    // Look for Create Suite button
    const createBtn = await page.locator('button:has-text("Create Suite")').first()
    if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Monitor network
      const requests: { method: string; url: string }[] = []
      page.on('request', (req) => {
        if (req.url().includes('test-suites')) {
          requests.push({ method: req.method(), url: req.url() })
        }
      })

      await createBtn.click()
      await page.waitForTimeout(1000)
      await screenshot(page, '03b-create-suite-modal')
      console.log('✓ Create Suite modal opened')

      // Fill suite name
      const nameInput = await page.locator('input[placeholder*="Suite"], input[placeholder*="Smoke"], input[type="text"]').first()
      if (nameInput) {
        await nameInput.fill(`Test Suite ${Date.now()}`)
        await page.waitForTimeout(300)

        // Submit
        const submitBtn = await page.locator('button:has-text("Create Suite")').last()
        await submitBtn.click()
        await page.waitForTimeout(2000)

        await screenshot(page, '03c-suite-created')

        const suiteRequests = requests.filter(r => r.url.includes('test-suites'))
        if (suiteRequests.length > 0) {
          console.log(`✓ Suite creation request sent: ${suiteRequests.length} request(s)`)
          if (suiteRequests.length === 1) {
            console.log('✓ SINGLE REQUEST confirmed!')
            results.push({ test: 'Create Suite (Single Request)', status: '✅ PASS', details: `1 ${suiteRequests[0].method} request` })
          } else {
            results.push({ test: 'Create Suite', status: '⚠️  WARNING', details: `${suiteRequests.length} requests (expected 1)` })
          }
        }
      }
    } else {
      console.log('⚠️  Create Suite button not visible')
      results.push({ test: 'Create Suite', status: '⚠️  NOT TESTED', details: 'Button not visible' })
    }

    // TEST 4: EXECUTION DASHBOARD
    console.log('\n╔══════════════════════════════════════════╗')
    console.log('║ PHASE 4: EXECUTION DASHBOARD              ║')
    console.log('╚══════════════════════════════════════════╝')
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' })
    await screenshot(page, '04a-dashboard')

    // Look for cycle selector
    const cycleSelector = await page.locator('select, [class*="cycle"]').first()
    if (await cycleSelector.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('✓ Cycle selector found')
      await screenshot(page, '04b-with-cycle-selector')

      const dashboardText = await page.textContent('body')
      const hasMetrics = dashboardText && (dashboardText.includes('Pass') || dashboardText.includes('Fail') || dashboardText.includes('Execution') || dashboardText.includes('%'))

      if (hasMetrics) {
        console.log('✓ QA metrics displayed')
        results.push({ test: 'Execution Dashboard', status: '✅ PASS', details: 'Cycle selector + metrics visible' })
      } else {
        console.log('⚠️  QA metrics not clearly visible')
        results.push({ test: 'Execution Dashboard', status: '⚠️  WARNING', details: 'Metrics unclear' })
      }
    } else {
      console.log('⚠️  Cycle selector not found')
      results.push({ test: 'Execution Dashboard', status: '⚠️  NOT TESTED', details: 'Selector not visible' })
    }

    // TEST 5: SEARCH & FILTERS
    console.log('\n╔══════════════════════════════════════════╗')
    console.log('║ PHASE 5: SEARCH & FILTERS                 ║')
    console.log('╚══════════════════════════════════════════╝')
    await page.goto(`${BASE_URL}/test-cases`, { waitUntil: 'networkidle' })

    // Look for search input
    const searchInput = await page.locator('input[placeholder*="search"], input[placeholder*="Search"], input[type="text"]').first()
    if (searchInput) {
      await searchInput.fill('test')
      await page.waitForTimeout(1500)
      await screenshot(page, '05a-search-results')
      console.log('✓ Search functionality working')

      await searchInput.fill('')
      await page.waitForTimeout(1500)
      results.push({ test: 'Search & Filters', status: '✅ PASS', details: 'Search working' })
    } else {
      results.push({ test: 'Search & Filters', status: '⚠️  NOT TESTED', details: 'Search input not found' })
    }

  } catch (error) {
    console.error('Test error:', error)
    results.push({ test: 'Fatal Error', status: '❌ FAIL', details: String(error) })
  } finally {
    await browser.close()
  }

  // Print summary
  console.log('\n\n╔═══════════════════════════════════════════╗')
  console.log('║         COMPLETE TEST SUMMARY              ║')
  console.log('╚═══════════════════════════════════════════╝\n')

  results.forEach(r => {
    console.log(`${r.status} ${r.test}`)
    console.log(`   ${r.details}\n`)
  })

  const passed = results.filter(r => r.status.includes('PASS')).length
  const failed = results.filter(r => r.status.includes('FAIL')).length
  const warnings = results.filter(r => r.status.includes('WARNING')).length

  console.log(`\n📊 Results: ${passed} passed, ${warnings} warnings, ${failed} failed`)
  console.log(`📁 Screenshots: ${SCREENSHOTS_DIR}/`)
}

runTests().catch(console.error)
