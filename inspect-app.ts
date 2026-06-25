import { chromium } from 'playwright'

async function inspectApp() {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  console.log('Loading app...')
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' })

  // Take screenshot
  await page.screenshot({ path: 'app-homepage.png', fullPage: true })
  console.log('📸 Screenshot: app-homepage.png')

  // Check what page we're on
  const url = page.url()
  const title = await page.title()
  const bodyText = await page.textContent('body')

  console.log(`\nURL: ${url}`)
  console.log(`Title: ${title}`)
  console.log(`Body text length: ${bodyText?.length || 0} chars`)

  // Check if we need to login
  const loginForm = await page.$('input[type="password"]')
  if (loginForm) {
    console.log('⚠️  Login form detected - app requires authentication')
    await browser.close()
    return
  }

  // Navigate to test-cases page
  console.log('\nNavigating to test-cases...')
  await page.goto('http://localhost:3000/test-cases', { waitUntil: 'networkidle' })

  // Take screenshot
  await page.screenshot({ path: 'test-cases-page.png', fullPage: true })
  console.log('📸 Screenshot: test-cases-page.png')

  // Inspect the page structure
  const buttons = await page.locator('button').count()
  const inputs = await page.locator('input[type="checkbox"]').count()
  const selects = await page.locator('select').count()

  console.log(`\nPage Structure:`)
  console.log(`- Buttons: ${buttons}`)
  console.log(`- Checkboxes: ${inputs}`)
  console.log(`- Select elements: ${selects}`)

  // List all buttons
  const buttonTexts = await page.locator('button').allTextContents()
  console.log(`\nButton labels found:`)
  buttonTexts.slice(0, 10).forEach(text => {
    if (text.trim()) console.log(`  - "${text.trim()}"`)
  })

  // Check for test cases table/grid
  const tableRows = await page.locator('tr').count()
  const gridItems = await page.locator('[role="row"]').count()
  const divs = await page.locator('div').count()

  console.log(`\nContent Structure:`)
  console.log(`- Table rows: ${tableRows}`)
  console.log(`- Grid items (role=row): ${gridItems}`)

  // Get page HTML and look for specific patterns
  const html = await page.content()
  console.log(`\nHTML patterns:`)
  console.log(`- Contains "test": ${html.includes('test')}`)
  console.log(`- Contains "Test Case": ${html.includes('Test Case')}`)
  console.log(`- Contains "selected": ${html.includes('selected')}`)
  console.log(`- Contains "Preview": ${html.includes('Preview')}`)
  console.log(`- Contains "Create Suite": ${html.includes('Create Suite')}`)
  console.log(`- Contains "checkbox": ${html.includes('checkbox')}`)

  // Try to find what text is actually on the page
  const allText = await page.textContent('body')
  const lines = allText?.split('\n').filter(l => l.trim().length > 5).slice(0, 30) || []
  console.log(`\nFirst 30 non-empty text lines:`)
  lines.forEach((line, i) => {
    console.log(`${i + 1}. ${line.trim().substring(0, 100)}`)
  })

  await browser.close()
}

inspectApp().catch(console.error)
