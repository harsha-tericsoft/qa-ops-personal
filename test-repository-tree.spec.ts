import { test, expect } from '@playwright/test'

test('Repository tree expansion', async ({ page }) => {
  test.setTimeout(60000)

  // First verify the API works
  const response = await page.goto('http://localhost:3000/api/repository?projectId=cmqttt49c000r7kygg73fmuqv')
  expect(response?.status()).toBe(200)

  const content = await page.textContent('body')
  expect(content).toContain('"nodes"')

  // Extract and verify nodes
  const bodyContent = await page.textContent('body')
  const json = JSON.parse(bodyContent || '{}')

  console.log(`Repository structure:`)
  console.log(`- Repository ID: ${json.id}`)
  console.log(`- Repository Name: ${json.name}`)
  console.log(`- Total nodes: ${json.nodes?.length || 0}`)

  if (json.nodes && json.nodes.length > 0) {
    // Show first few nodes
    console.log(`\nFirst 5 nodes:`)
    json.nodes.slice(0, 5).forEach((node: any, i: number) => {
      console.log(`  ${i + 1}. ${node.name} (type: ${node.type}, depth: ${node.depth})`)
    })
  }

  // Verify we have nodes
  expect(json.nodes).toBeDefined()
  expect(json.nodes?.length).toBeGreaterThan(0)
}, 60000)
