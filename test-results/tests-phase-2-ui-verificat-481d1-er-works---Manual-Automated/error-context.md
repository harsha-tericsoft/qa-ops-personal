# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\phase-2-ui-verification.spec.ts >> Phase 2 UI Verification - Test Cases Page >> 6. Type filter works - Manual/Automated
- Location: tests\phase-2-ui-verification.spec.ts:201:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Target page, context or browser has been closed
Call log:
  - waiting for locator('input[placeholder*="Search"]')

```

# Test source

```ts
  112 |       waitUntil: 'networkidle',
  113 |     })
  114 | 
  115 |     await page.waitForTimeout(2000)
  116 | 
  117 |     // Take screenshot of filter panel
  118 |     const filterPanel = await page.locator('h2:has-text("Filters")').locator('..').locator('..')
  119 |     await filterPanel.screenshot({
  120 |       path: path.join(evidenceDir, '03-filter-panel.png'),
  121 |     })
  122 | 
  123 |     // Verify search field
  124 |     const searchInput = await page.locator('input[placeholder*="Search"]')
  125 |     await expect(searchInput).toBeVisible()
  126 |     console.log('✅ Search field visible')
  127 | 
  128 |     // Verify Type dropdown
  129 |     const typeDropdown = await page.locator('select').filter({ hasText: /Manual|Automated/ })
  130 |     const typeCount = await typeDropdown.count()
  131 |     console.log(`✅ Type selector found (${typeCount} dropdowns)`)
  132 | 
  133 |     console.log('Test 3: PASS\n')
  134 |   })
  135 | 
  136 |   test('4. Search functionality works - "FAQ" search', async () => {
  137 |     console.log('Test 4: Search functionality works - "FAQ" search')
  138 | 
  139 |     await page.goto('http://localhost:3000/test-cases', {
  140 |       waitUntil: 'networkidle',
  141 |     })
  142 | 
  143 |     await page.waitForTimeout(2000)
  144 | 
  145 |     // Find and fill search field
  146 |     const searchInput = await page.locator('input[placeholder*="Search"]')
  147 |     await searchInput.fill('FAQ')
  148 |     await page.waitForTimeout(2000)
  149 | 
  150 |     // Screenshot of search results
  151 |     await page.screenshot({
  152 |       path: path.join(evidenceDir, '04-search-faq-results.png'),
  153 |       fullPage: true,
  154 |     })
  155 | 
  156 |     // Verify results are displayed
  157 |     const testRows = await page.locator('table tbody tr, [role="grid"] > div:nth-child(n+2)')
  158 |     const rowCount = await testRows.count()
  159 |     console.log(`✅ FAQ search returned ${rowCount} results`)
  160 | 
  161 |     // Look for FAQ in visible text
  162 |     const pageText = await page.locator('body').textContent()
  163 |     const faqCount = (pageText?.match(/FAQ/g) || []).length
  164 |     console.log(`✅ "FAQ" appears ${faqCount} times in results`)
  165 | 
  166 |     console.log('Test 4: PASS\n')
  167 |   })
  168 | 
  169 |   test('5. Search with "When" keyword', async () => {
  170 |     console.log('Test 5: Search with "When" keyword')
  171 | 
  172 |     await page.goto('http://localhost:3000/test-cases', {
  173 |       waitUntil: 'networkidle',
  174 |     })
  175 | 
  176 |     await page.waitForTimeout(2000)
  177 | 
  178 |     // Clear previous search
  179 |     const searchInput = await page.locator('input[placeholder*="Search"]')
  180 |     await searchInput.fill('')
  181 |     await page.waitForTimeout(1000)
  182 | 
  183 |     // Search for "When"
  184 |     await searchInput.fill('When')
  185 |     await page.waitForTimeout(2000)
  186 | 
  187 |     // Screenshot
  188 |     await page.screenshot({
  189 |       path: path.join(evidenceDir, '05-search-when-results.png'),
  190 |       fullPage: true,
  191 |     })
  192 | 
  193 |     // Verify results
  194 |     const pageText = await page.locator('body').textContent()
  195 |     const whenCount = (pageText?.match(/When/gi) || []).length
  196 |     console.log(`✅ "When" appears ${whenCount} times in results`)
  197 | 
  198 |     console.log('Test 5: PASS\n')
  199 |   })
  200 | 
  201 |   test('6. Type filter works - Manual/Automated', async () => {
  202 |     console.log('Test 6: Type filter works - Manual/Automated')
  203 | 
  204 |     await page.goto('http://localhost:3000/test-cases', {
  205 |       waitUntil: 'networkidle',
  206 |     })
  207 | 
  208 |     await page.waitForTimeout(2000)
  209 | 
  210 |     // Clear search first
  211 |     const searchInput = await page.locator('input[placeholder*="Search"]')
> 212 |     await searchInput.fill('')
      |                       ^ Error: locator.fill: Target page, context or browser has been closed
  213 |     await page.waitForTimeout(1000)
  214 | 
  215 |     // Find Type dropdown
  216 |     const typeSelects = await page.locator('select')
  217 |     const typeSelect = typeSelects.last()
  218 | 
  219 |     // Select Manual
  220 |     await typeSelect.selectOption('Manual')
  221 |     await page.waitForTimeout(2000)
  222 | 
  223 |     // Screenshot after filtering
  224 |     await page.screenshot({
  225 |       path: path.join(evidenceDir, '06-type-filter-manual.png'),
  226 |       fullPage: true,
  227 |     })
  228 | 
  229 |     console.log('✅ Type filter dropdown works')
  230 |     console.log('Test 6: PASS\n')
  231 |   })
  232 | 
  233 |   test('7. Pagination works correctly', async () => {
  234 |     console.log('Test 7: Pagination works correctly')
  235 | 
  236 |     await page.goto('http://localhost:3000/test-cases', {
  237 |       waitUntil: 'networkidle',
  238 |     })
  239 | 
  240 |     await page.waitForTimeout(2000)
  241 | 
  242 |     // Look for pagination controls
  243 |     const previousButton = await page.locator('button:has-text("Previous")')
  244 |     const nextButton = await page.locator('button:has-text("Next")')
  245 |     const pageIndicator = await page.locator('text=/Page \\d+ of \\d+/')
  246 | 
  247 |     // Verify pagination elements exist
  248 |     const pageText = await pageIndicator.textContent()
  249 |     console.log(`✅ Pagination found: "${pageText}"`)
  250 | 
  251 |     // Screenshot pagination
  252 |     const paginationArea = await page.locator('button:has-text("Previous"), button:has-text("Next")')
  253 |     await paginationArea.first().screenshot({
  254 |       path: path.join(evidenceDir, '07-pagination.png'),
  255 |     })
  256 | 
  257 |     // Click next
  258 |     await nextButton.click()
  259 |     await page.waitForTimeout(2000)
  260 | 
  261 |     // Verify page changed
  262 |     const newPageText = await pageIndicator.textContent()
  263 |     console.log(`✅ Pagination navigation works: "${newPageText}"`)
  264 | 
  265 |     console.log('Test 7: PASS\n')
  266 |   })
  267 | 
  268 |   test('8. Test selection checkboxes work', async () => {
  269 |     console.log('Test 8: Test selection checkboxes work')
  270 | 
  271 |     await page.goto('http://localhost:3000/test-cases', {
  272 |       waitUntil: 'networkidle',
  273 |     })
  274 | 
  275 |     await page.waitForTimeout(2000)
  276 | 
  277 |     // Find first test checkbox (not Select All)
  278 |     const checkboxes = await page.locator('input[type="checkbox"]')
  279 |     const checkboxCount = await checkboxes.count()
  280 |     console.log(`✅ Found ${checkboxCount} checkboxes`)
  281 | 
  282 |     // Click a test checkbox (skip Select All which is first)
  283 |     if (checkboxCount > 1) {
  284 |       const testCheckbox = checkboxes.nth(1)
  285 |       await testCheckbox.click()
  286 |       await page.waitForTimeout(1000)
  287 |     }
  288 | 
  289 |     // Screenshot with selection
  290 |     await page.screenshot({
  291 |       path: path.join(evidenceDir, '08-selection-checkboxes.png'),
  292 |       fullPage: true,
  293 |     })
  294 | 
  295 |     // Look for selection counter
  296 |     const selectionText = await page.locator('text=/\\d+ test.*selected/').textContent()
  297 |     console.log(`✅ Selection indicator: "${selectionText}"`)
  298 | 
  299 |     console.log('Test 8: PASS\n')
  300 |   })
  301 | 
  302 |   test('9. Test grid displays test data correctly', async () => {
  303 |     console.log('Test 9: Test grid displays test data correctly')
  304 | 
  305 |     await page.goto('http://localhost:3000/test-cases', {
  306 |       waitUntil: 'networkidle',
  307 |     })
  308 | 
  309 |     await page.waitForTimeout(2000)
  310 | 
  311 |     // Screenshot of test grid
  312 |     const gridArea = await page.locator('table, [role="grid"]').first()
```