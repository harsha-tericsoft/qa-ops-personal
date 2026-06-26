# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-verify-repository-selector-fix.spec.ts >> Verify RepositoryTreeSelector Fix - Complete Workflow >> Complete workflow: Login → Create Suite → Verify Counts → Create Cycle
- Location: test-verify-repository-selector-fix.spec.ts:4:7

# Error details

```
Error: Cannot proceed: Create Test Suite button not visible
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
      - generic [ref=e11]:
        - generic [ref=e12]: QA
        - heading "QA Ops Platform" [level=1] [ref=e13]
        - paragraph [ref=e14]: Sign in to your account
      - generic [ref=e15]:
        - generic [ref=e16]:
          - generic [ref=e17]: Email Address
          - textbox "you@example.com" [ref=e18]
        - generic [ref=e19]:
          - generic [ref=e20]: Password
          - textbox "••••••••" [ref=e21]
        - button "Sign In" [ref=e22]
      - generic [ref=e23]:
        - heading "🧪 Test Credentials" [level=3] [ref=e24]
        - generic [ref=e25]:
          - paragraph [ref=e26]: "Lead Account:"
          - paragraph [ref=e27]: "Email: lead@test.com"
          - paragraph [ref=e28]: "Password: hashedpassword123"
        - generic [ref=e29]:
          - paragraph [ref=e30]: "QA Engineer Account:"
          - paragraph [ref=e31]: "Email: engineer@test.com"
          - paragraph [ref=e32]: "Password: hashedpassword456"
      - link "Forgot password?" [ref=e34] [cursor=pointer]:
        - /url: /forgot-password
  - button "Open Next.js Dev Tools" [ref=e40] [cursor=pointer]:
    - img [ref=e41]
  - alert [ref=e44]
```

# Test source

```ts
  1   | import { test, expect, Page } from '@playwright/test'
  2   | 
  3   | test.describe('Verify RepositoryTreeSelector Fix - Complete Workflow', () => {
  4   |   test('Complete workflow: Login → Create Suite → Verify Counts → Create Cycle', async ({ page, context }) => {
  5   |     test.setTimeout(180000)
  6   | 
  7   |     // Capture all console messages
  8   |     const consoleLogs: string[] = []
  9   |     const errors: string[] = []
  10  | 
  11  |     page.on('console', (msg) => {
  12  |       const text = `[${msg.type()}] ${msg.text()}`
  13  |       consoleLogs.push(text)
  14  |       if (msg.type() === 'error') {
  15  |         errors.push(text)
  16  |       }
  17  |       console.log(`BROWSER: ${text}`)
  18  |     })
  19  | 
  20  |     // Capture page errors
  21  |     page.on('pageerror', (error) => {
  22  |       const text = `[pageerror] ${error.message}`
  23  |       errors.push(text)
  24  |       console.log(`BROWSER ERROR: ${text}`)
  25  |     })
  26  | 
  27  |     // ========== STEP 1: LOGIN ==========
  28  |     console.log('\n========== STEP 1: LOGIN ==========')
  29  |     await page.goto('http://localhost:3000/auth/login', { waitUntil: 'domcontentloaded' })
  30  |     await page.waitForTimeout(1000)
  31  | 
  32  |     // Try to find and fill login form
  33  |     const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first()
  34  |     if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
  35  |       console.log('Found email input, logging in...')
  36  |       await emailInput.fill('test@example.com')
  37  |       await page.locator('input[type="password"]').fill('testpassword123')
  38  |       await page.locator('button:has-text("Login")').click()
  39  |       await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {
  40  |         console.log('Login redirect timed out, continuing...')
  41  |       })
  42  |     } else {
  43  |       console.log('Login form not found, skipping login (may already be authenticated)')
  44  |     }
  45  | 
  46  |     // ========== STEP 2: NAVIGATE TO TEST SUITES ==========
  47  |     console.log('\n========== STEP 2: NAVIGATE TO TEST SUITES ==========')
  48  |     await page.goto('http://localhost:3000/test-suites', { waitUntil: 'domcontentloaded' })
  49  |     await page.waitForTimeout(2000)
  50  | 
  51  |     // ========== STEP 3: OPEN CREATE TEST SUITE MODAL ==========
  52  |     console.log('\n========== STEP 3: OPEN CREATE TEST SUITE MODAL ==========')
  53  |     const createButton = page.locator('button:has-text("Create Test Suite")').first()
  54  |     const createButtonVisible = await createButton.isVisible({ timeout: 5000 }).catch(() => false)
  55  | 
  56  |     if (!createButtonVisible) {
  57  |       console.log('ERROR: Create Test Suite button not found')
  58  |       errors.push('Create Test Suite button not found - user may not be logged in or lack LEAD role')
> 59  |       throw new Error('Cannot proceed: Create Test Suite button not visible')
      |             ^ Error: Cannot proceed: Create Test Suite button not visible
  60  |     }
  61  | 
  62  |     console.log('✓ Create Test Suite button found')
  63  |     await createButton.click()
  64  |     await page.waitForTimeout(1500)
  65  | 
  66  |     // ========== STEP 4: VERIFY MODAL OPENED ==========
  67  |     console.log('\n========== STEP 4: VERIFY MODAL OPENED ==========')
  68  |     const modal = page.locator('[role="dialog"], div:has(input[placeholder*="Suite"])').first()
  69  |     const modalVisible = await modal.isVisible({ timeout: 5000 }).catch(() => false)
  70  | 
  71  |     if (!modalVisible) {
  72  |       console.log('ERROR: Modal did not open')
  73  |       errors.push('Modal failed to open')
  74  |       throw new Error('Cannot proceed: Modal not visible')
  75  |     }
  76  | 
  77  |     console.log('✓ Modal opened successfully')
  78  | 
  79  |     // ========== STEP 5: VERIFY REPOSITORY TREE LOADED ==========
  80  |     console.log('\n========== STEP 5: VERIFY REPOSITORY TREE LOADED ==========')
  81  |     const treeSelector = page.locator('text=/Select Test Cases/i').first()
  82  |     const treeVisible = await treeSelector.isVisible({ timeout: 5000 }).catch(() => false)
  83  | 
  84  |     if (!treeVisible) {
  85  |       console.log('ERROR: Repository Tree Selector not found')
  86  |       errors.push('Repository Tree Selector not visible')
  87  |       throw new Error('Cannot proceed: Repository Tree Selector not visible')
  88  |     }
  89  | 
  90  |     console.log('✓ Repository Tree Selector loaded')
  91  | 
  92  |     // ========== STEP 6: CHECK CONSOLE ERRORS SO FAR ==========
  93  |     console.log('\n========== STEP 6: CHECK CONSOLE ERRORS ==========')
  94  |     console.log(`Total console messages: ${consoleLogs.length}`)
  95  |     console.log(`Errors so far: ${errors.length}`)
  96  |     if (errors.length > 0) {
  97  |       console.log('ERRORS DETECTED:')
  98  |       errors.forEach((err) => console.log(`  - ${err}`))
  99  |     }
  100 | 
  101 |     // Check for TypeError about filter
  102 |     const filterErrors = consoleLogs.filter((log) => log.includes('filter') && log.includes('TypeError'))
  103 |     if (filterErrors.length > 0) {
  104 |       console.log('ERROR: Found testCases.filter errors:')
  105 |       filterErrors.forEach((err) => console.log(`  - ${err}`))
  106 |       throw new Error('testCases.filter error detected')
  107 |     }
  108 | 
  109 |     // ========== STEP 7: EXPAND TREE AND SELECT NODES ==========
  110 |     console.log('\n========== STEP 7: EXPAND TREE AND SELECT NODES ==========')
  111 | 
  112 |     // Get initial tree state
  113 |     const expandButtons = page.locator('button:has-text("▶"), button:has-text("▼")')
  114 |     const initialExpandCount = await expandButtons.count()
  115 |     console.log(`Found ${initialExpandCount} expand/collapse buttons`)
  116 | 
  117 |     // Expand first 3 nodes
  118 |     let expanded = 0
  119 |     for (let i = 0; i < Math.min(3, initialExpandCount); i++) {
  120 |       const button = expandButtons.nth(i)
  121 |       const text = await button.textContent()
  122 |       if (text?.includes('▶')) {
  123 |         console.log(`Expanding node ${i + 1}...`)
  124 |         await button.click()
  125 |         await page.waitForTimeout(300)
  126 |         expanded++
  127 |       }
  128 |     }
  129 | 
  130 |     console.log(`✓ Expanded ${expanded} nodes`)
  131 | 
  132 |     // Get all checkboxes
  133 |     const checkboxes = page.locator('input[type="checkbox"]')
  134 |     const checkboxCount = await checkboxes.count()
  135 |     console.log(`Found ${checkboxCount} checkboxes`)
  136 | 
  137 |     // Select first 5 checkboxes
  138 |     let selected = 0
  139 |     for (let i = 0; i < Math.min(5, checkboxCount); i++) {
  140 |       const checkbox = checkboxes.nth(i)
  141 |       const isChecked = await checkbox.isChecked()
  142 |       if (!isChecked) {
  143 |         await checkbox.click()
  144 |         await page.waitForTimeout(100)
  145 |         selected++
  146 |       }
  147 |     }
  148 | 
  149 |     console.log(`✓ Selected ${selected} test cases`)
  150 | 
  151 |     // ========== STEP 8: GET SELECTED COUNT FROM UI ==========
  152 |     console.log('\n========== STEP 8: GET SELECTED COUNT FROM UI ==========')
  153 |     const selectedCountText = page.locator('text=/tests? selected/i').first()
  154 |     const countVisible = await selectedCountText.isVisible({ timeout: 3000 }).catch(() => false)
  155 | 
  156 |     let selectedCount = 0
  157 |     if (countVisible) {
  158 |       const text = await selectedCountText.textContent()
  159 |       const match = text?.match(/(\d+)/)
```