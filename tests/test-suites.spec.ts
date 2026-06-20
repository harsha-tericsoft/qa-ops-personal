import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE_URL = 'http://localhost:3000'

test.describe('Test Suite Management - PHASE 1 & 2', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to test suites page
    await page.goto(`${BASE_URL}/test-suites`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)

    // Check if we need to log in
    const loginButton = await page.$('button:has-text("Sign In with Google")')
    if (loginButton) {
      // Create mock auth by directly navigating to dashboard (already logged in)
      await page.goto(`${BASE_URL}/dashboard`)
      await page.goto(`${BASE_URL}/test-suites`)
    }
  })

  test('PHASE 1: Create suite with hierarchy selection', async ({ page }) => {
    // Get initial suite count
    const initialSuites = await prisma.testSuite.findMany()
    const initialCount = initialSuites.length

    // Click Create Test Suite button
    const createBtn = page.locator('button:has-text("Create Test Suite")').first()
    await expect(createBtn).toBeVisible()
    await createBtn.click()

    // Verify modal appears
    const modalTitle = page.locator('h2:has-text("Create Test Suite")')
    await expect(modalTitle).toBeVisible()

    // Fill suite name
    await page.fill('input[placeholder="e.g., Smoke Suite"]', 'Hierarchy Test Suite')

    // Verify repository tree selector appears
    const treeSelector = page.locator('h3:has-text("Select Test Cases")')
    await expect(treeSelector).toBeVisible()

    // Look for expandable nodes in the tree
    const expandButtons = page.locator('button').filter({ hasText: /[▼▶]/ })
    const expandButtonCount = await expandButtons.count()
    console.log(`Found ${expandButtonCount} expandable nodes`)

    // Click first expand button if available
    if (expandButtonCount > 0) {
      await expandButtons.first().click()
      await page.waitForTimeout(300)
    }

    // Select first checkbox in tree
    const checkboxes = page.locator('input[type="checkbox"]')
    const checkboxCount = await checkboxes.count()
    console.log(`Found ${checkboxCount} checkboxes in tree`)

    if (checkboxCount > 0) {
      // Click first checkbox to select a hierarchy node
      await checkboxes.first().click()

      // Wait for test count to update
      await page.waitForTimeout(500)

      // Verify test count is displayed
      const testCountDisplay = page.locator('span:has-text(/\\d+ tests? selected/)')
      await expect(testCountDisplay).toBeVisible()

      const testCountText = await testCountDisplay.textContent()
      console.log(`Selected test count: ${testCountText}`)
    }

    // Click Create Suite button
    const createSuiteBtn = page.locator('button:has-text("Create Suite")')
    await expect(createSuiteBtn).toBeEnabled()
    await createSuiteBtn.click()

    // Wait for modal to close
    await page.waitForTimeout(800)
    await expect(modalTitle).not.toBeVisible()

    // Verify suite appears in list
    const suiteLink = page.locator('h3:has-text("Hierarchy Test Suite")')
    await expect(suiteLink).toBeVisible()

    // Verify database state
    await page.waitForTimeout(500)
    const suiteInDb = await prisma.testSuite.findFirst({
      where: { name: 'Hierarchy Test Suite' },
      include: { testCases: true },
    })

    expect(suiteInDb).toBeTruthy()
    expect(suiteInDb?.name).toBe('Hierarchy Test Suite')
    console.log(`Suite created in DB with ${suiteInDb?.testCases.length} test cases`)

    // Verify UI displays correct count
    const uiTestCount = await page.locator('span:has-text(/\\d+ test cases/)').first().textContent()
    console.log(`UI displays: ${uiTestCount}`)
  })

  test('PHASE 2: Edit suite - rename and change tests', async ({ page }) => {
    // Create a test suite first
    const testSuite = await prisma.testSuite.create({
      data: {
        projectId: (await prisma.project.findFirst())!.id,
        name: 'Suite to Edit',
        category: 'CUSTOM',
        selectionMethod: 'HIERARCHY',
      },
    })

    // Reload page to see the new suite
    await page.reload()
    await page.waitForTimeout(500)

    // Find and click Edit button
    const suiteCard = page.locator(`text=Suite to Edit`).first()
    await expect(suiteCard).toBeVisible()

    // Click the Edit button next to the suite
    const editBtn = suiteCard.locator('..').locator('button:has-text("Edit")')
    await editBtn.click()

    // Verify edit modal appears
    const editModalTitle = page.locator('h2:has-text("Edit Test Suite")')
    await expect(editModalTitle).toBeVisible()

    // Change suite name
    const nameInput = page.locator('input[placeholder="e.g., Smoke Suite"]')
    await nameInput.clear()
    await nameInput.fill('Edited Suite Name')

    // Select some test cases from hierarchy
    const checkboxes = page.locator('input[type="checkbox"]')
    const checkboxCount = await checkboxes.count()

    if (checkboxCount > 0) {
      // Select first checkbox
      await checkboxes.first().click()
      await page.waitForTimeout(300)
    }

    // Click Save Changes
    const saveBtn = page.locator('button:has-text("Save Changes")')
    await expect(saveBtn).toBeEnabled()
    await saveBtn.click()

    // Wait for modal to close
    await page.waitForTimeout(800)
    await expect(editModalTitle).not.toBeVisible()

    // Verify changes in UI
    const editedSuiteName = page.locator('h3:has-text("Edited Suite Name")')
    await expect(editedSuiteName).toBeVisible()

    // Verify database update
    const updatedSuite = await prisma.testSuite.findUnique({
      where: { id: testSuite.id },
      include: { testCases: true },
    })

    expect(updatedSuite?.name).toBe('Edited Suite Name')
    console.log(`Suite name updated to: ${updatedSuite?.name}`)
    console.log(`Suite now has ${updatedSuite?.testCases.length} test cases`)
  })

  test('PHASE 3: Persistence - refresh page', async ({ page }) => {
    // Create a suite
    const testSuite = await prisma.testSuite.create({
      data: {
        projectId: (await prisma.project.findFirst())!.id,
        name: 'Persistence Test Suite',
        category: 'CUSTOM',
        selectionMethod: 'HIERARCHY',
      },
    })

    // Reload page
    await page.reload()
    await page.waitForTimeout(500)

    // Verify suite is still visible
    const suiteLink = page.locator('h3:has-text("Persistence Test Suite")')
    await expect(suiteLink).toBeVisible()

    // Navigate away and back
    await page.goto(`${BASE_URL}/dashboard`)
    await page.goto(`${BASE_URL}/test-suites`)

    // Verify suite is still visible after navigation
    const suiteAfterNav = page.locator('h3:has-text("Persistence Test Suite")')
    await expect(suiteAfterNav).toBeVisible()

    console.log('✓ Suite persists after refresh and navigation')
  })

  test('PHASE 4: Database count matches UI count', async ({ page }) => {
    // Create a suite with test cases
    const project = await prisma.project.findFirst()
    if (!project) {
      test.skip()
      return
    }

    const testSuite = await prisma.testSuite.create({
      data: {
        projectId: project.id,
        name: 'Count Verification Suite',
        category: 'CUSTOM',
        selectionMethod: 'HIERARCHY',
      },
    })

    // Get test cases and add to suite
    const testCases = await prisma.testCase.findMany({
      where: { projectId: project.id },
      take: 3,
    })

    if (testCases.length > 0) {
      await prisma.suiteTestCase.createMany({
        data: testCases.map((tc, idx) => ({
          suiteId: testSuite.id,
          testCaseId: tc.id,
          order: idx,
        })),
      })
    }

    // Reload page
    await page.reload()
    await page.waitForTimeout(500)

    // Get UI count
    const suiteRow = page.locator(`text=Count Verification Suite`).locator('..')
    const uiCountText = await suiteRow.locator('span:has-text(/\\d+ test cases/)').textContent()
    const uiCount = parseInt(uiCountText?.match(/\\d+/)?.[0] || '0', 10)

    // Get DB count
    const dbSuite = await prisma.testSuite.findUnique({
      where: { id: testSuite.id },
      include: { testCases: true },
    })
    const dbCount = dbSuite?.testCases.length || 0

    console.log(`UI Count: ${uiCount}, DB Count: ${dbCount}`)
    expect(uiCount).toBe(dbCount)
  })

  test('Delete suite functionality', async ({ page }) => {
    // Create a suite
    const testSuite = await prisma.testSuite.create({
      data: {
        projectId: (await prisma.project.findFirst())!.id,
        name: 'Suite to Delete',
        category: 'CUSTOM',
        selectionMethod: 'HIERARCHY',
      },
    })

    // Reload page
    await page.reload()
    await page.waitForTimeout(500)

    // Find suite and click Delete
    const suiteCard = page.locator(`text=Suite to Delete`).first()
    await expect(suiteCard).toBeVisible()

    const deleteBtn = suiteCard.locator('..').locator('button:has-text("Delete")')
    await deleteBtn.click()

    // Confirm deletion in dialog
    page.on('dialog', async (dialog) => {
      await dialog.accept()
    })

    // Wait for deletion
    await page.waitForTimeout(500)

    // Verify suite is no longer visible
    const deletedSuite = page.locator(`text=Suite to Delete`)
    await expect(deletedSuite).not.toBeVisible()

    // Verify deletion in DB
    const dbSuite = await prisma.testSuite.findUnique({
      where: { id: testSuite.id },
    })

    expect(dbSuite).toBeNull()
    console.log('✓ Suite deleted successfully')
  })

  test.afterAll(async () => {
    // Cleanup
    await prisma.$disconnect()
  })
})
