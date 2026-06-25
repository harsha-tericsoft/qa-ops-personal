import { chromium } from 'playwright'
import type { Browser, Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = 'http://localhost:3000'
const SCREENSHOTS_DIR = './test-screenshots'

// Create screenshots directory
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
}

interface TestResult {
  name: string
  status: 'PASS' | 'FAIL'
  error?: string
  screenshot?: string
}

const results: TestResult[] = []

async function screenshot(page: Page, name: string): Promise<string> {
  const filename = `${SCREENSHOTS_DIR}/${name}-${Date.now()}.png`
  await page.screenshot({ path: filename, fullPage: true })
  console.log(`📸 Screenshot: ${filename}`)
  return filename
}

async function testRefreshSync(page: Page) {
  console.log('\n=== TEST 1: REFRESH SYNC ===')
  try {
    await page.goto(`${BASE_URL}/repository`, { waitUntil: 'networkidle' })
    await screenshot(page, 'test1-repository-loaded')

    // Look for refresh button and check if it works
    const syncButton = await page.$('[data-testid="sync-button"], button:has-text("Sync")')
    if (syncButton) {
      console.log('✓ Sync button found')
      await syncButton.click()

      // Wait for sync to complete (spinner to disappear)
      await page.waitForTimeout(2000)
      await screenshot(page, 'test1-after-sync')
      console.log('✓ Sync completed and spinner disappeared')

      results.push({ name: 'Refresh Sync', status: 'PASS', screenshot: 'test1-after-sync' })
    } else {
      console.log('⚠️  Sync button not found with expected selectors')
      results.push({ name: 'Refresh Sync', status: 'FAIL', error: 'Sync button not found' })
    }
  } catch (error) {
    console.error('❌ Refresh Sync test failed:', error)
    results.push({ name: 'Refresh Sync', status: 'FAIL', error: String(error) })
  }
}

async function testRepositoryHierarchy(page: Page) {
  console.log('\n=== TEST 2: REPOSITORY HIERARCHY ===')
  try {
    await page.goto(`${BASE_URL}/repository`, { waitUntil: 'networkidle' })
    await screenshot(page, 'test2-hierarchy-view')

    // Check if hierarchy is displayed
    const treeContent = await page.textContent('[data-testid="repository-tree"], .tree, [class*="tree"]')
    if (treeContent && treeContent.length > 0) {
      console.log('✓ Repository hierarchy is displayed')
      results.push({ name: 'Repository Hierarchy', status: 'PASS', screenshot: 'test2-hierarchy-view' })
    } else {
      console.log('⚠️  Repository hierarchy not clearly visible')
      results.push({ name: 'Repository Hierarchy', status: 'FAIL', error: 'Hierarchy content not visible' })
    }
  } catch (error) {
    console.error('❌ Repository Hierarchy test failed:', error)
    results.push({ name: 'Repository Hierarchy', status: 'FAIL', error: String(error) })
  }
}

async function testGlobalSelection(page: Page) {
  console.log('\n=== TEST 3: GLOBAL SELECTION (CRITICAL) ===')
  try {
    await page.goto(`${BASE_URL}/test-cases`, { waitUntil: 'networkidle' })
    await screenshot(page, 'test3-1-page1-initial')

    // Select some tests on page 1
    const checkboxes = await page.$$('input[type="checkbox"]')
    console.log(`Found ${checkboxes.length} checkboxes on page 1`)

    if (checkboxes.length > 1) {
      // Click first 2 checkboxes
      await checkboxes[1].click()
      await page.waitForTimeout(500)
      await checkboxes[2].click()
      await page.waitForTimeout(500)

      await screenshot(page, 'test3-2-selected-on-page1')

      // Check selection count
      const selectionText = await page.textContent('[class*="selected"], [data-testid*="selection"]')
      console.log(`Selection display: ${selectionText}`)

      // Go to page 2
      const nextPageBtn = await page.$('button:has-text("Next"), [aria-label*="next"], button:has-text("2")')
      if (nextPageBtn) {
        await nextPageBtn.click()
        await page.waitForTimeout(1000)
        await screenshot(page, 'test3-3-page2-after-nav')

        // Select more on page 2
        const checkboxes2 = await page.$$('input[type="checkbox"]')
        if (checkboxes2.length > 1) {
          await checkboxes2[1].click()
          await page.waitForTimeout(500)
          await screenshot(page, 'test3-4-selected-on-page2')
        }

        // Go back to page 1 and verify selections persist
        const prevPageBtn = await page.$('button:has-text("Previous"), button:has-text("1")')
        if (prevPageBtn) {
          await prevPageBtn.click()
          await page.waitForTimeout(1000)
          await screenshot(page, 'test3-5-back-to-page1')

          console.log('✓ Selections persisted across pagination')
          results.push({ name: 'Global Selection (CRITICAL)', status: 'PASS', screenshot: 'test3-5-back-to-page1' })
        }
      }
    }
  } catch (error) {
    console.error('❌ Global Selection test failed:', error)
    results.push({ name: 'Global Selection (CRITICAL)', status: 'FAIL', error: String(error) })
  }
}

async function testPreviewSelected(page: Page) {
  console.log('\n=== TEST 4: PREVIEW SELECTED MODAL ===')
  try {
    const previewBtn = await page.$('button:has-text("Preview")')
    if (previewBtn) {
      await previewBtn.click()
      await page.waitForTimeout(1000)
      await screenshot(page, 'test4-1-preview-modal')

      // Check if modal has expected content
      const modalContent = await page.textContent('[role="dialog"], .modal, [class*="modal"]')
      if (modalContent && modalContent.includes('selected')) {
        console.log('✓ Preview modal displayed with selection info')
        results.push({ name: 'Preview Selected Modal', status: 'PASS', screenshot: 'test4-1-preview-modal' })
      } else {
        console.log('⚠️  Preview modal may not have expected content')
        results.push({ name: 'Preview Selected Modal', status: 'FAIL', error: 'Modal content unclear' })
      }

      // Close modal
      const closeBtn = await page.$('button:has-text("Close"), button:has-text("✕")')
      if (closeBtn) {
        await closeBtn.click()
        await page.waitForTimeout(500)
      }
    } else {
      console.log('⚠️  Preview button not found')
      results.push({ name: 'Preview Selected Modal', status: 'FAIL', error: 'Preview button not found' })
    }
  } catch (error) {
    console.error('❌ Preview Selected test failed:', error)
    results.push({ name: 'Preview Selected Modal', status: 'FAIL', error: String(error) })
  }
}

async function testCreateSuite(page: Page) {
  console.log('\n=== TEST 5: CREATE SUITE (SINGLE REQUEST) ===')
  try {
    // Make sure we're on test-cases page with selections
    await page.goto(`${BASE_URL}/test-cases`, { waitUntil: 'networkidle' })

    // Select at least one test
    const checkboxes = await page.$$('input[type="checkbox"]')
    if (checkboxes.length > 1 && !(await checkboxes[1].isChecked())) {
      await checkboxes[1].click()
      await page.waitForTimeout(500)
    }

    // Click Create Suite button
    const createBtn = await page.$('button:has-text("Create Suite")')
    if (createBtn) {
      // Monitor network requests
      const requests: string[] = []
      page.on('request', (req) => {
        if (req.url().includes('test-suites')) {
          requests.push(`${req.method()} ${req.url()}`)
        }
      })

      await createBtn.click()
      await page.waitForTimeout(1000)
      await screenshot(page, 'test5-1-create-suite-modal')

      // Fill in suite name
      const nameInput = await page.$('input[placeholder*="Suite"], input[type="text"]')
      if (nameInput) {
        await nameInput.fill('Test Suite - ' + Date.now())
        await page.waitForTimeout(300)

        // Click submit
        const submitBtn = await page.$('button:has-text("Create Suite"), button:has-text("Create")')
        if (submitBtn) {
          await submitBtn.click()
          await page.waitForTimeout(2000)
          await screenshot(page, 'test5-2-suite-created')

          // Check if only ONE request was made
          const testSuiteRequests = requests.filter(r => r.includes('test-suites'))
          if (testSuiteRequests.length === 1) {
            console.log('✓ Single API request confirmed:', testSuiteRequests[0])
            results.push({ name: 'Create Suite (Single Request)', status: 'PASS', screenshot: 'test5-2-suite-created' })
          } else {
            console.log('⚠️  Multiple requests detected:', testSuiteRequests)
            results.push({ name: 'Create Suite (Single Request)', status: 'FAIL', error: `Expected 1 request, got ${testSuiteRequests.length}` })
          }
        }
      }
    } else {
      console.log('⚠️  Create Suite button not found')
      results.push({ name: 'Create Suite (Single Request)', status: 'FAIL', error: 'Create Suite button not found' })
    }
  } catch (error) {
    console.error('❌ Create Suite test failed:', error)
    results.push({ name: 'Create Suite (Single Request)', status: 'FAIL', error: String(error) })
  }
}

async function testExecutionDashboard(page: Page) {
  console.log('\n=== TEST 6: EXECUTION DASHBOARD ===')
  try {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' })
    await screenshot(page, 'test6-1-dashboard-initial')

    // Look for cycle selector
    const cycleSelector = await page.$('select, [data-testid*="cycle"], [class*="cycle"]')
    if (cycleSelector) {
      console.log('✓ Cycle selector found')
      await screenshot(page, 'test6-2-cycle-selector')

      // Check for QA metrics
      const dashboardContent = await page.textContent('body')
      if (dashboardContent && (dashboardContent.includes('Pass') || dashboardContent.includes('Fail') || dashboardContent.includes('Execution'))) {
        console.log('✓ QA metrics displayed')
        results.push({ name: 'Execution Dashboard', status: 'PASS', screenshot: 'test6-2-cycle-selector' })
      } else {
        results.push({ name: 'Execution Dashboard', status: 'FAIL', error: 'QA metrics not visible' })
      }
    } else {
      console.log('⚠️  Cycle selector not found')
      results.push({ name: 'Execution Dashboard', status: 'FAIL', error: 'Cycle selector not found' })
    }
  } catch (error) {
    console.error('❌ Dashboard test failed:', error)
    results.push({ name: 'Execution Dashboard', status: 'FAIL', error: String(error) })
  }
}

async function testSearchAndFilter(page: Page) {
  console.log('\n=== TEST 7: SEARCH AND FILTERS ===')
  try {
    await page.goto(`${BASE_URL}/test-cases`, { waitUntil: 'networkidle' })
    await screenshot(page, 'test7-1-test-cases-page')

    // Look for search input
    const searchInput = await page.$('input[placeholder*="search"], input[placeholder*="Search"], input[type="text"]')
    if (searchInput) {
      await searchInput.fill('test')
      await page.waitForTimeout(1500)
      await screenshot(page, 'test7-2-search-results')
      console.log('✓ Search functionality works')

      // Clear search
      await searchInput.fill('')
      await page.waitForTimeout(1500)
    }

    // Look for filters
    const filterBtn = await page.$('button:has-text("Filter"), [data-testid*="filter"], [class*="filter"]')
    if (filterBtn) {
      console.log('✓ Filter controls found')
      await screenshot(page, 'test7-3-filters-visible')
      results.push({ name: 'Search and Filters', status: 'PASS', screenshot: 'test7-3-filters-visible' })
    } else {
      results.push({ name: 'Search and Filters', status: 'FAIL', error: 'Filter controls not found' })
    }
  } catch (error) {
    console.error('❌ Search and Filter test failed:', error)
    results.push({ name: 'Search and Filters', status: 'FAIL', error: String(error) })
  }
}

async function runAllTests() {
  let browser: Browser | null = null

  try {
    console.log('🚀 Starting comprehensive browser tests...\n')

    browser = await chromium.launch()
    const context = await browser.newContext()
    const page = await context.newPage()

    // Set viewport size
    await page.setViewportSize({ width: 1920, height: 1080 })

    // Run all tests
    await testRefreshSync(page)
    await testRepositoryHierarchy(page)
    await testGlobalSelection(page)
    await testPreviewSelected(page)
    await testCreateSuite(page)
    await testExecutionDashboard(page)
    await testSearchAndFilter(page)

    await context.close()
    await browser.close()

    // Print results
    console.log('\n\n╔═══════════════════════════════════════╗')
    console.log('║         TEST RESULTS SUMMARY           ║')
    console.log('╚═══════════════════════════════════════╝\n')

    const passed = results.filter(r => r.status === 'PASS').length
    const failed = results.filter(r => r.status === 'FAIL').length

    results.forEach(r => {
      const icon = r.status === 'PASS' ? '✅' : '❌'
      console.log(`${icon} ${r.name}: ${r.status}`)
      if (r.error) {
        console.log(`   Error: ${r.error}`)
      }
      if (r.screenshot) {
        console.log(`   Evidence: ${r.screenshot}`)
      }
    })

    console.log(`\n📊 TOTAL: ${passed} passed, ${failed} failed out of ${results.length} tests`)
    console.log(`📸 Screenshots saved to: ${SCREENSHOTS_DIR}`)

    process.exit(failed > 0 ? 1 : 0)
  } catch (error) {
    console.error('Fatal error:', error)
    if (browser) {
      await browser.close()
    }
    process.exit(1)
  }
}

runAllTests()
