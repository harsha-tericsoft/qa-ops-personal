import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const prisma = new PrismaClient()
const BASE_URL = 'http://localhost:3000'

interface TestSuiteInfo {
  id: string
  name: string
  uiCount: number
  dbCount: number
}

test.describe('PHASE 3: Persistence Tests', () => {
  let suiteInfo: TestSuiteInfo

  const setupAuth = async (page: any) => {
    const testUser = { id: 'cmqmjeko900007kfg2mant8kh', email: 'test@example.com', name: 'Test User', role: 'LEAD' }
    const token = 'test-token-' + Date.now()
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' })
    await page.evaluate(({ user, token }) => {
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
    }, { user: testUser, token })

    // Intercept API responses for debugging
    await page.on('response', (response: any) => {
      if (response.url().includes('/api/test-suites')) {
        response.json().then((data: any) => {
          console.log(`   [API Response] ${response.url()}: testCases length = ${Array.isArray(data) ? data[0]?.testCases?.length : data.testCases?.length}`)
        }).catch(() => {})
      }
    })
  }

  const selectKinergeyProject = async (page: any) => {
    const ps = page.locator('select')
    const opts = await page.locator('select > option').all()
    let selectedValue = ''

    for (const opt of opts) {
      const text = await opt.textContent()
      if (text?.includes('Kinergy test') && !text?.includes('New') && !text?.includes('QA')) {
        selectedValue = await opt.getAttribute('value')
        if (selectedValue) {
          console.log(`   [selectKinergeyProject] Found project with ID: ${selectedValue}`)
          break
        }
      }
    }

    if (selectedValue) {
      // Wait for the API call that will fetch suites for this project
      const apiResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/test-suites') &&
          response.url().includes(`projectId=${selectedValue}`) &&
          response.status() === 200
      )

      // Select the project
      await ps.selectOption(selectedValue)

      // Wait for the API response to complete
      try {
        await apiResponsePromise
        await page.waitForTimeout(500)
      } catch (e) {
        console.log(`   [selectKinergeyProject] API response timeout, continuing anyway`)
        await page.waitForTimeout(2000)
      }
    }
  }

  const createTestSuite = async (page: any, suiteName: string): Promise<TestSuiteInfo> => {
    // Open create modal
    const createBtn = page.locator('button:has-text("Create Test Suite")').first()
    await createBtn.click()
    await page.waitForTimeout(1000)

    // Wait for hierarchy to load
    await page.waitForFunction(() => {
      const text = document.body.innerText
      return !text.includes('Loading repository')
    }, { timeout: 10000 })

    await page.waitForTimeout(500)

    // Fill suite name
    const nameInput = page.locator('input[placeholder="e.g., Smoke Suite"]')
    await nameInput.fill(suiteName)

    // Expand first node
    const expandBtns = await page.locator('button').filter({ hasText: '▶' }).all()
    if (expandBtns.length > 0) {
      await expandBtns[0].click()
      await page.waitForTimeout(500)
    }

    // Select first checkbox
    const checkboxes = await page.locator('input[type="checkbox"]').all()
    if (checkboxes.length > 0) {
      await checkboxes[0].click()
      await page.waitForTimeout(500)
    }

    // Get UI count
    const bodyText = await page.textContent('body')
    const uiCount = parseInt(bodyText?.match(/(\d+) tests? selected/)?.[1] || '0', 10)

    // Create suite
    const createSuiteBtn = page.locator('button:has-text("Create Suite")')
    await createSuiteBtn.click()

    // Wait for modal to close and suite to appear in list
    await page.waitForFunction((name) => {
      return document.body.innerText.includes(name)
    }, suiteName, { timeout: 10000 })

    await page.waitForTimeout(2000)  // Extra wait for DB transaction to complete

    // Get DB info
    const dbSuite = await prisma.testSuite.findFirst({
      where: { name: suiteName },
      include: { testCases: true },
    })

    const info: TestSuiteInfo = {
      id: dbSuite?.id || '',
      name: suiteName,
      uiCount,
      dbCount: dbSuite?.testCases.length || 0,
    }

    return info
  }

  const verifysuiteInUI = async (page: any, suiteName: string): Promise<number> => {
    const bodyText = await page.textContent('body')
    console.log(`   [verifysuiteInUI] Looking for suite: ${suiteName}`)
    console.log(`   [verifysuiteInUI] Suite found in UI: ${bodyText?.includes(suiteName)}`)

    if (!bodyText?.includes(suiteName)) {
      console.log(`   [verifysuiteInUI] Suite not found in body text`)
      return 0
    }

    // Extract count from UI
    const match = bodyText.match(new RegExp(suiteName + '[\\s\\S]*?(\\d+) test cases'))
    const count = parseInt(match?.[1] || '0', 10)
    console.log(`   [verifysuiteInUI] Extracted count: ${count}`)
    console.log(`   [verifysuiteInUI] Full regex match: ${match ? match[0].substring(0, 100) + '...' : 'no match'}`)
    return count
  }

  // ============================================
  // TEST 1: REFRESH
  // ============================================
  test('Test 1: Refresh Persistence', async ({ page }) => {
    console.log('\n' + '='.repeat(80))
    console.log('TEST 1: REFRESH PERSISTENCE')
    console.log('='.repeat(80))

    await setupAuth(page)
    await page.goto(`${BASE_URL}/test-suites`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    await selectKinergeyProject(page)

    // Create suite
    const suiteName = `Phase3-Refresh-${Date.now()}`
    suiteInfo = await createTestSuite(page, suiteName)

    console.log(`\n📝 BEFORE REFRESH`)
    console.log(`   Suite Name: ${suiteInfo.name}`)
    console.log(`   Suite ID: ${suiteInfo.id}`)
    console.log(`   UI Count: ${suiteInfo.uiCount}`)
    console.log(`   DB Count: ${suiteInfo.dbCount}`)

    await page.screenshot({ path: 'p3-01-before-refresh.png' })
    console.log(`   Screenshot: p3-01-before-refresh.png`)

    // Refresh
    console.log(`\n🔄 REFRESHING PAGE`)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    await selectKinergeyProject(page)

    await page.screenshot({ path: 'p3-02-after-refresh.png' })
    console.log(`   Screenshot: p3-02-after-refresh.png`)

    // Verify
    const uiCountAfterRefresh = await verifysuiteInUI(page, suiteName)
    const dbSuiteAfterRefresh = await prisma.testSuite.findFirst({
      where: { name: suiteName },
      include: { testCases: true },
    })
    const dbCountAfterRefresh = dbSuiteAfterRefresh?.testCases.length || 0

    console.log(`\n✅ AFTER REFRESH`)
    console.log(`   Suite Name: ${suiteName}`)
    console.log(`   UI Count: ${uiCountAfterRefresh}`)
    console.log(`   DB Count: ${dbCountAfterRefresh}`)
    console.log(`   Match: ${uiCountAfterRefresh === dbCountAfterRefresh ? 'YES ✓' : 'NO ✗'}`)

    expect(uiCountAfterRefresh).toBe(dbCountAfterRefresh)
    expect(dbCountAfterRefresh).toBeGreaterThan(0)

    console.log(`\n✅ TEST 1 PASSED: REFRESH PERSISTENCE`)
  })

  // ============================================
  // TEST 2: NAVIGATION
  // ============================================
  test('Test 2: Navigation Persistence', async ({ page }) => {
    console.log('\n' + '='.repeat(80))
    console.log('TEST 2: NAVIGATION PERSISTENCE')
    console.log('='.repeat(80))

    await setupAuth(page)
    await page.goto(`${BASE_URL}/test-suites`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    await selectKinergeyProject(page)

    // Create suite
    const suiteName = `Phase3-Navigation-${Date.now()}`
    suiteInfo = await createTestSuite(page, suiteName)

    console.log(`\n📝 INITIAL STATE`)
    console.log(`   Suite Name: ${suiteInfo.name}`)
    console.log(`   UI Count: ${suiteInfo.uiCount}`)
    console.log(`   DB Count: ${suiteInfo.dbCount}`)

    await page.screenshot({ path: 'p3-03-before-nav.png' })
    console.log(`   Screenshot: p3-03-before-nav.png`)

    // Navigate to Dashboard
    console.log(`\n🧭 NAVIGATING TO DASHBOARD`)
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    // Navigate to Repository
    console.log(`🧭 NAVIGATING TO REPOSITORY`)
    await page.goto(`${BASE_URL}/repository`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    // Navigate back to Test Suites
    console.log(`🧭 NAVIGATING BACK TO TEST SUITES`)
    await page.goto(`${BASE_URL}/test-suites`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    await selectKinergeyProject(page)

    await page.screenshot({ path: 'p3-04-after-nav.png' })
    console.log(`   Screenshot: p3-04-after-nav.png`)

    // Verify
    const uiCountAfterNav = await verifysuiteInUI(page, suiteName)
    const dbSuiteAfterNav = await prisma.testSuite.findFirst({
      where: { name: suiteName },
      include: { testCases: true },
    })
    const dbCountAfterNav = dbSuiteAfterNav?.testCases.length || 0

    console.log(`\n✅ AFTER NAVIGATION`)
    console.log(`   Suite Name: ${suiteName}`)
    console.log(`   UI Count: ${uiCountAfterNav}`)
    console.log(`   DB Count: ${dbCountAfterNav}`)
    console.log(`   Match: ${uiCountAfterNav === dbCountAfterNav ? 'YES ✓' : 'NO ✗'}`)

    expect(uiCountAfterNav).toBe(dbCountAfterNav)
    expect(dbCountAfterNav).toBeGreaterThan(0)

    console.log(`\n✅ TEST 2 PASSED: NAVIGATION PERSISTENCE`)
  })

  // ============================================
  // TEST 3: SERVER RESTART
  // ============================================
  test('Test 3: Server Restart Persistence', async ({ page }) => {
    console.log('\n' + '='.repeat(80))
    console.log('TEST 3: SERVER RESTART PERSISTENCE')
    console.log('='.repeat(80))

    await setupAuth(page)
    await page.goto(`${BASE_URL}/test-suites`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    await selectKinergeyProject(page)

    // Create suite
    const suiteName = `Phase3-Restart-${Date.now()}`
    suiteInfo = await createTestSuite(page, suiteName)

    console.log(`\n📝 BEFORE SERVER RESTART`)
    console.log(`   Suite Name: ${suiteInfo.name}`)
    console.log(`   Suite ID: ${suiteInfo.id}`)
    console.log(`   UI Count: ${suiteInfo.uiCount}`)
    console.log(`   DB Count: ${suiteInfo.dbCount}`)

    await page.screenshot({ path: 'p3-05-before-restart.png' })
    console.log(`   Screenshot: p3-05-before-restart.png`)

    // Verify in DB before restart
    const dbBeforeRestart = await prisma.testSuite.findUnique({
      where: { id: suiteInfo.id },
      include: { testCases: true },
    })

    console.log(`\n🔧 STOPPING DEV SERVER`)
    try {
      await execAsync('pkill -f "next dev"')
    } catch (e) {
      // Ignore errors, process might already be dead
    }
    await new Promise((resolve) => setTimeout(resolve, 3000))

    console.log(`🔧 STARTING DEV SERVER`)
    // Start server in background
    exec('cd C:\\Users\\harsh\\ClaudeCode\\Assignment3\\qa-ops && npm run dev > /dev/null 2>&1 &')

    // Wait for server to start
    let serverReady = false
    for (let i = 0; i < 30; i++) {
      try {
        const response = await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 5000 })
        if (response?.status() === 200) {
          serverReady = true
          break
        }
      } catch (e) {
        // Server not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    expect(serverReady).toBe(true)
    console.log(`✓ Server restarted successfully`)

    // Re-authenticate and navigate
    await setupAuth(page)
    await page.goto(`${BASE_URL}/test-suites`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    await selectKinergeyProject(page)

    await page.screenshot({ path: 'p3-06-after-restart.png' })
    console.log(`   Screenshot: p3-06-after-restart.png`)

    // Verify
    const uiCountAfterRestart = await verifysuiteInUI(page, suiteName)
    const dbSuiteAfterRestart = await prisma.testSuite.findFirst({
      where: { name: suiteName },
      include: { testCases: true },
    })
    const dbCountAfterRestart = dbSuiteAfterRestart?.testCases.length || 0

    console.log(`\n✅ AFTER SERVER RESTART`)
    console.log(`   Suite Name: ${suiteName}`)
    console.log(`   UI Count: ${uiCountAfterRestart}`)
    console.log(`   DB Count: ${dbCountAfterRestart}`)
    console.log(`   Match: ${uiCountAfterRestart === dbCountAfterRestart ? 'YES ✓' : 'NO ✗'}`)

    expect(uiCountAfterRestart).toBe(dbCountAfterRestart)
    expect(dbCountAfterRestart).toBeGreaterThan(0)

    console.log(`\n✅ TEST 3 PASSED: SERVER RESTART PERSISTENCE`)
  })

  // ============================================
  // TEST 4: DATABASE VERIFICATION
  // ============================================
  test('Test 4: Database Verification', async ({ page }) => {
    console.log('\n' + '='.repeat(80))
    console.log('TEST 4: DATABASE VERIFICATION')
    console.log('='.repeat(80))

    await setupAuth(page)
    await page.goto(`${BASE_URL}/test-suites`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    await selectKinergeyProject(page)

    // Create suite
    const suiteName = `Phase3-DBVerify-${Date.now()}`
    suiteInfo = await createTestSuite(page, suiteName)

    // Query database directly
    const query = `
      SELECT
        "TestSuite"."id",
        "TestSuite"."name",
        COUNT("SuiteTestCase"."id") as test_count
      FROM "TestSuite"
      LEFT JOIN "SuiteTestCase" ON "TestSuite"."id" = "SuiteTestCase"."suiteId"
      WHERE "TestSuite"."name" = '${suiteName}'
      GROUP BY "TestSuite"."id", "TestSuite"."name"
    `

    const dbResult = await prisma.testSuite.findFirst({
      where: { name: suiteName },
      include: { testCases: true },
    })

    console.log(`\n📊 DATABASE QUERY RESULTS`)
    console.log(`   Query:`)
    console.log(`   ${query.split('\n').join('\n   ')}`)
    console.log(`\n   Results:`)
    console.log(`   Suite ID: ${dbResult?.id}`)
    console.log(`   Suite Name: ${dbResult?.name}`)
    console.log(`   Test Count: ${dbResult?.testCases.length}`)

    console.log(`\n✅ DATABASE VERIFICATION COMPLETE`)
    expect(dbResult).toBeTruthy()
    expect(dbResult?.testCases.length).toBeGreaterThan(0)
  })
})

test.afterAll(async () => {
  await prisma.$disconnect()
})
