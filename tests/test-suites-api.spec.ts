import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE_URL = 'http://localhost:3000/api'

test.describe('Test Suite Management - API Tests', () => {
  let projectId: string
  let testCaseIds: string[] = []

  test.beforeAll(async () => {
    // Get or create a project
    const projects = await prisma.project.findMany({ take: 1 })
    if (projects.length > 0) {
      projectId = projects[0].id
    } else {
      const newProject = await prisma.project.create({
        data: { name: 'Test Project' },
      })
      projectId = newProject.id
    }

    // Get some test cases
    testCaseIds = (
      await prisma.testCase.findMany({
        where: { projectId },
        take: 3,
        select: { id: true },
      })
    ).map((tc) => tc.id)
  })

  test('PHASE 1: Create suite with hierarchy selection', async ({ request }) => {
    // Create a suite via API
    const createResponse = await request.post(`${BASE_URL}/test-suites?projectId=${projectId}`, {
      data: {
        name: 'API Hierarchy Test Suite',
        description: 'Created via API',
        category: 'CUSTOM',
        selectionMethod: 'HIERARCHY',
      },
    })

    expect(createResponse.status()).toBe(201)
    const suite = await createResponse.json()
    expect(suite.name).toBe('API Hierarchy Test Suite')
    expect(suite.selectionMethod).toBe('HIERARCHY')
    expect(suite.id).toBeTruthy()

    // Add test cases to the suite
    if (testCaseIds.length > 0) {
      const patchResponse = await request.patch(`${BASE_URL}/test-suites/${suite.id}`, {
        data: {
          testCaseIds: testCaseIds.slice(0, 2),
        },
      })

      expect(patchResponse.status()).toBe(200)

      // Verify test cases were added
      const updatedSuite = await request.get(`${BASE_URL}/test-suites/${suite.id}`)
      const updatedData = await updatedSuite.json()
      expect(updatedData.testCases.length).toBe(2)
    }

    // Verify in database
    const dbSuite = await prisma.testSuite.findUnique({
      where: { id: suite.id },
      include: { testCases: true },
    })
    expect(dbSuite).toBeTruthy()
    expect(dbSuite!.name).toBe('API Hierarchy Test Suite')
    expect(dbSuite!.selectionMethod).toBe('HIERARCHY')
    console.log(`✓ Created suite with ${dbSuite!.testCases.length} test cases`)
  })

  test('PHASE 2: Edit suite - rename and add tests', async ({ request }) => {
    // Create a suite to edit
    const createResponse = await request.post(`${BASE_URL}/test-suites?projectId=${projectId}`, {
      data: {
        name: 'Suite to Edit',
        category: 'SMOKE',
        selectionMethod: 'HIERARCHY',
      },
    })

    const suite = await createResponse.json()

    // Edit the suite
    const patchResponse = await request.patch(`${BASE_URL}/test-suites/${suite.id}`, {
      data: {
        name: 'Edited Suite Name',
        description: 'Updated description',
        testCaseIds: testCaseIds.slice(0, 1),
      },
    })

    expect(patchResponse.status()).toBe(200)
    const updatedSuite = await patchResponse.json()
    expect(updatedSuite.name).toBe('Edited Suite Name')
    expect(updatedSuite.description).toBe('Updated description')

    // Verify in database
    const dbSuite = await prisma.testSuite.findUnique({
      where: { id: suite.id },
      include: { testCases: true },
    })
    expect(dbSuite!.name).toBe('Edited Suite Name')
    expect(dbSuite!.testCases.length).toBe(1)
    console.log(`✓ Edited suite: ${dbSuite!.name}`)
  })

  test('PHASE 3: Persistence - data survives database round-trip', async ({ request }) => {
    // Create a suite
    const createResponse = await request.post(`${BASE_URL}/test-suites?projectId=${projectId}`, {
      data: {
        name: 'Persistence Test Suite',
        category: 'REGRESSION',
        selectionMethod: 'HIERARCHY',
      },
    })

    const suite = await createResponse.json()

    // Add test cases
    if (testCaseIds.length > 0) {
      await request.patch(`${BASE_URL}/test-suites/${suite.id}`, {
        data: { testCaseIds: testCaseIds.slice(0, 2) },
      })
    }

    // Fetch via API to verify persistence
    const fetchResponse = await request.get(`${BASE_URL}/test-suites?projectId=${projectId}`)
    const suites = await fetchResponse.json()

    const persistedSuite = suites.find((s: any) => s.id === suite.id)
    expect(persistedSuite).toBeTruthy()
    expect(persistedSuite.name).toBe('Persistence Test Suite')
    expect(persistedSuite.testCases.length).toBeGreaterThan(0)

    // Verify in database directly
    const dbSuite = await prisma.testSuite.findUnique({
      where: { id: suite.id },
      include: { testCases: true },
    })
    expect(dbSuite!.testCases.length).toBe(testCaseIds.slice(0, 2).length)
    console.log(`✓ Suite persisted with ${dbSuite!.testCases.length} test cases`)
  })

  test('PHASE 4: Database count matches API response count', async ({ request }) => {
    // Create a suite with known number of test cases
    const createResponse = await request.post(`${BASE_URL}/test-suites?projectId=${projectId}`, {
      data: {
        name: 'Count Verification Suite',
        category: 'CUSTOM',
        selectionMethod: 'HIERARCHY',
      },
    })

    const suite = await createResponse.json()
    const expectedCount = testCaseIds.length > 0 ? 1 : 0

    // Add specific test cases
    if (testCaseIds.length > 0) {
      await request.patch(`${BASE_URL}/test-suites/${suite.id}`, {
        data: { testCaseIds: testCaseIds.slice(0, expectedCount) },
      })
    }

    // Get via API
    const apiResponse = await request.get(`${BASE_URL}/test-suites/${suite.id}`)
    const apiSuite = await apiResponse.json()
    const apiTestCount = apiSuite.testCases.length

    // Get from database
    const dbSuite = await prisma.testSuite.findUnique({
      where: { id: suite.id },
      include: { testCases: true },
    })
    const dbTestCount = dbSuite!.testCases.length

    expect(apiTestCount).toBe(dbTestCount)
    console.log(`✓ Counts match: API=${apiTestCount}, DB=${dbTestCount}`)
  })

  test('Delete suite functionality', async ({ request }) => {
    // Create a suite
    const createResponse = await request.post(`${BASE_URL}/test-suites?projectId=${projectId}`, {
      data: {
        name: 'Suite to Delete',
        category: 'CUSTOM',
        selectionMethod: 'HIERARCHY',
      },
    })

    const suite = await createResponse.json()

    // Delete via API
    const deleteResponse = await request.delete(`${BASE_URL}/test-suites/${suite.id}`)
    expect(deleteResponse.status()).toBe(200)

    // Verify it's deleted in database
    const dbSuite = await prisma.testSuite.findUnique({
      where: { id: suite.id },
    })
    expect(dbSuite).toBeNull()
    console.log('✓ Suite deleted successfully')
  })

  test('Repository hierarchy structure is available', async ({ request }) => {
    // Get repository structure
    const response = await request.get(`${BASE_URL}/repository?projectId=${projectId}`)
    const repo = await response.json()

    expect(repo.nodes).toBeTruthy()
    expect(Array.isArray(repo.nodes)).toBe(true)

    if (repo.nodes.length > 0) {
      const node = repo.nodes[0]
      expect(node.id).toBeTruthy()
      expect(node.name).toBeTruthy()
      expect(node.type).toBeTruthy()
      console.log(`✓ Repository has ${repo.nodes.length} nodes`)
    }
  })

  test('Test cases API includes repositoryNodeId', async ({ request }) => {
    // Get test cases
    const response = await request.get(`${BASE_URL}/test-cases?projectId=${projectId}`)
    const testCases = await response.json()

    if (testCases.length > 0) {
      const testCase = testCases[0]
      expect(testCase.id).toBeTruthy()
      expect(testCase.title).toBeTruthy()
      // repositoryNodeId might be null for some test cases
      expect('repositoryNodeId' in testCase).toBe(true)
      console.log(`✓ Test cases API includes repositoryNodeId field`)
    }
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })
})
