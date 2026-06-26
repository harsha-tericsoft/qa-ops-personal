# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-suite-bug.spec.ts >> Bug: Test Suite loses selected test cases after creation >> should persist 21 selected test cases after suite creation
- Location: test-suite-bug.spec.ts:7:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[type="email"]')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - link "QA QA Ops Platform" [ref=e4] [cursor=pointer]:
      - /url: /
      - generic [ref=e5]: QA
      - heading "QA Ops Platform" [level=1] [ref=e6]
  - main [ref=e8]:
    - generic [ref=e10]:
      - heading "404" [level=1] [ref=e11]
      - heading "This page could not be found." [level=2] [ref=e13]
  - button "Open Next.js Dev Tools" [ref=e19] [cursor=pointer]:
    - img [ref=e20]
  - alert [ref=e23]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test'
  2   | 
  3   | // Test project ID from the database - used in other tests
  4   | const TEST_PROJECT_ID = 'cmqttt49c000r7kygg73fmuqv'
  5   | 
  6   | test.describe('Bug: Test Suite loses selected test cases after creation', () => {
  7   |   test('should persist 21 selected test cases after suite creation', async ({ page, context }) => {
  8   |     // Setup: Open DevTools
  9   |     const networkLog: any[] = []
  10  |     page.on('response', async (response) => {
  11  |       if (response.url().includes('/api/test-suites') || response.url().includes('/api/test-cases')) {
  12  |         networkLog.push({
  13  |           url: response.url(),
  14  |           method: response.request().method(),
  15  |           status: response.status(),
  16  |           body: await response.text().catch(() => 'N/A'),
  17  |           time: new Date().toISOString(),
  18  |         })
  19  |       }
  20  |     })
  21  | 
  22  |     // Step 0: Login
  23  |     console.log('\n=== STEP 0: LOGIN ===')
  24  |     await page.goto('http://localhost:3000/auth/login')
> 25  |     await page.fill('input[type="email"]', 'test@example.com')
      |                ^ Error: page.fill: Test timeout of 30000ms exceeded.
  26  |     await page.fill('input[type="password"]', 'testpassword123')
  27  |     await page.click('button:has-text("Login")')
  28  |     await page.waitForURL('http://localhost:3000/dashboard', { timeout: 10000 }).catch(() => {
  29  |       console.log('Login redirect timed out, continuing anyway...')
  30  |     })
  31  | 
  32  |     // Step 1: Navigate to Test Suites
  33  |     console.log('\n=== STEP 1: Navigate to Test Suites ===')
  34  |     await page.goto('http://localhost:3000/test-suites', { waitUntil: 'networkidle' })
  35  |     await page.waitForTimeout(2000)
  36  | 
  37  |     // Step 2: Click "Create Test Suite" button
  38  |     console.log('\n=== STEP 2: Open Create Suite Modal ===')
  39  |     const createButton = page.locator('button:has-text("Create Test Suite")').first()
  40  | 
  41  |     // Wait for button to be visible (it's only visible if logged in with LEAD role)
  42  |     await createButton.waitFor({ timeout: 5000 }).catch(() => {
  43  |       console.error('Create Test Suite button not found - user may not be logged in or does not have LEAD role')
  44  |       throw new Error('Create Test Suite button not found')
  45  |     })
  46  | 
  47  |     await createButton.click()
  48  | 
  49  |     // Wait for modal/dialog to appear
  50  |     const modal = page.locator('[role="dialog"]').first()
  51  |     await modal.waitFor({ timeout: 5000 }).catch(() => {
  52  |       console.log('Modal did not appear, looking for alternative modal container...')
  53  |     })
  54  | 
  55  |     // Step 3: Check suite name input is visible
  56  |     const suiteNameInput = page.locator('input[placeholder*="Smoke Suite"]').first()
  57  |     await expect(suiteNameInput).toBeVisible()
  58  | 
  59  |     // Step 4: Enter suite name
  60  |     console.log('\n=== STEP 3: Enter Suite Name ===')
  61  |     await suiteNameInput.fill('Bug Test Suite 21')
  62  | 
  63  |     // Step 5: Locate and interact with repository tree
  64  |     console.log('\n=== STEP 4: Open Repository Tree ===')
  65  |     const treeContainer = page.locator('div:has-text("Select Test Cases")')
  66  |     await expect(treeContainer).toBeVisible()
  67  | 
  68  |     // Step 6: Expand first few nodes to find test cases
  69  |     console.log('\n=== STEP 5: Expand Tree and Select Test Cases ===')
  70  |     const expandButtons = page.locator('button:has-text("▶"), button:has-text("▼")')
  71  |     let expandCount = 0
  72  |     for (let i = 0; i < expandButtons.count() && expandCount < 5; i++) {
  73  |       try {
  74  |         const button = expandButtons.nth(i)
  75  |         const text = await button.textContent()
  76  |         if (text?.includes('▶')) {
  77  |           await button.click()
  78  |           expandCount++
  79  |           await page.waitForTimeout(300)
  80  |         }
  81  |       } catch (e) {
  82  |         // Skip if can't expand
  83  |       }
  84  |     }
  85  | 
  86  |     // Step 7: Get all available checkboxes in the tree
  87  |     const checkboxes = page.locator('input[type="checkbox"]')
  88  |     const checkboxCount = await checkboxes.count()
  89  |     console.log(`Found ${checkboxCount} checkboxes in tree`)
  90  | 
  91  |     // Step 8: Select exactly 21 test cases (or as many as available)
  92  |     const selectCount = Math.min(21, checkboxCount - 1) // -1 to skip any root checkbox
  93  |     console.log(`Selecting ${selectCount} test cases...`)
  94  | 
  95  |     for (let i = 1; i <= selectCount; i++) {
  96  |       const checkbox = checkboxes.nth(i)
  97  |       const isChecked = await checkbox.isChecked()
  98  |       if (!isChecked) {
  99  |         await checkbox.check()
  100 |         await page.waitForTimeout(100)
  101 |       }
  102 |     }
  103 | 
  104 |     // Step 9: Verify selection count is shown
  105 |     console.log('\n=== STEP 6: Verify Selection Count ===')
  106 |     const selectedCount = page.locator('text=/\\d+\\s+test[s]?\\s+selected/')
  107 |     await expect(selectedCount).toBeVisible()
  108 |     const selectedText = await selectedCount.textContent()
  109 |     console.log(`Selected count displayed: ${selectedText}`)
  110 | 
  111 |     // Step 10: Extract the number from the selection text
  112 |     const numberMatch = selectedText?.match(/(\d+)/)
  113 |     const expectedCount = numberMatch ? parseInt(numberMatch[1]) : 0
  114 |     console.log(`Expected test case count: ${expectedCount}`)
  115 | 
  116 |     // Step 11: Click Create Suite button
  117 |     console.log('\n=== STEP 7: Create Suite ===')
  118 |     await page.click('button:has-text("Create Suite")')
  119 | 
  120 |     // Wait for success message or modal to close
  121 |     await page.waitForTimeout(2000)
  122 |     await page.waitForLoadState('networkidle')
  123 | 
  124 |     console.log('\n=== STEP 8: Check POST Request ===')
  125 |     const createRequest = networkLog.find(r => r.url.includes('/api/test-suites') && r.method === 'POST')
```