# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: final-verification.spec.ts >> Create Test Suite - Complete Workflow
- Location: final-verification.spec.ts:3:5

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.waitFor: Test timeout of 120000ms exceeded.
Call log:
  - waiting for locator('button:has-text("Create Test Suite")').first() to be visible

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
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | test('Create Test Suite - Complete Workflow', async ({ page }) => {
  4  |   test.setTimeout(120000)
  5  | 
  6  |   const BASE_URL = 'http://localhost:3000'
  7  |   const PROJECT_ID = 'cmqttt49c000r7kygg73fmuqv'
  8  | 
  9  |   // Track errors
  10 |   let consoleErrors: string[] = []
  11 |   page.on('console', msg => {
  12 |     if (msg.type() === 'error') {
  13 |       consoleErrors.push(msg.text())
  14 |     }
  15 |   })
  16 | 
  17 |   // STEP 1: Navigate to test suites
  18 |   console.log('Step 1: Navigating to test suites...')
  19 |   await page.goto(`${BASE_URL}/test-suites`)
  20 |   await page.waitForLoadState('networkidle')
  21 |   expect(consoleErrors).toHaveLength(0)
  22 |   console.log('✓ Page loaded without errors')
  23 | 
  24 |   // STEP 2: Click Create Test Suite
  25 |   console.log('Step 2: Opening create modal...')
  26 |   const createBtn = page.locator('button:has-text("Create Test Suite")').first()
> 27 |   await createBtn.waitFor()
     |                   ^ Error: locator.waitFor: Test timeout of 120000ms exceeded.
  28 |   await createBtn.click()
  29 |   await page.waitForTimeout(500)
  30 |   console.log('✓ Modal opened')
  31 | 
  32 |   // STEP 3: Wait for repository to load
  33 |   console.log('Step 3: Waiting for repository tree...')
  34 |   await page.waitForSelector('input[type="checkbox"]', { timeout: 10000 })
  35 |   console.log('✓ Repository loaded')
  36 | 
  37 |   // STEP 4: Fill suite name
  38 |   console.log('Step 4: Filling suite details...')
  39 |   const nameInput = page.locator('input[placeholder*="Smoke" i], input[placeholder*="Suite"]').first()
  40 |   await nameInput.fill(`Final Verification ${Date.now()}`)
  41 |   console.log('✓ Name filled')
  42 | 
  43 |   // STEP 5: Select test cases
  44 |   console.log('Step 5: Selecting test cases...')
  45 |   const checkboxes = page.locator('input[type="checkbox"]')
  46 |   const count = await checkboxes.count()
  47 |   console.log(`Found ${count} checkboxes`)
  48 | 
  49 |   // Select first 3
  50 |   for (let i = 0; i < Math.min(3, count); i++) {
  51 |     await checkboxes.nth(i).check()
  52 |     await page.waitForTimeout(100)
  53 |   }
  54 |   console.log('✓ Selected 3 test cases')
  55 | 
  56 |   // STEP 6: Verify UI shows correct count
  57 |   console.log('Step 6: Checking UI count display...')
  58 |   const countText = await page.locator('text=/\\d+ tests? selected/').first().textContent()
  59 |   console.log(`Count display: "${countText}"`)
  60 |   expect(countText).toMatch(/\d+ test/)
  61 |   console.log('✓ Count displayed')
  62 | 
  63 |   // STEP 7: Submit
  64 |   console.log('Step 7: Creating suite...')
  65 |   const submitBtn = page.locator('button:has-text("Create Suite")').last()
  66 |   await submitBtn.click()
  67 |   await page.waitForTimeout(1000)
  68 |   console.log('✓ Suite created')
  69 | 
  70 |   // STEP 8: Verify no errors
  71 |   if (consoleErrors.length > 0) {
  72 |     throw new Error(`Console errors: ${consoleErrors.join(', ')}`)
  73 |   }
  74 | 
  75 |   console.log('\n✅ COMPLETE WORKFLOW PASSED')
  76 |   console.log('✅ No console errors')
  77 |   console.log('✅ UI responsive')
  78 |   console.log('✅ Repository tree loads')
  79 |   console.log('✅ Test selection works')
  80 |   console.log('✅ Count displays correctly')
  81 | })
  82 | 
```