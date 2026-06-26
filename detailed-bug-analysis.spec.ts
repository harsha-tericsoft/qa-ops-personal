import { test, expect } from '@playwright/test'
import * as fs from 'fs'

const BASE_URL = 'http://localhost:3000'

test('DETAILED: Dashboard page structure and errors', async ({ page }) => {
  console.log('\n=== DETAILED ANALYSIS: Dashboard ===')

  const errors: string[] = []
  const networkErrors: any[] = []

  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
    console.log(`[${msg.type()}] ${msg.text()}`)
  })

  page.on('response', response => {
    if (response.status() >= 400) {
      networkErrors.push({
        url: response.url(),
        status: response.status(),
        method: response.request().method()
      })
      console.log(`❌ ${response.status()} ${response.url()}`)
    }
  })

  console.log('Loading dashboard...')
  await page.goto(`${BASE_URL}/dashboard`, { timeout: 15000 })
  await page.waitForTimeout(3000)

  // Check page title
  const title = await page.title()
  console.log(`Page title: ${title}`)

  // Get full HTML to understand structure
  const html = await page.content()
  console.log(`Page HTML length: ${html.length} bytes`)

  // Look for specific elements
  const hasMain = html.includes('<main')
  const hasErrorBoundary = html.includes('error')
  const hasLoadingSpinner = html.includes('Loading') || html.includes('spinner')

  console.log(`Has <main>: ${hasMain}`)
  console.log(`Has error text: ${hasErrorBoundary}`)
  console.log(`Has loading spinner: ${hasLoadingSpinner}`)

  // Check Network requests
  console.log(`\nNetwork errors: ${networkErrors.length}`)
  networkErrors.forEach(err => {
    console.log(`  ${err.status} ${err.method} ${err.url}`)
  })

  // Check console errors
  console.log(`Console errors: ${errors.length}`)
  errors.forEach(err => {
    console.log(`  ${err.substring(0, 100)}`)
  })

  // Save full page content for analysis
  fs.writeFileSync('./dashboard-debug.html', html)
  console.log('Full HTML saved to dashboard-debug.html')
})

test('DETAILED: Repository page structure and tree', async ({ page }) => {
  console.log('\n=== DETAILED ANALYSIS: Repository ===')

  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  console.log('Loading repository...')
  await page.goto(`${BASE_URL}/repository`, { timeout: 15000 })
  await page.waitForTimeout(2000)

  const html = await page.content()
  console.log(`Page HTML length: ${html.length} bytes`)

  // Look for tree-related elements
  const hasRepositoryContent = html.includes('Repository') || html.includes('Tree')
  const hasTreeContainer = html.includes('tree') || html.includes('node')
  const hasButtons = html.includes('<button')
  const hasUL = html.includes('<ul') || html.includes('<ol')

  console.log(`Has Repository text: ${hasRepositoryContent}`)
  console.log(`Has tree-like structure: ${hasTreeContainer}`)
  console.log(`Has buttons: ${hasButtons}`)
  console.log(`Has lists (ul/ol): ${hasUL}`)

  // Check for React error boundaries
  const hasReactError = html.includes('React') || html.includes('Error')
  console.log(`Has React/Error text: ${hasReactError}`)

  // Count DOM elements
  const divCount = (html.match(/<div/g) || []).length
  const buttonCount = (html.match(/<button/g) || []).length
  const liCount = (html.match(/<li/g) || []).length

  console.log(`\nDOM element counts:`)
  console.log(`  <div>: ${divCount}`)
  console.log(`  <button>: ${buttonCount}`)
  console.log(`  <li>: ${liCount}`)

  // Save for analysis
  fs.writeFileSync('./repository-debug.html', html)
  console.log('Full HTML saved to repository-debug.html')
})

test('DETAILED: Test Cases page structure', async ({ page }) => {
  console.log('\n=== DETAILED ANALYSIS: Test Cases ===')

  console.log('Loading test-cases...')
  await page.goto(`${BASE_URL}/test-cases`, { timeout: 15000 })
  await page.waitForTimeout(2000)

  const html = await page.content()
  console.log(`Page HTML length: ${html.length} bytes`)

  // Look for checkboxes
  const hasCheckboxes = html.includes('type="checkbox"')
  const hasInputs = html.includes('<input')
  const hasTables = html.includes('<table') || html.includes('thead')

  console.log(`Has checkboxes: ${hasCheckboxes}`)
  console.log(`Has inputs: ${hasInputs}`)
  console.log(`Has table structure: ${hasTables}`)

  // Count elements
  const inputCount = (html.match(/<input/g) || []).length
  const checkboxCount = (html.match(/type="checkbox"/g) || []).length

  console.log(`\nInput elements:`)
  console.log(`  Total <input>: ${inputCount}`)
  console.log(`  Checkboxes: ${checkboxCount}`)

  fs.writeFileSync('./test-cases-debug.html', html)
  console.log('Full HTML saved to test-cases-debug.html')
})

test('API connectivity test', async ({ page, context }) => {
  console.log('\n=== API Connectivity Test ===')

  const requests: any[] = []

  context.on('response', response => {
    requests.push({
      url: response.url(),
      status: response.status(),
      timing: response.timing?.responseEnd - response.timing?.responseStart
    })
  })

  // Test critical APIs
  const apis = [
    '/api/projects',
    '/api/test-cases?projectId=cmqttt49c000r7kygg73fmuqv',
    '/api/repository/tree?projectId=cmqttt49c000r7kygg73fmuqv',
    '/api/dashboard/repository-metrics?projectId=cmqttt49c000r7kygg73fmuqv',
  ]

  for (const api of apis) {
    const start = Date.now()
    try {
      const response = await page.goto(`${BASE_URL}${api}`, { waitUntil: 'networkidle' })
      const duration = Date.now() - start
      const status = response?.status() || 'unknown'
      console.log(`${api}: ${status} (${duration}ms)`)

      if (status === 200) {
        const text = await page.textContent()
        console.log(`  Response length: ${text?.length || 0} chars`)
      }
    } catch (err) {
      const duration = Date.now() - start
      console.log(`❌ ${api}: ERROR (${duration}ms)`)
      console.log(`   ${err}`)
    }
  }
})
