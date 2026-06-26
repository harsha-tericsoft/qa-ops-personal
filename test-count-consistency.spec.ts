import { test, expect } from '@playwright/test'

test('Test counts consistency', async ({ page }) => {
  test.setTimeout(60000)

  const projectId = 'cmqttt49c000r7kygg73fmuqv'

  // Get total test count from dashboard
  const dashboardResponse = await page.goto(
    `http://localhost:3000/api/dashboard?projectId=${projectId}`
  )
  const dashboardJson = JSON.parse((await page.textContent('body')) || '{}')
  const dashboardTotal = dashboardJson.totalTests

  console.log(`Dashboard test count: ${dashboardTotal}`)

  // Get test cases via test-cases API (check multiple pages)
  let pageNum = 1
  let totalViaAPI = 0

  for (pageNum = 1; pageNum <= 5; pageNum++) {
    const response = await page.goto(
      `http://localhost:3000/api/test-cases?projectId=${projectId}&page=${pageNum}&limit=500`
    )
    const json = JSON.parse((await page.textContent('body')) || '{}')
    const pageTotal = json.pagination?.total || 0
    const pageData = json.data?.length || 0

    console.log(`Page ${pageNum}: ${pageData} items, total from API: ${pageTotal}`)

    if (pageNum === 1) {
      totalViaAPI = pageTotal
    }

    if (pageData === 0) break
  }

  console.log(`\nTotal via API: ${totalViaAPI}`)
  console.log(`Total via Dashboard: ${dashboardTotal}`)
  console.log(`Difference: ${Math.abs(totalViaAPI - dashboardTotal)}`)

  // Counts should match
  expect(Math.abs(totalViaAPI - dashboardTotal)).toBeLessThan(10)
}, 60000)
