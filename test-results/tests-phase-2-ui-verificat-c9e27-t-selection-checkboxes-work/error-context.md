# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\phase-2-ui-verification.spec.ts >> Phase 2 UI Verification - Test Cases Page >> 8. Test selection checkboxes work
- Location: tests\phase-2-ui-verification.spec.ts:268:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.textContent: Target page, context or browser has been closed
Call log:
  - waiting for locator('text=/\\d+ test.*selected/')

```

# Test source

```ts
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
  212 |     await searchInput.fill('')
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
> 296 |     const selectionText = await page.locator('text=/\\d+ test.*selected/').textContent()
      |                                                                            ^ Error: locator.textContent: Target page, context or browser has been closed
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
  313 |     await gridArea.screenshot({
  314 |       path: path.join(evidenceDir, '09-test-grid.png'),
  315 |     })
  316 | 
  317 |     // Verify test data is displayed
  318 |     const rows = await page.locator('tr, [role="row"]')
  319 |     const rowCount = await rows.count()
  320 |     console.log(`✅ Test grid displays ${rowCount} rows`)
  321 | 
  322 |     // Look for "When I" pattern (common in test statements)
  323 |     const pageText = await page.locator('body').textContent()
  324 |     const whenICount = (pageText?.match(/When I/gi) || []).length
  325 |     console.log(`✅ Test statements found: ${whenICount} "When I" patterns`)
  326 | 
  327 |     console.log('Test 9: PASS\n')
  328 |   })
  329 | 
  330 |   test('10. Console has no errors or warnings', async () => {
  331 |     console.log('Test 10: Console has no errors or warnings')
  332 | 
  333 |     await page.goto('http://localhost:3000/test-cases', {
  334 |       waitUntil: 'networkidle',
  335 |     })
  336 | 
  337 |     await page.waitForTimeout(3000)
  338 | 
  339 |     // Check for console errors
  340 |     console.log('Console Messages:')
  341 |     consoleLogs.forEach((log) => {
  342 |       if (log.type !== 'log') {
  343 |         console.log(`  [${log.type.toUpperCase()}] ${log.message}`)
  344 |       }
  345 |     })
  346 | 
  347 |     // Check for uncaught exceptions
  348 |     if (consoleErrors.length > 0) {
  349 |       console.log('❌ Console Errors Found:')
  350 |       consoleErrors.forEach((error) => {
  351 |         console.log(`  - ${error}`)
  352 |       })
  353 |     } else {
  354 |       console.log('✅ No console errors detected')
  355 |     }
  356 | 
  357 |     // Take final screenshot
  358 |     await page.screenshot({
  359 |       path: path.join(evidenceDir, '10-full-page-final.png'),
  360 |       fullPage: true,
  361 |     })
  362 | 
  363 |     // Save console logs for review
  364 |     fs.writeFileSync(
  365 |       path.join(evidenceDir, 'console-logs.json'),
  366 |       JSON.stringify(consoleLogs, null, 2)
  367 |     )
  368 | 
  369 |     expect(consoleErrors).toHaveLength(0)
  370 |     console.log('Test 10: PASS\n')
  371 |   })
  372 | 
  373 |   test('11. No React/Runtime errors in page source', async () => {
  374 |     console.log('Test 11: No React/Runtime errors in page source')
  375 | 
  376 |     await page.goto('http://localhost:3000/test-cases', {
  377 |       waitUntil: 'networkidle',
  378 |     })
  379 | 
  380 |     await page.waitForTimeout(2000)
  381 | 
  382 |     // Check for React error boundaries
  383 |     const errorBoundaries = await page.locator('text=/Something went wrong|Error Boundary/i').count()
  384 |     console.log(`✅ Error boundaries: ${errorBoundaries}`)
  385 |     expect(errorBoundaries).toBe(0)
  386 | 
  387 |     // Check page is interactive
  388 |     const searchInput = await page.locator('input[placeholder*="Search"]')
  389 |     const isEditable = await searchInput.isEditable()
  390 |     console.log(`✅ Page is interactive: ${isEditable}`)
  391 |     expect(isEditable).toBe(true)
  392 | 
  393 |     console.log('Test 11: PASS\n')
  394 |   })
  395 | 
  396 |   test('12. Responsive design - mobile view', async ({ viewport }) => {
```