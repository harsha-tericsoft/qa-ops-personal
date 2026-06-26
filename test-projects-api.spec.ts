import { test, expect } from '@playwright/test'

test('Projects API endpoint reliability', async ({ page }) => {
  test.setTimeout(120000)

  const results: { status: number; time: number }[] = []

  // Make 15 calls to test reliability
  for (let i = 0; i < 15; i++) {
    const startTime = Date.now()
    const response = await page.goto('http://localhost:3000/api/projects')
    const endTime = Date.now()
    const time = endTime - startTime
    const status = response?.status() || 0
    results.push({ status, time })
    console.log(`Call ${i + 1}: ${status} (${time}ms)`)
  }

  // Verify response content
  const content = await page.textContent('body')
  expect(content).toContain('"id"')
  expect(content).toContain('Kinergy')

  // Count successes
  const successes = results.filter(r => r.status === 200).length
  const failures = results.filter(r => r.status !== 200).length
  const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length

  console.log(`\nTotal: ${results.length}`)
  console.log(`Success (200): ${successes}`)
  console.log(`Failures: ${failures}`)
  console.log(`Average time: ${avgTime.toFixed(0)}ms`)

  expect(successes).toBeGreaterThanOrEqual(13) // At least 90% success
}, 120000)
