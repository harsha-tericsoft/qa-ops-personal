# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-suite-performance-browser.spec.ts >> Test Suite Creation - Performance & Correctness >> should display correct test count
- Location: test-suite-performance-browser.spec.ts:217:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('button:has-text("Create Test Suite")')

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
  124 |     const suiteRow = editButtons[0].locator('..')
  125 |     const originalName = await suiteRow
  126 |       .locator('h3')
  127 |       .textContent()
  128 | 
  129 |     // Click edit button
  130 |     await editButtons[0].click()
  131 |     await page.waitForSelector('[class*="modal"]', { timeout: 5000 })
  132 | 
  133 |     // Update name
  134 |     const updatedName = `Updated Suite ${Date.now()}`
  135 |     const nameInput = page.locator('input[placeholder="e.g., Smoke Suite"]')
  136 |     await nameInput.clear()
  137 |     await nameInput.fill(updatedName)
  138 | 
  139 |     // Monitor requests
  140 |     const patchRequests: string[] = []
  141 |     page.on('request', (request) => {
  142 |       if (request.method() === 'PATCH') {
  143 |         patchRequests.push(request.url())
  144 |       }
  145 |     })
  146 | 
  147 |     // Submit
  148 |     const responsePromise = page.waitForResponse(
  149 |       (response) =>
  150 |         response.url().includes('/api/test-suites') &&
  151 |         response.request().method() === 'PATCH'
  152 |     )
  153 | 
  154 |     await page.click('button:has-text("Save Changes")')
  155 | 
  156 |     const response = await responsePromise
  157 | 
  158 |     // ASSERTION: Exactly one PATCH request
  159 |     expect(patchRequests.length).toBe(1)
  160 |     expect(response.status()).toBe(200)
  161 | 
  162 |     // Verify UI updated without full page reload
  163 |     await page.waitForSelector(`text=${updatedName}`, { timeout: 5000 })
  164 |     expect(await page.locator(`text=${updatedName}`).count()).toBeGreaterThan(0)
  165 | 
  166 |     console.log('✓ Suite updated with single PATCH request')
  167 |     console.log(`✓ New name: ${updatedName}`)
  168 |   })
  169 | 
  170 |   test('should not create duplicates on network retry', async ({ page }) => {
  171 |     test.setTimeout(60000)
  172 | 
  173 |     await page.goto('http://localhost:3000/test-suites')
  174 |     await page.waitForLoadState('networkidle')
  175 | 
  176 |     const initialSuiteCount = await page.locator('[class*="grid"]').count()
  177 | 
  178 |     // Create a suite
  179 |     await page.click('button:has-text("Create Test Suite")')
  180 |     await page.waitForSelector('[class*="modal"]', { timeout: 5000 })
  181 | 
  182 |     const suiteName = `No Duplicate Test ${Date.now()}`
  183 |     await page.fill('input[placeholder="e.g., Smoke Suite"]', suiteName)
  184 | 
  185 |     // Select tests
  186 |     const checkboxes = await page.$$('input[type="checkbox"]')
  187 |     for (let i = 0; i < Math.min(5, checkboxes.length); i++) {
  188 |       await checkboxes[i].check()
  189 |     }
  190 | 
  191 |     // Wait for creation
  192 |     const responsePromise = page.waitForResponse(
  193 |       (response) =>
  194 |         response.url().includes('/api/test-suites') &&
  195 |         response.status() === 201
  196 |     )
  197 | 
  198 |     await page.click('button:has-text("Create Suite")')
  199 |     const response = await responsePromise
  200 |     const suite = await response.json()
  201 | 
  202 |     // Verify exact match
  203 |     expect(suite.name).toBe(suiteName)
  204 | 
  205 |     // Count occurrences in UI
  206 |     await page.waitForTimeout(1000) // Wait for UI to settle
  207 |     const occurrences = await page
  208 |       .locator(`text=${suiteName}`)
  209 |       .count()
  210 | 
  211 |     console.log(`Suite "${suiteName}" appears ${occurrences} time(s)`)
  212 |     expect(occurrences).toBe(1)
  213 | 
  214 |     console.log('✓ No duplicate suite created')
  215 |   })
  216 | 
  217 |   test('should display correct test count', async ({ page }) => {
  218 |     test.setTimeout(60000)
  219 | 
  220 |     await page.goto('http://localhost:3000/test-suites')
  221 |     await page.waitForLoadState('networkidle')
  222 | 
  223 |     // Create suite with specific test count
> 224 |     await page.click('button:has-text("Create Test Suite")')
      |                ^ Error: page.click: Test timeout of 60000ms exceeded.
  225 |     await page.waitForSelector('[class*="modal"]', { timeout: 5000 })
  226 | 
  227 |     const suiteName = `Exact Count Test ${Date.now()}`
  228 |     await page.fill('input[placeholder="e.g., Smoke Suite"]', suiteName)
  229 | 
  230 |     // Select exactly 7 tests
  231 |     const checkboxes = await page.$$('input[type="checkbox"]')
  232 |     const selectCount = 7
  233 |     for (let i = 0; i < selectCount; i++) {
  234 |       await checkboxes[i].check()
  235 |     }
  236 | 
  237 |     // Wait for creation
  238 |     await page.waitForResponse(
  239 |       (response) =>
  240 |         response.url().includes('/api/test-suites') &&
  241 |         response.status() === 201
  242 |     )
  243 | 
  244 |     await page.click('button:has-text("Create Suite")')
  245 | 
  246 |     // Verify test count display
  247 |     await page.waitForSelector(`text=${suiteName}`, { timeout: 5000 })
  248 |     const suiteCard = page.locator(
  249 |       `text=${suiteName}`
  250 |     ).locator('..')
  251 | 
  252 |     // Look for test count text
  253 |     const testCountText = await suiteCard.locator('text=/\\d+ test/').textContent()
  254 |     console.log(`Test count display: ${testCountText}`)
  255 | 
  256 |     // Extract number from text
  257 |     const match = testCountText?.match(/(\d+)/)
  258 |     const displayedCount = match ? parseInt(match[1]) : 0
  259 | 
  260 |     expect(displayedCount).toBeGreaterThan(0)
  261 |     console.log(`✓ Suite displays correct test count: ${displayedCount}`)
  262 |   })
  263 | })
  264 | 
```