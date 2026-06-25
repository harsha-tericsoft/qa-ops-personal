import { chromium } from 'playwright'

async function checkHandlerAttached() {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.setViewportSize({ width: 1920, height: 1080 })

  console.log('🔐 Logging in...')
  await page.goto('http://localhost:3000/login')
  await page.fill('input[placeholder="you@example.com"]', 'lead@test.com')
  await page.fill('input[placeholder="••••••••"]', 'hashedpassword123')
  await page.click('button:has-text("Sign In")')
  await page.waitForURL('http://localhost:3000/dashboard')

  console.log('📄 Going to test-cases...')
  await page.goto('http://localhost:3000/test-cases', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  console.log('\n🔍 Inspecting select-all checkbox...')
  const handlerInfo = await page.evaluate(() => {
    const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement
    if (!checkbox) return { error: 'Checkbox not found' }

    const info = {
      element: checkbox.outerHTML.substring(0, 200),
      checked: checkbox.checked,
      disabled: checkbox.disabled,
      hasOwnProperty_onchange: checkbox.hasOwnProperty('onchange'),
      onchange_value: (checkbox as any).onchange,
      listeners_count: 'N/A',
      parent: checkbox.parentElement?.className || 'unknown',
    }

    // Try to see React fiber
    const fiberKey = Object.keys(checkbox).find(key => key.startsWith('__react'))
    console.log('[DEBUG] Checkbox fiber key:', fiberKey)

    return info
  })

  console.log('Checkbox info:', handlerInfo)

  // Now try clicking and see what events fire
  console.log('\n🎯 Listening for events on first checkbox...')
  await page.evaluate(() => {
    const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement
    if (!checkbox) return

    // Add our own listeners
    checkbox.addEventListener('change', () => {
      console.log('[MANUAL_LISTENER] change event fired')
    })
    checkbox.addEventListener('input', () => {
      console.log('[MANUAL_LISTENER] input event fired')
    })
    checkbox.addEventListener('click', () => {
      console.log('[MANUAL_LISTENER] click event fired')
    })
  })

  // Capture browser console
  page.on('console', (msg) => {
    if (msg.text().includes('[MANUAL_LISTENER]') || msg.text().includes('[DEBUG]')) {
      console.log(`[BROWSER] ${msg.text()}`)
    }
  })

  console.log('Clicking checkbox...')
  await page.locator('input[type="checkbox"]').first().click()
  await page.waitForTimeout(2000)

  console.log('\n✓ Test complete')
  await browser.close()
}

checkHandlerAttached().catch(console.error)
