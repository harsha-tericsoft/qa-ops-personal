import { test, expect, Page } from '@playwright/test'
import * as fs from 'fs'

const BASE_URL = 'http://localhost:3000'
const SCREENSHOT_DIR = './test-evidence'

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

function screenshotName(testName: string, stepName: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `${SCREENSHOT_DIR}/${testName}-${stepName}-${timestamp}.png`
}

async function capturePageState(page: Page, testName: string, stepName: string) {
  // Take screenshot
  await page.screenshot({ path: screenshotName(testName, stepName), fullPage: true })

  // Capture console messages
  const consoleLogs: string[] = []
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`)
  })

  // Capture network requests
  const requests: Array<{url: string, status?: number, method: string}> = []
  page.on('response', response => {
    requests.push({
      url: response.url(),
      status: response.status(),
      method: response.request().method()
    })
  })

  return { consoleLogs, requests }
}

test.describe('BUG VERIFICATION: Production Stabilization', () => {

  test('BUG #1: Dashboard API 500 errors and database connection', async ({ page }) => {
    console.log('\n=== BUG #1: Dashboard Connectivity ===')

    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForLoadState('networkidle')

    // Capture initial state
    await capturePageState(page, 'bug1-dashboard', '01-initial-load')

    // Check for errors in console
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Wait for all network requests to complete
    await page.waitForTimeout(2000)

    // Check for 500 errors in Network tab
    let found500 = false
    page.on('response', response => {
      if (response.status() === 500) {
        console.log(`❌ FOUND 500 ERROR: ${response.url()}`)
        found500 = true
      }
    })

    // Reload to test connection reliability
    for (let i = 0; i < 3; i++) {
      console.log(`Reload ${i + 1}/3...`)
      await page.reload()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)
    }

    await capturePageState(page, 'bug1-dashboard', '02-after-reloads')

    if (errors.length > 0) {
      console.log(`❌ Console errors found: ${errors.length}`)
      errors.forEach(e => console.log(`  - ${e}`))
    } else {
      console.log(`✓ No console errors after reloads`)
    }

    if (found500) {
      console.log(`❌ 500 errors detected`)
    } else {
      console.log(`✓ No 500 errors detected`)
    }
  })

  test('BUG #2: Repository page hierarchy loading', async ({ page }) => {
    console.log('\n=== BUG #2: Repository Hierarchy ===')

    await page.goto(`${BASE_URL}/repository`)
    await page.waitForLoadState('networkidle')

    await capturePageState(page, 'bug2-repository', '01-initial-load')

    // Wait for any async loading
    await page.waitForTimeout(2000)

    // Count tree nodes visible
    let rootNodes = await page.locator('[data-test-id="tree-node"]').count()
    if (rootNodes === 0) {
      // Try alternative selectors
      rootNodes = await page.locator('.tree-node').count()
    }
    if (rootNodes === 0) {
      rootNodes = await page.locator('li').count()
    }

    console.log(`Found ${rootNodes} tree nodes at initial load`)

    // Look for expand buttons
    const expandButtons = await page.locator('button:has-text("▶"), button:has-text("▼"), [data-test-id="expand"]').count()
    console.log(`Found ${expandButtons} expandable nodes`)

    // Try to expand first node if visible
    if (expandButtons > 0) {
      const firstExpandButton = page.locator('button:has-text("▶"), button:has-text("▼")').first()
      await firstExpandButton.click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      await capturePageState(page, 'bug2-repository', '02-after-first-expand')

      // Count nodes after expansion
      const expandedNodes = await page.locator('li').count()
      console.log(`After expanding first node: ${expandedNodes} total nodes`)

      // Try second expansion
      const secondExpandButton = page.locator('button:has-text("▶")').first()
      if (secondExpandButton) {
        await secondExpandButton.click()
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(1000)

        await capturePageState(page, 'bug2-repository', '03-after-second-expand')

        const finalNodes = await page.locator('li').count()
        console.log(`After expanding second node: ${finalNodes} total nodes`)
      }
    } else {
      console.log(`❌ No expandable nodes found - tree might be broken`)
    }
  })

  test('BUG #3: Test selection consistency', async ({ page }) => {
    console.log('\n=== BUG #3: Test Selection ===')

    await page.goto(`${BASE_URL}/test-cases`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    await capturePageState(page, 'bug3-selection', '01-test-cases-page')

    // Look for select checkboxes
    const checkboxes = await page.locator('input[type="checkbox"]').count()
    console.log(`Found ${checkboxes} checkboxes`)

    if (checkboxes > 0) {
      // Click some checkboxes
      const checkbox1 = page.locator('input[type="checkbox"]').nth(0)
      const checkbox2 = page.locator('input[type="checkbox"]').nth(1)

      await checkbox1.check()
      await checkbox2.check()

      // Wait for selection updates
      await page.waitForTimeout(1000)

      await capturePageState(page, 'bug3-selection', '02-after-selection')

      // Check if selection count updates
      const selectionDisplay = await page.locator('text=/selected/i, text=/check/i').first()
      if (selectionDisplay) {
        const text = await selectionDisplay.textContent()
        console.log(`Selection display: ${text}`)
      }

      // Check pagination if it exists
      const nextButton = page.locator('button:has-text("Next"), [aria-label="Next page"]')
      if (await nextButton.isVisible()) {
        console.log(`Found pagination - testing across pages`)
        await nextButton.click()
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(1000)

        await capturePageState(page, 'bug3-selection', '03-after-pagination')

        const selectionAfterPagination = await page.locator('text=/selected/i').first()
        if (selectionAfterPagination) {
          const text = await selectionAfterPagination.textContent()
          console.log(`Selection after pagination: ${text}`)
        }
      }
    }
  })

  test('BUG #4: Test suite creation and duplication', async ({ page }) => {
    console.log('\n=== BUG #4: Suite Creation & Duplication ===')

    await page.goto(`${BASE_URL}/test-suites`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    await capturePageState(page, 'bug4-suite', '01-suites-page')

    // Look for "Create Suite" button
    const createButton = page.locator('button:has-text("Create"), button:has-text("New")').first()

    if (await createButton.isVisible()) {
      console.log(`Found Create button - clicking`)
      await createButton.click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      await capturePageState(page, 'bug4-suite', '02-create-dialog')

      // Look for test selection in modal
      const modal = page.locator('[role="dialog"]').first()
      if (await modal.isVisible()) {
        const checkboxes = modal.locator('input[type="checkbox"]')
        const count = await checkboxes.count()
        console.log(`Found ${count} selectable tests in modal`)

        if (count > 0) {
          // Select a few tests
          await checkboxes.nth(0).check()
          if (count > 1) await checkboxes.nth(1).check()
          if (count > 2) await checkboxes.nth(2).check()

          const selected = await checkboxes.evaluateAll((nodes: HTMLInputElement[]) =>
            nodes.filter(n => n.checked).length
          )
          console.log(`Selected ${selected} tests`)

          await capturePageState(page, 'bug4-suite', '03-tests-selected')

          // Look for create/submit button
          const submitButton = modal.locator('button:has-text("Create"), button:has-text("Submit")').last()
          if (await submitButton.isVisible()) {
            await submitButton.click()
            await page.waitForLoadState('networkidle')
            await page.waitForTimeout(2000)

            await capturePageState(page, 'bug4-suite', '04-after-creation')

            // Check if suite was created and count matches
            console.log(`Suite creation completed`)
          }
        }
      }
    }
  })

  test('BUG #5: Execution cycle status updates', async ({ page }) => {
    console.log('\n=== BUG #5: Status Updates ===')

    await page.goto(`${BASE_URL}/cycles`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    await capturePageState(page, 'bug5-status', '01-cycles-page')

    // Find a cycle to open
    const cycleLink = page.locator('a:has-text("Test"), [data-test-id="cycle"]').first()

    if (await cycleLink.isVisible()) {
      await cycleLink.click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      await capturePageState(page, 'bug5-status', '02-cycle-details')

      // Look for status update control
      const statusSelect = page.locator('select, [data-test-id="status"]').first()
      if (await statusSelect.isVisible()) {
        const initialStatus = await statusSelect.inputValue?.() || await statusSelect.textContent()
        console.log(`Current status: ${initialStatus}`)

        // Change status
        await statusSelect.click()
        await page.waitForTimeout(500)

        const nextOption = page.locator('option, [role="option"]').nth(1)
        if (await nextOption.isVisible()) {
          await nextOption.click()
          await page.waitForLoadState('networkidle')
          await page.waitForTimeout(2000)

          await capturePageState(page, 'bug5-status', '03-after-status-change')

          // Check if page updated
          const newStatus = await statusSelect.inputValue?.() || await statusSelect.textContent()
          console.log(`New status: ${newStatus}`)

          // Check if dashboard/metrics updated
          const metricElements = await page.locator('[data-test-id="metric"], .metric, [role="status"]')
          console.log(`Found ${await metricElements.count()} metric elements`)
        }
      }
    }
  })

  test('BUG #6: API Performance measurements', async ({ page }) => {
    console.log('\n=== BUG #6: API Performance ===')

    const timings: Record<string, number[]> = {}

    page.on('response', response => {
      const url = response.url()
      const startTime = response.request().postDataBuffer?.length || 0
      const status = response.status()

      if (url.includes('/api/')) {
        const timing = performance.now()
        const shortUrl = new URL(url).pathname

        if (!timings[shortUrl]) timings[shortUrl] = []
        // Store approximate timing (would need more detailed instrumentation)
      }
    })

    // Test various pages and measure response times
    const pages = [
      '/api/projects',
      '/dashboard',
      '/test-cases',
      '/repository',
      '/cycles',
    ]

    for (const path of pages) {
      const start = Date.now()
      await page.goto(`${BASE_URL}${path}`)
      await page.waitForLoadState('networkidle')
      const duration = Date.now() - start

      console.log(`${path}: ${duration}ms`)

      if (duration > 5000) {
        console.log(`  ⚠️  SLOW: ${path} took ${duration}ms`)
      }
    }

    await capturePageState(page, 'bug6-performance', '01-performance-test')
  })

  test('BUG #7: Text visibility in dark mode', async ({ page }) => {
    console.log('\n=== BUG #7: Text Visibility ===')

    // Check if dark mode toggle exists
    const darkModeToggle = page.locator('[aria-label*="dark"], [aria-label*="theme"]').first()

    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForLoadState('networkidle')

    // Check text colors and contrast
    const allText = await page.locator('body *').evaluateAll((elements: Element[]) => {
      return elements
        .filter(el => el.textContent?.trim())
        .slice(0, 20)
        .map(el => {
          const style = window.getComputedStyle(el)
          return {
            text: el.textContent?.substring(0, 30),
            color: style.color,
            bgColor: style.backgroundColor,
          }
        })
    })

    console.log(`Text color analysis:`)
    allText.forEach(item => {
      console.log(`  ${item.text}: color=${item.color} bg=${item.bgColor}`)
    })

    await capturePageState(page, 'bug7-visibility', '01-text-visibility')
  })

  test('BUG #8: Count consistency across modules', async ({ page }) => {
    console.log('\n=== BUG #8: Count Consistency ===')

    const counts: Record<string, number | string> = {}

    // Dashboard counts
    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForLoadState('networkidle')
    const dashboardTotal = await page.locator('text=/\\d+ test/i, [data-test-id="total-tests"]').first()
    if (dashboardTotal) {
      counts['Dashboard'] = await dashboardTotal.textContent()
    }

    // Repository counts
    await page.goto(`${BASE_URL}/repository`)
    await page.waitForLoadState('networkidle')
    const repoTotal = await page.locator('text=/test/i').first()
    if (repoTotal) {
      counts['Repository'] = await repoTotal.textContent()
    }

    // Test Cases counts
    await page.goto(`${BASE_URL}/test-cases`)
    await page.waitForLoadState('networkidle')
    const testCasesTotal = await page.locator('text=/\\d+ case/i, [data-test-id="test-count"]').first()
    if (testCasesTotal) {
      counts['TestCases'] = await testCasesTotal.textContent()
    }

    console.log(`Count comparison:`)
    Object.entries(counts).forEach(([module, count]) => {
      console.log(`  ${module}: ${count}`)
    })

    await capturePageState(page, 'bug8-counts', '01-count-check')
  })

})
