#!/usr/bin/env npx ts-node
/**
 * DEEP DEBUG - FIND ROOT CAUSE OF UI FAILURES
 *
 * Captures:
 * - Console errors/warnings
 * - Failed network requests
 * - React hydration issues
 * - Component mounting
 * - DOM inspection
 * - Computed styles
 */

import { chromium } from 'playwright'
import * as fs from 'fs'

const DEBUG_LOG = './debug-full.log'
let logLines: string[] = []

function log(msg: string) {
  console.log(msg)
  logLines.push(msg)
}

async function captureAllErrors() {
  const browser = await chromium.launch()
  const page = await browser.newContext().then(c => c.newPage())

  const consoleErrors: any[] = []
  const networkErrors: any[] = []
  const performanceLogs: any[] = []

  // Capture console messages
  page.on('console', (msg) => {
    const entry = {
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
    }
    if (msg.type() === 'error') {
      consoleErrors.push(entry)
      log(`❌ CONSOLE ERROR: ${msg.text()}`)
    } else if (msg.type() === 'warning') {
      log(`⚠️  CONSOLE WARNING: ${msg.text()}`)
    }
  })

  // Capture failed requests
  page.on('response', (response) => {
    if (!response.ok()) {
      const entry = {
        status: response.status(),
        url: response.url(),
        statusText: response.statusText(),
      }
      networkErrors.push(entry)
      log(`❌ NETWORK ERROR: ${response.status()} ${response.url()}`)
    }
  })

  // Login
  log('\n═══════════════════════════════════════')
  log('PHASE 0: AUTHENTICATION')
  log('═══════════════════════════════════════')

  await page.goto('http://localhost:3000/login')
  await page.fill('input[placeholder="you@example.com"]', 'lead@test.com')
  await page.fill('input[placeholder="••••••••"]', 'hashedpassword123')
  await page.click('button:has-text("Sign In")')
  await page.waitForURL('http://localhost:3000/dashboard', { timeout: 15000 })
  log('✅ Logged in')

  // PHASE 1A: DASHBOARD DEBUGGING
  log('\n═══════════════════════════════════════')
  log('PHASE 1A: DASHBOARD - IS COMPONENT MOUNTED?')
  log('═══════════════════════════════════════')

  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // Check if ExecutionDashboard component exists in HTML
  const dashboardHTML = await page.content()
  const hasExecutionDashboard = dashboardHTML.includes('ExecutionDashboard') || dashboardHTML.includes('Cycle')
  log(`ExecutionDashboard in HTML: ${hasExecutionDashboard}`)

  // Check for KPI elements
  const hasTotalTests = await page.locator('text=Total Tests').count()
  const hasManual = await page.locator('text=Manual').count()
  const hasAutomated = await page.locator('text=Automated').count()
  const hasDraft = await page.locator('text=Draft').count()

  log(`KPI Elements found: Total=${hasTotalTests}, Manual=${hasManual}, Automated=${hasAutomated}, Draft=${hasDraft}`)

  // Inspect React DevTools
  const reactDevTools = await page.evaluate(() => {
    const element = document.querySelector('[data-testid="dashboard"]') || document.querySelector('main')
    if (element) {
      const keys = Object.keys(element).filter(k => k.startsWith('__react'))
      return {
        hasReactProps: keys.length > 0,
        reactKeys: keys,
      }
    }
    return { hasReactProps: false, reactKeys: [] }
  })

  log(`React props on dashboard: ${reactDevTools.hasReactProps}`)
  if (reactDevTools.reactKeys.length > 0) {
    log(`React keys: ${reactDevTools.reactKeys.join(', ')}`)
  }

  // PHASE 1B: CHECK RENDERED HTML
  log('\n═══════════════════════════════════════')
  log('PHASE 1B: INSPECT RENDERED HTML')
  log('═══════════════════════════════════════')

  const bodyHTML = await page.locator('body').evaluate(el => el.innerHTML.substring(0, 1000))
  log(`Body HTML (first 1000 chars): ${bodyHTML}`)

  // Check for specific dashboard elements
  const mainContent = await page.locator('main').evaluate(el => el.innerHTML.substring(0, 2000))
  log(`Main content (first 2000 chars): ${mainContent}`)

  // PHASE 1C: CHECK COMPUTED STYLES
  log('\n═══════════════════════════════════════')
  log('PHASE 1C: COMPUTED STYLES & DOM INSPECTION')
  log('═══════════════════════════════════════')

  const styleInfo = await page.evaluate(() => {
    const elements = {
      main: document.querySelector('main'),
      section: document.querySelector('section'),
      div_flex: document.querySelector('[class*="flex"]'),
    }

    const styles: any = {}
    for (const [key, el] of Object.entries(elements)) {
      if (el) {
        const style = window.getComputedStyle(el as Element)
        styles[key] = {
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          height: style.height,
          zIndex: style.zIndex,
        }
      }
    }
    return styles
  })

  log(`Computed styles: ${JSON.stringify(styleInfo, null, 2)}`)

  // PHASE 1D: TEST CASES & CREATE SUITE BUTTON
  log('\n═══════════════════════════════════════')
  log('PHASE 2A: TEST CASES - CREATE SUITE BUTTON')
  log('═══════════════════════════════════════')

  await page.goto('http://localhost:3000/test-cases', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // Select tests
  const checkboxes = await page.locator('input[type="checkbox"]')
  const checkboxCount = await checkboxes.count()
  log(`Checkboxes found: ${checkboxCount}`)

  let createCount = 0
  let modalCount = 0

  if (checkboxCount > 0) {
    await checkboxes.first().click()
    await page.waitForTimeout(1500)

    // Check if selection bar appears
    const selectionBar = await page.locator('text=/\\d+\\s+selected/').count()
    log(`Selection bar visible: ${selectionBar > 0}`)

    // Inspect Create Suite button
    const createButton = await page.locator('button:has-text("Create Suite")')
    createCount = await createButton.count()
    log(`Create Suite buttons found: ${createCount}`)

    if (createCount > 0) {
      // Get button state
      const buttonState = await createButton.first().evaluate((btn: any) => ({
        disabled: btn.disabled,
        display: window.getComputedStyle(btn).display,
        visibility: window.getComputedStyle(btn).visibility,
        opacity: window.getComputedStyle(btn).opacity,
        html: btn.outerHTML.substring(0, 200),
      }))

      log(`Create Suite button state: ${JSON.stringify(buttonState)}`)

      if (buttonState.disabled) {
        log(`❌ PROBLEM: Create Suite button is DISABLED`)
        log(`HTML: ${buttonState.html}`)
      }
    } else {
      log(`❌ PROBLEM: Create Suite button NOT FOUND in DOM`)

      // Debug: what buttons ARE there?
      const allButtons = await page.locator('button').count()
      log(`Total buttons on page: ${allButtons}`)

      const buttonTexts = await page.locator('button').allTextContents()
      log(`Button texts: ${buttonTexts.slice(0, 10).join(', ')}`)
    }
  }

  // PHASE 2B: MODAL DEBUGGING
  log('\n═══════════════════════════════════════')
  log('PHASE 2B: MODAL RENDERING')
  log('═══════════════════════════════════════')

  const previewBtn = await page.locator('button:has-text("Preview Selected")')
  if (await previewBtn.count() > 0) {
    await previewBtn.first().click()
    await page.waitForTimeout(2000)

    // Check for modal
    const modal = await page.locator('[role="dialog"]')
    modalCount = await modal.count()
    log(`Modal elements [role="dialog"]: ${modalCount}`)

    if (modalCount > 0) {
      const modalHTML = await modal.first().evaluate(el => el.outerHTML.substring(0, 500))
      log(`Modal HTML: ${modalHTML}`)
    } else {
      log(`❌ PROBLEM: Modal not found in DOM`)

      // Check alternative selectors
      const altModal1 = await page.locator('.modal').count()
      const altModal2 = await page.locator('[class*="modal"]').count()
      log(`Alternative modal selectors: .modal=${altModal1}, [class*="modal"]=${altModal2}`)
    }
  }

  // PHASE 3: NETWORK REQUESTS
  log('\n═══════════════════════════════════════')
  log('PHASE 3: NETWORK REQUESTS')
  log('═══════════════════════════════════════')

  log(`Failed network requests: ${networkErrors.length}`)
  networkErrors.forEach((err, i) => {
    log(`  ${i + 1}. ${err.status} ${err.url}`)
  })

  // PHASE 4: CONSOLE ERRORS
  log('\n═══════════════════════════════════════')
  log('PHASE 4: CONSOLE ERRORS SUMMARY')
  log('═══════════════════════════════════════')

  log(`Total console errors: ${consoleErrors.length}`)
  consoleErrors.forEach((err, i) => {
    log(`  ${i + 1}. [${err.type}] ${err.text}`)
  })

  // Final summary
  log('\n═══════════════════════════════════════')
  log('SUMMARY OF ISSUES')
  log('═══════════════════════════════════════')

  const issues = [
    { name: 'Dashboard KPIs', status: hasTotalTests === 0 ? '❌ NOT FOUND' : '✅ Found' },
    { name: 'Create Suite button', status: createCount === 0 ? '❌ NOT FOUND' : '✅ Found' },
    { name: 'Modal', status: modalCount === 0 ? '❌ NOT FOUND' : '✅ Found' },
    { name: 'Console errors', status: consoleErrors.length > 0 ? `❌ ${consoleErrors.length} errors` : '✅ None' },
    { name: 'Network errors', status: networkErrors.length > 0 ? `❌ ${networkErrors.length} errors` : '✅ None' },
  ]

  issues.forEach(issue => {
    log(`${issue.status.includes('❌') ? '❌' : '✅'} ${issue.name}: ${issue.status}`)
  })

  // Save to file
  fs.writeFileSync(DEBUG_LOG, logLines.join('\n'))
  log(`\n📁 Full log saved to: ${DEBUG_LOG}`)

  await browser.close()
}

captureAllErrors().catch(console.error)
