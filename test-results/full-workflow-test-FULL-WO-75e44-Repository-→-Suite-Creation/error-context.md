# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full-workflow-test.spec.ts >> FULL WORKFLOW: Login → Dashboard → Repository → Suite Creation
- Location: full-workflow-test.spec.ts:11:5

# Error details

```
Error: locator.isVisible: Error: strict mode violation: locator('text=/metrics|tests|dashboard/i') resolved to 9 elements:
    1) <div class="font-medium text-sm">Dashboard</div> aka getByRole('link', { name: '📊 Dashboard QA health' })
    2) <div class="text-xs text-gray-500">Organize tests for execution</div> aka getByRole('link', { name: '📦 Test Suites Organize tests' })
    3) <div class="text-xs text-gray-500">Execute and track tests</div> aka getByRole('link', { name: '🔄 Execution Cycles Execute' })
    4) <h1 class="text-4xl font-bold text-gray-900">QA Execution Dashboard</h1> aka getByRole('heading', { name: 'QA Execution Dashboard' })
    5) <h2 class="text-2xl font-bold text-gray-900">Repository Metrics</h2> aka getByRole('heading', { name: 'Repository Metrics' })
    6) <div class="text-sm font-medium text-gray-600">Total Tests</div> aka getByText('Total Tests')
    7) <div class="text-sm font-medium text-gray-600">Manual Tests</div> aka getByText('Manual Tests')
    8) <div class="text-sm font-medium text-gray-600">Automated Tests</div> aka getByText('Automated Tests')
    9) <p class="text-amber-700 mt-2">Choose an execution cycle and version to view exe…</p> aka getByText('Choose an execution cycle and')

Call log:
    - checking visibility of locator('text=/metrics|tests|dashboard/i')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - generic [ref=e3]:
      - link "QA QA Ops Platform" [ref=e4] [cursor=pointer]:
        - /url: /
        - generic [ref=e5]: QA
        - heading "QA Ops Platform" [level=1] [ref=e6]
      - generic [ref=e7]:
        - generic [ref=e8]: 👑 Lead
        - button "J John Lead ▼" [ref=e10]:
          - generic [ref=e11]: J
          - generic [ref=e12]: John Lead
          - generic [ref=e13]: ▼
  - generic [ref=e14]:
    - complementary [ref=e15]:
      - navigation [ref=e16]:
        - link "📊 Dashboard QA health overview" [ref=e17] [cursor=pointer]:
          - /url: /dashboard
          - generic [ref=e18]: 📊
          - generic [ref=e19]:
            - generic [ref=e20]: Dashboard
            - generic [ref=e21]: QA health overview
        - link "📁 Projects Manage projects" [ref=e22] [cursor=pointer]:
          - /url: /projects
          - generic [ref=e23]: 📁
          - generic [ref=e24]:
            - generic [ref=e25]: Projects
            - generic [ref=e26]: Manage projects
        - link "🌳 Repository View imported test hierarchy" [ref=e27] [cursor=pointer]:
          - /url: /repository
          - generic [ref=e28]: 🌳
          - generic [ref=e29]:
            - generic [ref=e30]: Repository
            - generic [ref=e31]: View imported test hierarchy
        - link "✅ Test Cases View imported test cases" [ref=e32] [cursor=pointer]:
          - /url: /test-cases
          - generic [ref=e33]: ✅
          - generic [ref=e34]:
            - generic [ref=e35]: Test Cases
            - generic [ref=e36]: View imported test cases
        - link "📦 Test Suites Organize tests for execution" [ref=e37] [cursor=pointer]:
          - /url: /test-suites
          - generic [ref=e38]: 📦
          - generic [ref=e39]:
            - generic [ref=e40]: Test Suites
            - generic [ref=e41]: Organize tests for execution
        - link "🔄 Execution Cycles Execute and track tests" [ref=e42] [cursor=pointer]:
          - /url: /cycles
          - generic [ref=e43]: 🔄
          - generic [ref=e44]:
            - generic [ref=e45]: Execution Cycles
            - generic [ref=e46]: Execute and track tests
    - main [ref=e47]:
      - main [ref=e48]:
        - generic [ref=e49]:
          - heading "QA Execution Dashboard" [level=1] [ref=e50]
          - paragraph [ref=e51]: Enterprise test execution and analytics
        - generic [ref=e52]:
          - heading "Project & Execution Selection" [level=2] [ref=e53]
          - generic [ref=e54]:
            - generic [ref=e55]:
              - generic [ref=e56]: Project
              - combobox [ref=e57]:
                - option "-- Choose Project --"
                - option "Kinergy" [selected]
                - option "Dummy"
                - option "Clean Env Test Project"
                - option "Test Project - Depth Fix Verification"
                - option "Test Project - Fresh"
                - option "Test Project - Fresh"
                - option "Test Project - Fresh"
            - generic [ref=e58]:
              - generic [ref=e59]: Execution Cycle
              - combobox [ref=e60]:
                - option "-- Choose Cycle --" [selected]
                - option "Auto Cycle (PLANNED)"
                - option "Auto Cycle (PLANNED)"
                - option "Test Cycle 1782414289936 (PLANNED)"
                - option "Kin Smole and Auto (PLANNED)"
            - generic [ref=e61]:
              - generic [ref=e62]: Version
              - combobox [disabled] [ref=e63]:
                - option "-- Choose Version --" [selected]
        - generic [ref=e64]:
          - heading "Repository Metrics" [level=2] [ref=e65]
          - generic [ref=e66]:
            - generic [ref=e67] [cursor=pointer]:
              - generic [ref=e68]: Total Tests
              - generic [ref=e69]: "2435"
            - generic [ref=e70] [cursor=pointer]:
              - generic [ref=e71]: Manual Tests
              - generic [ref=e72]: "2372"
            - generic [ref=e73] [cursor=pointer]:
              - generic [ref=e74]: Automated Tests
              - generic [ref=e75]: "63"
            - generic [ref=e76] [cursor=pointer]:
              - generic [ref=e77]: Automation Coverage
              - generic [ref=e78]: 2.6%
          - generic [ref=e79]:
            - generic [ref=e80] [cursor=pointer]:
              - generic [ref=e81]: Draft Cycles
              - generic [ref=e82]: "4"
            - generic [ref=e83] [cursor=pointer]:
              - generic [ref=e84]: Active Cycles
              - generic [ref=e85]: "0"
            - generic [ref=e86] [cursor=pointer]:
              - generic [ref=e87]: Completed Cycles
              - generic [ref=e88]: "0"
          - generic [ref=e90]:
            - strong [ref=e91]: "Last Sync:"
            - text: 6/25/2026, 11:22:12 AM (SUCCESS)
        - generic [ref=e92]:
          - generic [ref=e93]: ⚙️
          - heading "Select a Version" [level=3] [ref=e94]
          - paragraph [ref=e95]: Choose an execution cycle and version to view execution metrics
  - button "Open Next.js Dev Tools" [ref=e101] [cursor=pointer]:
    - img [ref=e102]
  - alert [ref=e105]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | const BASE_URL = 'http://localhost:3000'
  4  | 
  5  | // Test credentials from the app
  6  | const TEST_CREDENTIALS = {
  7  |   email: 'lead@test.com',
  8  |   password: 'hashedpassword123'
  9  | }
  10 | 
  11 | test('FULL WORKFLOW: Login → Dashboard → Repository → Suite Creation', async ({ page }) => {
  12 |   console.log('\n=== FULL WORKFLOW TEST ===\n')
  13 | 
  14 |   // Step 1: Login
  15 |   console.log('Step 1: Login')
  16 |   await page.goto(`${BASE_URL}/login`)
  17 |   await page.fill('input[type="email"]', TEST_CREDENTIALS.email)
  18 |   await page.fill('input[type="password"]', TEST_CREDENTIALS.password)
  19 |   await page.click('button[type="submit"]')
  20 |   await page.waitForNavigation()
  21 |   await page.waitForTimeout(2000)
  22 | 
  23 |   console.log('✓ Logged in successfully')
  24 | 
  25 |   // Step 2: Dashboard
  26 |   console.log('\nStep 2: Test Dashboard')
  27 |   await page.goto(`${BASE_URL}/dashboard`)
  28 |   await page.waitForLoadState('networkidle')
  29 | 
  30 |   // Select a project
  31 |   await page.selectOption('select', 'cmqttt49c000r7kygg73fmuqv')
  32 |   await page.waitForTimeout(3000)
  33 | 
  34 |   // Check if metrics load
> 35 |   const metricsVisible = await page.locator('text=/metrics|tests|dashboard/i').isVisible()
     |                                                                                ^ Error: locator.isVisible: Error: strict mode violation: locator('text=/metrics|tests|dashboard/i') resolved to 9 elements:
  36 |   console.log(`✓ Metrics visible: ${metricsVisible}`)
  37 | 
  38 |   // Step 3: Repository
  39 |   console.log('\nStep 3: Test Repository Page')
  40 |   await page.goto(`${BASE_URL}/repository`)
  41 |   await page.waitForLoadState('networkidle')
  42 | 
  43 |   const hasRepositoryContent = await page.content().then(html =>
  44 |     html.includes('Repository') || html.includes('Test Hierarchy')
  45 |   )
  46 |   console.log(`✓ Repository page loaded: ${hasRepositoryContent}`)
  47 | 
  48 |   // Step 4: Test Cases
  49 |   console.log('\nStep 4: Test Test Cases Page')
  50 |   await page.goto(`${BASE_URL}/test-cases`)
  51 |   await page.waitForLoadState('networkidle')
  52 | 
  53 |   const testCasesContent = await page.content()
  54 |   const hasTestCases = testCasesContent.length > 20000 // Non-login page is larger
  55 |   console.log(`✓ Test cases page loaded: ${hasTestCases}`)
  56 | 
  57 |   // Step 5: Test Suites
  58 |   console.log('\nStep 5: Test Test Suites Page')
  59 |   await page.goto(`${BASE_URL}/test-suites`)
  60 |   await page.waitForLoadState('networkidle')
  61 | 
  62 |   const suitesContent = await page.content()
  63 |   const hasSuites = suitesContent.length > 20000
  64 |   console.log(`✓ Test suites page loaded: ${hasSuites}`)
  65 | 
  66 |   console.log('\n=== WORKFLOW COMPLETE ===')
  67 | })
  68 | 
```