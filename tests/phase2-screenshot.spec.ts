import { test } from '@playwright/test'

test('Capture modal screenshot', async ({ page }) => {
  const testUser = { id: 'cmqmjeko900007kfg2mant8kh', email: 'test@example.com', name: 'Test User', role: 'LEAD' }
  const token = 'test-token-' + Date.now()

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(({ user, token }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
  }, { user: testUser, token })

  await page.goto('http://localhost:3000/test-suites', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  const ps = page.locator('select')
  const opts = await page.locator('select > option').all()

  for (const opt of opts) {
    const text = await opt.textContent()
    if (text?.includes('Kinergy test') && !text?.includes('New') && !text?.includes('QA')) {
      const value = await opt.getAttribute('value')
      if (value) {
        await ps.selectOption(value)
        await page.waitForTimeout(2000)
        break
      }
    }
  }

  const cb = page.locator('button:has-text("Create Test Suite")').first()
  await cb.click()
  await page.waitForTimeout(1500)

  await page.screenshot({ path: 'modal-screenshot.png', fullPage: true })
  console.log('Screenshot saved: modal-screenshot.png')
})
