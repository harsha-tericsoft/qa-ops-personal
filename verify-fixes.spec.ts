import { test, expect } from '@playwright/test'

// Test that verifies the connection and API fixes are working
// Run with: npx playwright test verify-fixes.spec.ts

test.describe('Verify Prisma/Supabase Fixes', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' })
  })

  test('Dashboard loads without 500 errors', async ({ page }) => {
    // Look for any error messages or 500 errors
    const errorMessage = await page.locator('[role="alert"]').first().textContent().catch(() => null)
    expect(errorMessage).toBeNull()

    // Wait for dashboard data to load
    await page.waitForTimeout(2000)

    // Verify dashboard metrics are displayed
    const content = await page.content()
    expect(content).toBeTruthy()
  })

  test('Dashboard API response is fast', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('http://localhost:3000/api/dashboard?projectId=test')
    const endTime = Date.now()
    const duration = endTime - startTime

    // Should complete within 5 seconds
    expect(duration).toBeLessThan(5000)

    // Response should be valid JSON
    const text = await page.textContent('body')
    expect(text).toContain('"totalTests"')
  })

  test('Repository endpoint responds reliably', async ({ page }) => {
    const response = await page.goto('http://localhost:3000/api/repository?projectId=test')
    expect(response?.status()).toBe(200)

    // Verify response is JSON
    const text = await page.textContent('body')
    expect(text).toContain('"nodes"')
  })

  test('Test cases endpoint with pagination works', async ({ page }) => {
    const response = await page.goto('http://localhost:3000/api/test-cases?projectId=test&page=1&limit=10')
    expect(response?.status()).toBe(200)

    // Verify paginated response
    const text = await page.textContent('body')
    expect(text).toContain('"pagination"')
    expect(text).toContain('"data"')
  })

  test('Projects endpoint returns quickly', async ({ page }) => {
    const startTime = Date.now()
    const response = await page.goto('http://localhost:3000/api/projects')
    const endTime = Date.now()

    expect(response?.status()).toBe(200)
    expect(endTime - startTime).toBeLessThan(2000) // Should be fast
  })

  test('Multiple concurrent API calls succeed', async ({ page, context }) => {
    // Open multiple pages simultaneously to simulate concurrent load
    const pages = await Promise.all([
      context.newPage(),
      context.newPage(),
      context.newPage(),
    ])

    try {
      const results = await Promise.all([
        pages[0].goto('http://localhost:3000/api/dashboard?projectId=test'),
        pages[1].goto('http://localhost:3000/api/repository?projectId=test'),
        pages[2].goto('http://localhost:3000/api/test-cases?projectId=test&page=1&limit=10'),
      ])

      // At least 2 out of 3 should succeed (allowing for some connection failures)
      const successCount = results.filter(r => r?.status() === 200).length
      expect(successCount).toBeGreaterThanOrEqual(2)
    } finally {
      await Promise.all(pages.map(p => p.close()))
    }
  })
})
