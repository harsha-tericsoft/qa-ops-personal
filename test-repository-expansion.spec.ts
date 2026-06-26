import { test, expect } from '@playwright/test'

test('Repository tree expansion - UI interaction', async ({ page }) => {
  test.setTimeout(60000)

  // Navigate to dashboard
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' })

  // Look for repository section
  const repoSection = await page.locator('text=Repository').first()
  if (!repoSection) {
    console.log('Repository section not found in dashboard')
    return
  }

  // Check if there's a tree view or expandable items
  const treeItems = await page.locator('[role="treeitem"]').all()
  console.log(`Found ${treeItems.length} tree items`)

  // Try to expand first tree item
  if (treeItems.length > 0) {
    const firstItem = treeItems[0]
    console.log(`First item text: ${await firstItem.textContent()}`)

    // Look for expand button
    const expandButton = await firstItem.locator('[role="button"]').first()
    if (expandButton) {
      console.log('Expand button found')
      await expandButton.click()
      await page.waitForTimeout(500)

      // Check if children appeared
      const childItems = await page.locator('[role="treeitem"]').all()
      console.log(`After expansion: ${childItems.length} tree items`)
    }
  }

  // Take screenshot for manual inspection
  await page.screenshot({ path: 'repository-tree-screenshot.png' })
})
