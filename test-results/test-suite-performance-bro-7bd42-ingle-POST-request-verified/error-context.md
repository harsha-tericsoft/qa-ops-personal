# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-suite-performance-browser.spec.ts >> Test Suite Creation - Performance & Correctness >> should create suite with 10 tests - single POST request verified
- Location: test-suite-performance-browser.spec.ts:11:7

# Error details

```
Error: locator.textContent: Error: strict mode violation: locator('h1') resolved to 2 elements:
    1) <h1 class="text-xl font-bold text-gray-900">QA Ops Platform</h1> aka getByRole('link', { name: 'QA QA Ops Platform' })
    2) <h1 class="text-3xl font-bold text-white">QA Ops Platform</h1> aka getByRole('main').getByRole('heading', { name: 'QA Ops Platform' })

Call log:
  - waiting for locator('h1')

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
  3   | test.describe('Test Suite Creation - Performance & Correctness', () => {
  4   |   let projectId: string
  5   | 
  6   |   test.beforeAll(async () => {
  7   |     // Use known project from previous test runs
  8   |     projectId = 'cmqttt49c000r7kygg73fmuqv'
  9   |   })
  10  | 
  11  |   test('should create suite with 10 tests - single POST request verified', async ({
  12  |     page,
  13  |   }) => {
  14  |     test.setTimeout(60000)
  15  | 
  16  |     const requests: string[] = []
  17  | 
  18  |     // Monitor network requests
  19  |     page.on('request', (request) => {
  20  |       if (request.url().includes('/api/test-suites')) {
  21  |         requests.push(`${request.method()} ${request.url()}`)
  22  |       }
  23  |     })
  24  | 
  25  |     // Navigate to test suites page
  26  |     await page.goto('http://localhost:3000/test-suites')
  27  |     await page.waitForLoadState('networkidle')
  28  | 
  29  |     // Verify page loaded
> 30  |     expect(await page.locator('h1').textContent()).toContain('Test Suites')
      |                                     ^ Error: locator.textContent: Error: strict mode violation: locator('h1') resolved to 2 elements:
  31  | 
  32  |     // Open create modal
  33  |     await page.click('button:has-text("Create Test Suite")')
  34  |     await page.waitForSelector('[class*="modal"]', { timeout: 5000 })
  35  | 
  36  |     // Fill suite details
  37  |     const suiteName = `Browser Test Suite ${Date.now()}`
  38  |     await page.fill('input[placeholder="e.g., Smoke Suite"]', suiteName)
  39  |     await page.fill(
  40  |       'input[placeholder="Suite description"]',
  41  |       'Created via browser test'
  42  |     )
  43  | 
  44  |     // Select first 10 tests from tree
  45  |     await page.waitForSelector('[class*="Repository"]', { timeout: 10000 })
  46  |     const checkboxes = await page.$$('input[type="checkbox"]')
  47  |     const testsToSelect = Math.min(10, checkboxes.length)
  48  |     for (let i = 0; i < testsToSelect; i++) {
  49  |       await checkboxes[i].check()
  50  |     }
  51  | 
  52  |     // Verify selection count updated
  53  |     const selectedText = await page.locator(
  54  |       'text=/\\d+ tests? selected/'
  55  |     ).textContent()
  56  |     expect(selectedText).toContain('selected')
  57  | 
  58  |     // Clear previous requests and monitor creation
  59  |     const creationRequests: string[] = []
  60  |     page.removeAllListeners('request')
  61  |     page.on('request', (request) => {
  62  |       if (
  63  |         request.method() === 'POST' &&
  64  |         request.url().includes('/api/test-suites')
  65  |       ) {
  66  |         creationRequests.push(request.url())
  67  |       }
  68  |     })
  69  | 
  70  |     // Submit form and wait for completion
  71  |     const responsePromise = page.waitForResponse(
  72  |       (response) =>
  73  |         response.url().includes('/api/test-suites') &&
  74  |         response.status() === 201
  75  |     )
  76  | 
  77  |     await page.click('button:has-text("Create Suite")')
  78  | 
  79  |     const response = await responsePromise
  80  |     const suite = await response.json()
  81  | 
  82  |     // ASSERTION: Exactly one POST request
  83  |     console.log(`POST requests to /api/test-suites: ${creationRequests.length}`)
  84  |     expect(creationRequests.length).toBe(1)
  85  | 
  86  |     // Verify suite created correctly
  87  |     expect(suite.id).toBeDefined()
  88  |     expect(suite.name).toBe(suiteName)
  89  |     expect(suite.testCases).toBeDefined()
  90  |     expect(suite.testCases.length).toBeGreaterThan(0)
  91  | 
  92  |     // Verify UI updated immediately (no separate fetch)
  93  |     await page.waitForSelector(`text=${suiteName}`, { timeout: 5000 })
  94  |     const suiteElement = page.locator(`text=${suiteName}`)
  95  |     expect(await suiteElement.count()).toBeGreaterThan(0)
  96  | 
  97  |     // Verify no duplicate entries
  98  |     const suiteCount = await suiteElement.count()
  99  |     console.log(`Suite appears in UI: ${suiteCount} time(s)`)
  100 |     expect(suiteCount).toBe(1)
  101 | 
  102 |     console.log('✓ Suite created with single POST request')
  103 |     console.log(`✓ Suite ID: ${suite.id}`)
  104 |     console.log(`✓ Test count: ${suite.testCases.length}`)
  105 |   })
  106 | 
  107 |   test('should handle suite editing without unnecessary refetch', async ({
  108 |     page,
  109 |   }) => {
  110 |     test.setTimeout(60000)
  111 | 
  112 |     // Navigate to test suites
  113 |     await page.goto('http://localhost:3000/test-suites')
  114 |     await page.waitForLoadState('networkidle')
  115 | 
  116 |     // Find first suite and edit it
  117 |     const editButtons = await page.$$('button:has-text("Edit")')
  118 |     if (editButtons.length === 0) {
  119 |       console.log('No suites to edit, skipping test')
  120 |       test.skip()
  121 |       return
  122 |     }
  123 | 
  124 |     const suiteRow = editButtons[0].locator('..')
  125 |     const originalName = await suiteRow
  126 |       .locator('h3')
  127 |       .textContent()
  128 | 
  129 |     // Click edit button
  130 |     await editButtons[0].click()
```