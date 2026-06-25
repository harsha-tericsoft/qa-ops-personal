# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\phase-2-ui-verification.spec.ts >> Phase 2 UI Verification - Test Cases Page >> 2. Summary cards display correct values
- Location: tests\phase-2-ui-verification.spec.ts:82:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.textContent: Target page, context or browser has been closed
Call log:
  - waiting for locator('text=Total Tests').locator('..').locator('text=/^\\d+$/')

```

# Test source

```ts
  1   | import { test, expect, Page } from '@playwright/test'
  2   | import * as fs from 'fs'
  3   | import * as path from 'path'
  4   | 
  5   | // Create evidence folder
  6   | const evidenceDir = path.join(process.cwd(), 'phase-2-evidence')
  7   | if (!fs.existsSync(evidenceDir)) {
  8   |   fs.mkdirSync(evidenceDir, { recursive: true })
  9   | }
  10  | 
  11  | test.describe('Phase 2 UI Verification - Test Cases Page', () => {
  12  |   let page: Page
  13  |   const consoleLogs: Array<{ type: string; message: string }> = []
  14  |   const consoleErrors: string[] = []
  15  | 
  16  |   test.beforeEach(async ({ browser }) => {
  17  |     page = await browser.newPage()
  18  | 
  19  |     // Capture console messages
  20  |     page.on('console', (msg) => {
  21  |       consoleLogs.push({
  22  |         type: msg.type(),
  23  |         message: msg.text(),
  24  |       })
  25  | 
  26  |       if (msg.type() === 'error') {
  27  |         consoleErrors.push(msg.text())
  28  |       }
  29  |     })
  30  | 
  31  |     // Capture uncaught exceptions
  32  |     page.on('pageerror', (error) => {
  33  |       consoleErrors.push(`Uncaught Exception: ${error.message}`)
  34  |     })
  35  |   })
  36  | 
  37  |   test.afterEach(async () => {
  38  |     await page.close()
  39  |   })
  40  | 
  41  |   test('1. Page loads and displays summary cards', async () => {
  42  |     console.log('Test 1: Page loads and displays summary cards')
  43  | 
  44  |     await page.goto('http://localhost:3000/test-cases', {
  45  |       waitUntil: 'networkidle',
  46  |       timeout: 30000,
  47  |     })
  48  | 
  49  |     // Wait for page to be ready
  50  |     await page.waitForLoadState('domcontentloaded')
  51  |     await page.waitForTimeout(2000)
  52  | 
  53  |     // Take screenshot of full page
  54  |     await page.screenshot({
  55  |       path: path.join(evidenceDir, '01-page-loads-full.png'),
  56  |       fullPage: true,
  57  |     })
  58  | 
  59  |     // Verify header
  60  |     const header = await page.locator('h1').first()
  61  |     await expect(header).toContainText('Test Cases')
  62  |     console.log('✅ Header found: "Test Cases"')
  63  | 
  64  |     // Verify summary cards exist
  65  |     const summaryCards = await page.locator('[class*="bg-blue-50"], [class*="bg-purple-50"], [class*="bg-green-50"]')
  66  |     const cardCount = await summaryCards.count()
  67  |     console.log(`✅ Found ${cardCount} summary cards`)
  68  | 
  69  |     // Verify filter panel
  70  |     const filterPanel = await page.locator('text=FILTERS')
  71  |     await expect(filterPanel).toBeVisible()
  72  |     console.log('✅ Filter panel visible')
  73  | 
  74  |     // Verify test grid
  75  |     const testGrid = await page.locator('table, [role="grid"]').first()
  76  |     await expect(testGrid).toBeVisible()
  77  |     console.log('✅ Test grid visible')
  78  | 
  79  |     console.log('Test 1: PASS\n')
  80  |   })
  81  | 
  82  |   test('2. Summary cards display correct values', async () => {
  83  |     console.log('Test 2: Summary cards display correct values')
  84  | 
  85  |     await page.goto('http://localhost:3000/test-cases', {
  86  |       waitUntil: 'networkidle',
  87  |     })
  88  | 
  89  |     await page.waitForTimeout(2000)
  90  | 
  91  |     // Look for "Total Tests" card with value
  92  |     const totalTestsCard = await page.locator('text=Total Tests').locator('..').locator('text=/^\\d+$/')
> 93  |     const totalValue = await totalTestsCard.textContent()
      |                                             ^ Error: locator.textContent: Target page, context or browser has been closed
  94  |     console.log(`✅ Total Tests: ${totalValue}`)
  95  | 
  96  |     // Verify the values are numeric
  97  |     expect(totalValue).toMatch(/^\d+$/)
  98  | 
  99  |     // Screenshot of summary cards section
  100 |     const cardsSection = await page.locator('[class*="grid"][class*="gap"]').first()
  101 |     await cardsSection.screenshot({
  102 |       path: path.join(evidenceDir, '02-summary-cards.png'),
  103 |     })
  104 | 
  105 |     console.log('Test 2: PASS\n')
  106 |   })
  107 | 
  108 |   test('3. Filter panel renders with all filter options', async () => {
  109 |     console.log('Test 3: Filter panel renders with all filter options')
  110 | 
  111 |     await page.goto('http://localhost:3000/test-cases', {
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
```