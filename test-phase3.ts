import { chromium } from 'playwright'

async function test() {
  const browser = await chromium.launch()
  const page = await browser.newContext().then(c => c.newPage())
  await page.setViewportSize({ width: 1920, height: 1080 })

  try {
    console.log('\n🚀 PHASE 3: EXECUTION DASHBOARD TEST\n')

    // Go to dashboard
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    // Check for selectors
    const selects = await page.locator('select').count()
    console.log(`📋 Selectors found: ${selects}`)

    // Get text content
    const body = await page.textContent('body')

    // Check for repository metrics
    const hasRepositoryMetrics = body?.includes('Repository Metrics')
    console.log(`\n📊 Repository Metrics: ${hasRepositoryMetrics ? '✅' : '❌'}`)
    console.log(`   Total Tests: ${body?.includes('2436') ? '✅' : '❌'}`)

    // Check for execution controls
    const hasExecutionSelection = body?.includes('Project & Execution')
    console.log(`\n⚙️  Execution Selection: ${hasExecutionSelection ? '✅' : '❌'}`)
    const hasProjectLabel = body?.includes('Execution Cycle')
    console.log(`   Project/Cycle/Version selectors: ${hasProjectLabel ? '✅' : '❌'}`)

    // Check for cycles
    console.log(`\n🔄 Execution Cycles:`)
    const cycleCount = await page.locator('select').nth(1).locator('option').count()
    console.log(`   Available cycles: ${cycleCount}`)

    // Try to select cycle if available
    if (cycleCount > 1) {
      await page.locator('select').nth(1).selectOption({ index: 1 })
      await page.waitForTimeout(2000)

      const versionCount = await page.locator('select').nth(2).locator('option').count()
      console.log(`   Available versions: ${versionCount}`)

      if (versionCount > 1) {
        await page.locator('select').nth(2).selectOption({ index: 1 })
        await page.waitForTimeout(2000)

        const hasExecutionMetrics = body?.includes('Execution Metrics')
        console.log(`\n📈 Execution Metrics: ${hasExecutionMetrics ? '✅ (may load after select)' : '⏳'}`)
      }
    }

    // Screenshot
    await page.screenshot({ path: './phase3-execution-dashboard.png', fullPage: true })
    console.log('\n📸 Screenshot saved\n')

  } catch (err) {
    console.error('ERROR:', err)
  } finally {
    await browser.close()
  }
}

test()
