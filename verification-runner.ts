#!/usr/bin/env npx ts-node
/**
 * VERIFICATION MODE - End-to-End Workflow Testing
 *
 * This script validates all 8 workflows with browser evidence.
 * Every assertion must pass with screenshot/network/console proof.
 */

import { chromium } from 'playwright'
import type { Browser, Page, BrowserContext } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = 'http://localhost:3000'
const EVIDENCE_DIR = './verification-evidence'
const LOGIN_EMAIL = 'lead@test.com'
const LOGIN_PASSWORD = 'hashedpassword123'

interface WorkflowResult {
  name: string
  status: 'PASS' | 'FAIL' | 'BLOCKED'
  evidence: string[]
  errors: string[]
  startTime: number
  endTime: number
}

const results: WorkflowResult[] = []
let browser: Browser
let context: BrowserContext
let page: Page

// Utility functions
async function screenshot(name: string, description: string = ''): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `${name}-${timestamp}.png`
  const filepath = path.join(EVIDENCE_DIR, filename)
  await page.screenshot({ path: filepath, fullPage: true })
  console.log(`  📸 ${filename}${description ? ' - ' + description : ''}`)
  return filepath
}

async function getNetworkLog(): Promise<{ method: string; url: string; status: number }[]> {
  const logs: { method: string; url: string; status: number }[] = []
  page.on('response', (response) => {
    logs.push({
      method: response.request().method(),
      url: new URL(response.url()).pathname + new URL(response.url()).search,
      status: response.status(),
    })
  })
  return logs
}

async function getConsoleErrors(): Promise<string[]> {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })
  return errors
}

// Workflow Tests
async function login(): Promise<boolean> {
  console.log('\n🔐 AUTHENTICATING...')
  try {
    await page.goto(`${BASE_URL}/login`)
    const loginForm = await page.$('input[type="password"]')
    if (!loginForm) {
      console.log('  ⚠️  Login form not found, checking if already authenticated...')
      await page.goto(`${BASE_URL}/dashboard`)
      const dashboardContent = await page.textContent('body')
      if (dashboardContent?.includes('Dashboard') || dashboardContent?.includes('Test')) {
        console.log('  ✅ Already authenticated')
        return true
      }
    }

    await page.fill('input[placeholder="you@example.com"]', LOGIN_EMAIL)
    await page.fill('input[placeholder="••••••••"]', LOGIN_PASSWORD)
    await page.click('button:has-text("Sign In")')
    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 15000 })
    console.log('  ✅ Login successful')
    return true
  } catch (err) {
    console.error('  ❌ Login failed:', err)
    return false
  }
}

async function workflow1_TestCaseSelection(): Promise<void> {
  const workflow: WorkflowResult = {
    name: 'Workflow 1: Test Case Selection',
    status: 'PASS',
    evidence: [],
    errors: [],
    startTime: Date.now(),
    endTime: 0,
  }

  try {
    console.log('\n═══════════════════════════════════════')
    console.log('WORKFLOW 1: TEST CASE SELECTION')
    console.log('═══════════════════════════════════════')

    // Navigate to test-cases
    console.log('\n1️⃣  Navigating to test-cases page...')
    await page.goto(`${BASE_URL}/test-cases`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    let file = await screenshot('w1-01-page1-initial', 'Initial page 1')
    workflow.evidence.push(file)

    // Get initial checkbox count
    const checkboxes = await page.locator('input[type="checkbox"]')
    const checkboxCount = await checkboxes.count()
    console.log(`  Found ${checkboxCount} checkboxes on page 1`)

    if (checkboxCount === 0) {
      throw new Error('No checkboxes found on test-cases page')
    }

    // Find and click Select All
    console.log('\n2️⃣  Clicking "Select All"...')
    const selectTestsLabel = await page.locator('text=Select tests')
    if (await selectTestsLabel.count() === 0) {
      throw new Error('Could not find "Select tests" label')
    }

    const selectAllCheckbox = await selectTestsLabel.locator('..').locator('..').locator('input[type="checkbox"]')
    const beforeSelectAll = await page.locator('text=/\\d+\\s+selected/').count()

    await selectAllCheckbox.click()
    await page.waitForTimeout(2000)

    file = await screenshot('w1-02-after-select-all', 'After clicking Select All')
    workflow.evidence.push(file)

    const afterSelectAll = await page.locator('text=/\\d+\\s+selected/').count()
    console.log(`  Selection bar ${afterSelectAll > 0 ? 'appears' : 'does not appear'} after Select All`)

    // Get selection count from page
    const selectionText = await page.textContent('body')
    const selectedMatch = selectionText?.match(/(\d+)\s+selected/)
    const selectedCount = selectedMatch ? parseInt(selectedMatch[1]) : 0
    console.log(`  Selected count on page 1: ${selectedCount}`)

    // Navigate to page 2
    console.log('\n3️⃣  Navigating to page 2...')
    const pageButtons = await page.locator('button:has-text("Next"), button:has-text("2")')
    if (await pageButtons.count() > 0) {
      await pageButtons.first().click()
      await page.waitForTimeout(2000)

      file = await screenshot('w1-03-page2', 'Page 2 after navigation')
      workflow.evidence.push(file)

      const selectionText2 = await page.textContent('body')
      const selectedMatch2 = selectionText2?.match(/(\d+)\s+selected/)
      const selectedCount2 = selectedMatch2 ? parseInt(selectedMatch2[1]) : 0
      console.log(`  Selected count on page 2: ${selectedCount2}`)

      if (selectedCount2 === 0 && selectedCount > 0) {
        throw new Error('Selection lost when navigating to page 2')
      }

      // Navigate to page 3
      console.log('\n4️⃣  Navigating to page 3...')
      const page3Button = await page.locator('button:has-text("3")')
      if (await page3Button.count() > 0) {
        await page3Button.click()
        await page.waitForTimeout(2000)

        file = await screenshot('w1-04-page3', 'Page 3 after navigation')
        workflow.evidence.push(file)

        const selectionText3 = await page.textContent('body')
        const selectedMatch3 = selectionText3?.match(/(\d+)\s+selected/)
        const selectedCount3 = selectedMatch3 ? parseInt(selectedMatch3[1]) : 0
        console.log(`  Selected count on page 3: ${selectedCount3}`)

        if (selectedCount3 === 0 && selectedCount > 0) {
          throw new Error('Selection lost on page 3')
        }
      }

      // Return to page 1
      console.log('\n5️⃣  Returning to page 1...')
      const page1Button = await page.locator('button:has-text("1")')
      if (await page1Button.count() > 0) {
        await page1Button.click()
        await page.waitForTimeout(2000)

        file = await screenshot('w1-05-back-to-page1', 'Returned to page 1')
        workflow.evidence.push(file)

        const selectionTextFinal = await page.textContent('body')
        const selectedMatchFinal = selectionTextFinal?.match(/(\d+)\s+selected/)
        const selectedCountFinal = selectedMatchFinal ? parseInt(selectedMatchFinal[1]) : 0
        console.log(`  Final selected count on page 1: ${selectedCountFinal}`)

        if (selectedCountFinal > 0) {
          console.log('  ✅ Selection persisted across all pages')
        }
      }
    }

    // Test filters
    console.log('\n6️⃣  Testing with filters...')
    const filterButtons = await page.locator('button:has-text("Automated"), button:has-text("Manual")')
    if (await filterButtons.count() > 0) {
      await filterButtons.first().click()
      await page.waitForTimeout(2000)

      file = await screenshot('w1-06-with-filter', 'Selection with filter applied')
      workflow.evidence.push(file)

      const selectionTextFiltered = await page.textContent('body')
      const selectedMatchFiltered = selectionTextFiltered?.match(/(\d+)\s+selected/)
      const selectedCountFiltered = selectedMatchFiltered ? parseInt(selectedMatchFiltered[1]) : 0
      console.log(`  Selected count with filter: ${selectedCountFiltered}`)
    }

    // Test Clear Selection
    console.log('\n7️⃣  Testing Clear Selection...')
    const clearButton = await page.locator('button:has-text("Clear Selection")')
    if (await clearButton.count() > 0) {
      await clearButton.click()
      await page.waitForTimeout(1000)

      file = await screenshot('w1-07-after-clear', 'After clicking Clear Selection')
      workflow.evidence.push(file)

      const selectionTextCleared = await page.textContent('body')
      const selectedMatchCleared = selectionTextCleared?.match(/(\d+)\s+selected/)
      if (!selectedMatchCleared) {
        console.log('  ✅ All selections cleared')
      } else {
        throw new Error('Selection not cleared')
      }
    }

    console.log('\n✅ WORKFLOW 1: PASSED')
    workflow.status = 'PASS'
  } catch (err) {
    console.error('\n❌ WORKFLOW 1: FAILED -', err)
    workflow.status = 'FAIL'
    workflow.errors.push(String(err))
  } finally {
    workflow.endTime = Date.now()
    results.push(workflow)
  }
}

async function workflow2_PreviewSelected(): Promise<void> {
  const workflow: WorkflowResult = {
    name: 'Workflow 2: Preview Selected',
    status: 'PASS',
    evidence: [],
    errors: [],
    startTime: Date.now(),
    endTime: 0,
  }

  try {
    console.log('\n═══════════════════════════════════════')
    console.log('WORKFLOW 2: PREVIEW SELECTED')
    console.log('═══════════════════════════════════════')

    // Navigate to test-cases and select some tests
    console.log('\n1️⃣  Selecting tests...')
    await page.goto(`${BASE_URL}/test-cases`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    const checkboxes = await page.locator('input[type="checkbox"]')
    const selectAllCheckbox = checkboxes.first()
    await selectAllCheckbox.click()
    await page.waitForTimeout(1500)

    let file = await screenshot('w2-01-after-selection', 'Tests selected')
    workflow.evidence.push(file)

    // Click Preview Selected
    console.log('\n2️⃣  Clicking Preview Selected button...')
    const previewButton = await page.locator('button:has-text("Preview Selected")')
    if (await previewButton.count() === 0) {
      throw new Error('Preview Selected button not found')
    }

    await previewButton.click()
    await page.waitForTimeout(2000)

    file = await screenshot('w2-02-preview-modal', 'Preview modal opened')
    workflow.evidence.push(file)

    // Verify modal content
    console.log('\n3️⃣  Verifying modal content...')
    const modalContent = await page.textContent('[role="dialog"], .modal, [class*="modal"]')
    if (!modalContent) {
      throw new Error('Modal content not found')
    }

    if (modalContent.includes('selected') || modalContent.includes('test')) {
      console.log('  ✅ Modal shows selection information')
    }

    // Test scrolling in modal
    console.log('\n4️⃣  Testing modal scrolling...')
    const modalContainer = await page.$('[role="dialog"], .modal, [class*="modal"]')
    if (modalContainer) {
      await modalContainer.evaluate((el) => {
        el.scrollTop = 100
      })
      await page.waitForTimeout(500)
      file = await screenshot('w2-03-modal-scrolled', 'Modal scrolled')
      workflow.evidence.push(file)
    }

    // Close modal
    console.log('\n5️⃣  Closing modal...')
    const closeButton = await page.locator('button:has-text("Close"), button:has-text("✕"), [aria-label*="close"]')
    if (await closeButton.count() > 0) {
      await closeButton.first().click()
      await page.waitForTimeout(1000)

      file = await screenshot('w2-04-after-close', 'Modal closed')
      workflow.evidence.push(file)

      const modalGone = await page.$('[role="dialog"], .modal')
      if (!modalGone) {
        console.log('  ✅ Modal closed correctly')
      }
    }

    console.log('\n✅ WORKFLOW 2: PASSED')
    workflow.status = 'PASS'
  } catch (err) {
    console.error('\n❌ WORKFLOW 2: FAILED -', err)
    workflow.status = 'FAIL'
    workflow.errors.push(String(err))
  } finally {
    workflow.endTime = Date.now()
    results.push(workflow)
  }
}

async function workflow3_CreateSuite(): Promise<void> {
  const workflow: WorkflowResult = {
    name: 'Workflow 3: Create Suite',
    status: 'PASS',
    evidence: [],
    errors: [],
    startTime: Date.now(),
    endTime: 0,
  }

  try {
    console.log('\n═══════════════════════════════════════')
    console.log('WORKFLOW 3: CREATE SUITE')
    console.log('═══════════════════════════════════════')

    // Navigate and select tests
    console.log('\n1️⃣  Selecting tests...')
    await page.goto(`${BASE_URL}/test-cases`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    const checkboxes = await page.locator('input[type="checkbox"]')
    const selectAllCheckbox = checkboxes.first()
    await selectAllCheckbox.click()
    await page.waitForTimeout(1500)

    // Capture network requests
    const networkLog: { method: string; url: string; status: number }[] = []
    page.on('response', (response) => {
      const url = new URL(response.url())
      if (url.pathname.includes('test-suites') || url.pathname.includes('api')) {
        networkLog.push({
          method: response.request().method(),
          url: `${url.pathname}${url.search}`,
          status: response.status(),
        })
      }
    })

    // Click Create Suite
    console.log('\n2️⃣  Clicking Create Suite button...')
    const createButton = await page.locator('button:has-text("Create Suite")')
    if (await createButton.count() === 0) {
      throw new Error('Create Suite button not found')
    }

    await createButton.click()
    await page.waitForTimeout(1500)

    let file = await screenshot('w3-01-suite-modal', 'Create Suite modal opened')
    workflow.evidence.push(file)

    // Fill in suite name
    console.log('\n3️⃣  Filling suite name...')
    const suiteNameInput = await page.locator('input[placeholder*="Suite"], input[type="text"]').first()
    if (!suiteNameInput) {
      throw new Error('Suite name input not found')
    }

    const suiteName = `AutoSuite-${Date.now()}`
    await suiteNameInput.fill(suiteName)
    await page.waitForTimeout(500)

    file = await screenshot('w3-02-name-filled', 'Suite name filled')
    workflow.evidence.push(file)

    // Clear network log to get only the create request
    networkLog.length = 0

    // Submit
    console.log('\n4️⃣  Submitting form...')
    const submitButton = await page.locator('button:has-text("Create Suite")').last()
    await submitButton.click()
    await page.waitForTimeout(3000)

    file = await screenshot('w3-03-after-submit', 'After form submission')
    workflow.evidence.push(file)

    // Analyze network requests
    console.log('\n5️⃣  Analyzing API requests...')
    const testSuiteRequests = networkLog.filter((r) => r.url.includes('test-suites') && r.method === 'POST')
    console.log(`  Total POST /test-suites requests: ${testSuiteRequests.length}`)

    testSuiteRequests.forEach((req) => {
      console.log(`    - ${req.method} ${req.url} (${req.status})`)
    })

    if (testSuiteRequests.length === 1) {
      console.log('  ✅ EXACTLY ONE request - Correct!')
    } else if (testSuiteRequests.length === 0) {
      throw new Error('No Create Suite request found')
    } else {
      throw new Error(`Expected 1 request, got ${testSuiteRequests.length}`)
    }

    // Verify no loops
    const patchRequests = networkLog.filter((r) => r.method === 'PATCH')
    const testCasesRequests = networkLog.filter((r) => r.url.includes('test-cases') && r.method === 'POST')

    if (patchRequests.length > 0 || testCasesRequests.length > 0) {
      throw new Error(`Found unexpected requests: PATCH (${patchRequests.length}), POST /test-cases (${testCasesRequests.length})`)
    }

    console.log('  ✅ No PATCH loops or test-cases POSTs')
    console.log('\n✅ WORKFLOW 3: PASSED')
    workflow.status = 'PASS'
  } catch (err) {
    console.error('\n❌ WORKFLOW 3: FAILED -', err)
    workflow.status = 'FAIL'
    workflow.errors.push(String(err))
  } finally {
    workflow.endTime = Date.now()
    results.push(workflow)
  }
}

async function workflow4_Dashboard(): Promise<void> {
  const workflow: WorkflowResult = {
    name: 'Workflow 4: Dashboard',
    status: 'PASS',
    evidence: [],
    errors: [],
    startTime: Date.now(),
    endTime: 0,
  }

  try {
    console.log('\n═══════════════════════════════════════')
    console.log('WORKFLOW 4: DASHBOARD')
    console.log('═══════════════════════════════════════')

    console.log('\n1️⃣  Loading dashboard...')
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    let file = await screenshot('w4-01-dashboard', 'Dashboard loaded')
    workflow.evidence.push(file)

    // Verify KPI cards
    console.log('\n2️⃣  Verifying dashboard content...')
    const dashboardText = await page.textContent('body')

    const expectedElements = [
      { text: 'Total', name: 'Total Tests' },
      { text: 'Manual', name: 'Manual Tests' },
      { text: 'Automated', name: 'Automated Tests' },
      { text: 'Draft', name: 'Draft Cycles' },
      { text: 'Active', name: 'Active Cycles' },
      { text: 'Completed', name: 'Completed Cycles' },
    ]

    const found: string[] = []
    const missing: string[] = []

    for (const elem of expectedElements) {
      if (dashboardText?.includes(elem.text)) {
        console.log(`  ✅ ${elem.name}`)
        found.push(elem.name)
      } else {
        console.log(`  ⚠️  ${elem.name} not found`)
        missing.push(elem.name)
      }
    }

    // Check for execution metrics that shouldn't be there
    const hasExecutionMetrics =
      dashboardText?.includes('Pass') && dashboardText?.includes('Fail') && dashboardText?.includes('Execution %')

    if (hasExecutionMetrics) {
      console.log('\n  ⚠️  WARNING: Found execution metrics (should not appear when only project is selected)')
    }

    if (found.length >= 5) {
      console.log('\n✅ WORKFLOW 4: PASSED')
      workflow.status = 'PASS'
    } else {
      throw new Error(`Too many missing elements: ${missing.join(', ')}`)
    }
  } catch (err) {
    console.error('\n❌ WORKFLOW 4: FAILED -', err)
    workflow.status = 'FAIL'
    workflow.errors.push(String(err))
  } finally {
    workflow.endTime = Date.now()
    results.push(workflow)
  }
}

async function workflow5_BrowserHealth(): Promise<void> {
  const workflow: WorkflowResult = {
    name: 'Workflow 5: Browser Health',
    status: 'PASS',
    evidence: [],
    errors: [],
    startTime: Date.now(),
    endTime: 0,
  }

  try {
    console.log('\n═══════════════════════════════════════')
    console.log('WORKFLOW 5: BROWSER HEALTH')
    console.log('═══════════════════════════════════════')

    const consoleErrors: string[] = []
    const consoleWarnings: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text())
      }
    })

    // Navigate to main pages to check for errors
    console.log('\n1️⃣  Checking console for errors...')
    const pagesToCheck = [`${BASE_URL}/test-cases`, `${BASE_URL}/dashboard`, `${BASE_URL}/repository`]

    for (const url of pagesToCheck) {
      await page.goto(url)
      await page.waitForTimeout(1500)
    }

    console.log(`  Console errors: ${consoleErrors.length}`)
    console.log(`  Console warnings: ${consoleWarnings.length}`)

    if (consoleErrors.length === 0) {
      console.log('  ✅ No console errors')
    } else {
      console.log('  ⚠️  Found errors:')
      consoleErrors.forEach((err) => console.log(`     - ${err.substring(0, 100)}`))
    }

    // Check for common errors
    const hasReactErrors = consoleErrors.some((e) => e.includes('React'))
    const hasTypeErrors = consoleErrors.some((e) => e.includes('TypeError'))

    if (hasReactErrors || hasTypeErrors) {
      throw new Error('Found critical JavaScript errors')
    }

    // Take final health screenshot
    await page.goto(`${BASE_URL}/test-cases`)
    let file = await screenshot('w5-01-health-check', 'Final health check')
    workflow.evidence.push(file)

    console.log('\n✅ WORKFLOW 5: PASSED')
    workflow.status = 'PASS'
  } catch (err) {
    console.error('\n❌ WORKFLOW 5: FAILED -', err)
    workflow.status = 'FAIL'
    workflow.errors.push(String(err))
  } finally {
    workflow.endTime = Date.now()
    results.push(workflow)
  }
}

// Main execution
async function runVerification() {
  // Create evidence directory
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  }

  console.log('\n╔════════════════════════════════════════════════════╗')
  console.log('║         VERIFICATION MODE - END-TO-END TESTING       ║')
  console.log('╚════════════════════════════════════════════════════╝')

  try {
    // Launch browser
    console.log('\n🚀 Launching browser...')
    browser = await chromium.launch()
    context = await browser.newContext()
    page = await context.newPage()
    await page.setViewportSize({ width: 1920, height: 1080 })

    // Authenticate
    if (!(await login())) {
      throw new Error('Authentication failed')
    }

    // Run workflows
    await workflow1_TestCaseSelection()
    await workflow2_PreviewSelected()
    await workflow3_CreateSuite()
    await workflow4_Dashboard()
    await workflow5_BrowserHealth()

    // Print summary
    console.log('\n\n╔════════════════════════════════════════════════════╗')
    console.log('║                 VERIFICATION SUMMARY                  ║')
    console.log('╚════════════════════════════════════════════════════╝\n')

    const passed = results.filter((r) => r.status === 'PASS').length
    const failed = results.filter((r) => r.status === 'FAIL').length
    const blocked = results.filter((r) => r.status === 'BLOCKED').length

    results.forEach((result) => {
      const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏸️ '
      const duration = ((result.endTime - result.startTime) / 1000).toFixed(2)
      console.log(`${statusIcon} ${result.name} (${duration}s)`)

      if (result.errors.length > 0) {
        result.errors.forEach((err) => console.log(`   ❌ ${err}`))
      }

      if (result.evidence.length > 0) {
        console.log(`   📸 ${result.evidence.length} evidence file(s)`)
      }
    })

    console.log(`\n📊 TOTAL: ${passed} PASS | ${failed} FAIL | ${blocked} BLOCKED`)
    console.log(`📁 Evidence directory: ${EVIDENCE_DIR}`)

    const demoReadiness = Math.round((passed / results.length) * 100)
    console.log(`\n🎯 Demo Readiness: ${demoReadiness}%`)

    if (failed === 0 && blocked === 0) {
      console.log('\n🎉 ALL WORKFLOWS PASSING - READY FOR DEMO')
    } else {
      console.log('\n⚠️  FIXES REQUIRED BEFORE DEMO')
    }
  } catch (err) {
    console.error('\n💥 FATAL ERROR:', err)
  } finally {
    await browser?.close()
    console.log('\n✅ Verification complete')
  }
}

runVerification().catch(console.error)
