import { chromium } from 'playwright'

async function debug() {
  const browser = await chromium.launch()
  const page = await browser.newContext().then(c => c.newPage())

  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  // Login
  await page.goto('http://localhost:3000/login')
  await page.fill('input[placeholder="you@example.com"]', 'lead@test.com')
  await page.fill('input[placeholder="••••••••"]', 'hashedpassword123')
  await page.click('button:has-text("Sign In")')
  await page.waitForURL('http://localhost:3000/dashboard', { timeout: 15000 })
  
  // Check dashboard
  console.log('\n=== DASHBOARD DEBUG ===')
  const dashboardHTML = await page.content()
  const hasKPI = dashboardHTML.includes('Total Tests') || dashboardHTML.includes('Manual')
  console.log(`Dashboard has KPI content: ${hasKPI}`)
  
  const dashboardText = await page.textContent('body')
  if (dashboardText) {
    console.log(`Dashboard text length: ${dashboardText.length}`)
    console.log(`Contains "Draft": ${dashboardText.includes('Draft')}`)
    console.log(`Contains "Active": ${dashboardText.includes('Active')}`)
  }

  // Check test-cases and Create Suite button
  console.log('\n=== TEST CASES DEBUG ===')
  await page.goto('http://localhost:3000/test-cases', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // Select tests
  const checkboxes = await page.locator('input[type="checkbox"]')
  await checkboxes.first().click()
  await page.waitForTimeout(1500)

  // Check Create Suite button state
  const createBtn = await page.locator('button:has-text("Create Suite")').first()
  const isDisabled = await createBtn.evaluate(btn => (btn as HTMLButtonElement).disabled)
  const isVisible = await createBtn.isVisible().catch(() => false)
  
  console.log(`Create Suite button visible: ${isVisible}`)
  console.log(`Create Suite button disabled: ${isDisabled}`)

  if (isDisabled) {
    console.log(`Button HTML: ${await createBtn.evaluate(btn => btn.outerHTML)}`)
  }

  // Check modal
  console.log('\n=== MODAL DEBUG ===')
  if (isVisible) {
    await createBtn.click()
    await page.waitForTimeout(2000)
    
    const modal = await page.$('[role="dialog"], .modal')
    if (modal) {
      const modalHTML = await modal.evaluate(el => el.outerHTML.substring(0, 500))
      console.log(`Modal found: ${!!modal}`)
      console.log(`Modal HTML: ${modalHTML}`)
    } else {
      console.log('Modal not found in DOM')
    }
  }

  // Console errors
  console.log('\n=== CONSOLE ERRORS ===')
  console.log(`Total errors: ${errors.length}`)
  errors.slice(0, 5).forEach((e, i) => console.log(`${i+1}. ${e.substring(0, 100)}`))

  await browser.close()
}

debug().catch(console.error)
