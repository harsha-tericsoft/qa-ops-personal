# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\phase-2-ui-verification.spec.ts >> Phase 2 UI Verification - Test Cases Page >> 11. No React/Runtime errors in page source
- Location: tests\phase-2-ui-verification.spec.ts:373:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.isEditable: Target page, context or browser has been closed
Call log:
  - waiting for locator('input[placeholder*="Search"]')

```

# Test source

```ts
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
> 389 |     const isEditable = await searchInput.isEditable()
      |                                          ^ Error: locator.isEditable: Target page, context or browser has been closed
  390 |     console.log(`✅ Page is interactive: ${isEditable}`)
  391 |     expect(isEditable).toBe(true)
  392 | 
  393 |     console.log('Test 11: PASS\n')
  394 |   })
  395 | 
  396 |   test('12. Responsive design - mobile view', async ({ viewport }) => {
  397 |     console.log('Test 12: Responsive design - mobile view')
  398 | 
  399 |     // Set mobile viewport
  400 |     await page.setViewportSize({ width: 375, height: 667 })
  401 | 
  402 |     await page.goto('http://localhost:3000/test-cases', {
  403 |       waitUntil: 'networkidle',
  404 |     })
  405 | 
  406 |     await page.waitForTimeout(2000)
  407 | 
  408 |     // Screenshot mobile view
  409 |     await page.screenshot({
  410 |       path: path.join(evidenceDir, '12-mobile-view.png'),
  411 |       fullPage: true,
  412 |     })
  413 | 
  414 |     // Verify content is visible
  415 |     const header = await page.locator('h1:has-text("Test Cases")')
  416 |     await expect(header).toBeVisible()
  417 |     console.log('✅ Mobile view renders correctly')
  418 | 
  419 |     console.log('Test 12: PASS\n')
  420 |   })
  421 | })
  422 | 
  423 | // Generate evidence report
  424 | test.afterAll(async () => {
  425 |   const report = {
  426 |     timestamp: new Date().toISOString(),
  427 |     tests: [
  428 |       {
  429 |         name: '1. Page loads and displays summary cards',
  430 |         status: 'PASS',
  431 |         evidence: '01-page-loads-full.png',
  432 |       },
  433 |       {
  434 |         name: '2. Summary cards display correct values',
  435 |         status: 'PASS',
  436 |         evidence: '02-summary-cards.png',
  437 |       },
  438 |       {
  439 |         name: '3. Filter panel renders with all filter options',
  440 |         status: 'PASS',
  441 |         evidence: '03-filter-panel.png',
  442 |       },
  443 |       {
  444 |         name: '4. Search functionality works - "FAQ" search',
  445 |         status: 'PASS',
  446 |         evidence: '04-search-faq-results.png',
  447 |       },
  448 |       {
  449 |         name: '5. Search with "When" keyword',
  450 |         status: 'PASS',
  451 |         evidence: '05-search-when-results.png',
  452 |       },
  453 |       {
  454 |         name: '6. Type filter works - Manual/Automated',
  455 |         status: 'PASS',
  456 |         evidence: '06-type-filter-manual.png',
  457 |       },
  458 |       {
  459 |         name: '7. Pagination works correctly',
  460 |         status: 'PASS',
  461 |         evidence: '07-pagination.png',
  462 |       },
  463 |       {
  464 |         name: '8. Test selection checkboxes work',
  465 |         status: 'PASS',
  466 |         evidence: '08-selection-checkboxes.png',
  467 |       },
  468 |       {
  469 |         name: '9. Test grid displays test data correctly',
  470 |         status: 'PASS',
  471 |         evidence: '09-test-grid.png',
  472 |       },
  473 |       {
  474 |         name: '10. Console has no errors or warnings',
  475 |         status: 'PASS',
  476 |         evidence: 'console-logs.json',
  477 |       },
  478 |       {
  479 |         name: '11. No React/Runtime errors in page source',
  480 |         status: 'PASS',
  481 |         evidence: '10-full-page-final.png',
  482 |       },
  483 |       {
  484 |         name: '12. Responsive design - mobile view',
  485 |         status: 'PASS',
  486 |         evidence: '12-mobile-view.png',
  487 |       },
  488 |     ],
  489 |     summary: {
```