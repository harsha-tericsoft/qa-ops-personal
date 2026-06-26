import { test, expect } from '@playwright/test'

test('Dashboard endpoint reliability - rapid sequential calls', async ({ page }) => {
  test.setTimeout(120000) // 2 minute timeout

  const projectId = 'cmqttt49c000r7kygg73fmuqv'
  const results: { status: number; time: number }[] = []

  // Make 15 rapid sequential calls to test reliability
  for (let i = 0; i < 15; i++) {
    const startTime = Date.now()
    const response = await page.goto(`http://localhost:3000/api/dashboard?projectId=${projectId}`)
    const endTime = Date.now()
    const time = endTime - startTime
    const status = response?.status() || 0
    results.push({ status, time })
    console.log(`Call ${i + 1}: ${status} (${time}ms)`)
  }

  // Count successes
  const successes = results.filter(r => r.status === 200).length
  const failures = results.filter(r => r.status !== 200).length
  const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length
  const maxTime = Math.max(...results.map(r => r.time))

  console.log(`\nTotal: ${results.length}`)
  console.log(`Success (200): ${successes}`)
  console.log(`Failures: ${failures}`)
  console.log(`Average time: ${avgTime.toFixed(0)}ms`)
  console.log(`Max time: ${maxTime}ms`)

  // Should have at least 90% success rate
  expect(successes).toBeGreaterThanOrEqual(13) // At least 13 out of 15
}, 120000)
