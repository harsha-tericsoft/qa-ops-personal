import { SuiteCategory } from '@/app/generated/prisma'
import { selectBySuite } from './test-selector.service'
import { createCycle } from './execution.service'
import { prisma } from '@/lib/prisma'

export interface FilterCriteria {
  modules?: string[]
  types?: string[]
  tags?: string[]
  search?: string
}

export async function getSuite(suiteId: string) {
  const suite = await prisma.testSuite.findUniqueOrThrow({
    where: { id: suiteId },
    include: {
      testCases: {
        include: { testCase: true },
        orderBy: { order: 'asc' },
      },
      usedInCycles: {
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  return suite
}

export async function updateSuite(
  suiteId: string,
  input: {
    name?: string
    description?: string
    category?: SuiteCategory
    testCaseIds?: string[]
    roamTestCaseIds?: string[]
  }
) {
  const { name, description, category, testCaseIds, roamTestCaseIds } = input

  // Handle roamTestCaseIds: bulk create TestCase records in a transaction
  let finalTestCaseIds = testCaseIds || []
  if (roamTestCaseIds && roamTestCaseIds.length > 0) {
    finalTestCaseIds = await prisma.$transaction(async (tx) => {
      // Fetch RoamTestCase records
      const roamTestCases = await tx.roamTestCase.findMany({
        where: {
          id: { in: roamTestCaseIds },
        },
        select: {
          id: true,
          title: true,
          sourceRoamUid: true,
        },
      })

      // Bulk create TestCase records
      await tx.testCase.createMany({
        data: roamTestCases.map((rtc) => ({
          projectId: (await tx.testSuite.findUniqueOrThrow({ where: { id: suiteId } })).projectId,
          title: rtc.title,
          description: `Extracted from: ${rtc.sourceRoamUid}`,
        })),
        skipDuplicates: true,
      })

      // Fetch the created TestCase records
      const project = await tx.testSuite.findUniqueOrThrow({ where: { id: suiteId } })
      const testCases = await tx.testCase.findMany({
        where: {
          projectId: project.projectId,
          title: { in: roamTestCases.map((rtc) => rtc.title) },
        },
        select: { id: true },
      })

      return testCases.map((tc) => tc.id)
    })
  }

  const suite = await prisma.testSuite.update({
    where: { id: suiteId },
    data: {
      name,
      description,
      category,
      testCases:
        finalTestCaseIds && finalTestCaseIds.length > 0
          ? {
              deleteMany: {},
              createMany: {
                data: finalTestCaseIds.map((testCaseId, order) => ({
                  testCaseId,
                  order,
                })),
              },
            }
          : undefined,
    },
    include: {
      testCases: {
        include: { testCase: true },
        orderBy: { order: 'asc' },
      },
    },
  })

  return suite
}

export async function deleteSuite(suiteId: string) {
  await prisma.testSuite.delete({
    where: { id: suiteId },
  })
}

export async function getSuiteUsageHistory(suiteId: string) {
  const cycles = await prisma.executionCycle.findMany({
    where: { sourceSuiteId: suiteId },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      testRuns: {
        select: { status: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return cycles.map(cycle => {
    const total = cycle.testRuns.length
    const pass = cycle.testRuns.filter(r => r.status === 'PASS').length
    return {
      ...cycle,
      total,
      pass,
      passRate: total > 0 ? Math.round((pass / total) * 100) : 0,
    }
  })
}

export async function createCycleFromSuite(
  suiteId: string,
  input: {
    projectId: string
    name: string
    description?: string
    startDate?: Date
    endDate?: Date
  }
) {
  // Resolve test case IDs from the suite
  const testCaseIds = await selectBySuite(suiteId)

  // Create the cycle
  const cycle = await createCycle({
    projectId: input.projectId,
    name: input.name,
    description: input.description,
    startDate: input.startDate,
    endDate: input.endDate,
    testCaseIds,
  })

  // Link the cycle back to the suite
  const linkedCycle = await prisma.executionCycle.update({
    where: { id: cycle.id },
    data: { sourceSuiteId: suiteId },
    include: { testRuns: true },
  })

  return linkedCycle
}

// Filter-based suite creation (Phase 1 feature)

export async function previewSuiteFromFilters(
  projectId: string,
  filters: FilterCriteria
) {
  // Build where clause for RoamTestCase
  let whereClause: any = {
    projectId,
  }

  // Tag filter - use tags array
  if (filters.tags && filters.tags.length > 0) {
    whereClause.tags = {
      hasSome: filters.tags,
    }
  }

  // Search filter
  if (filters.search && filters.search.trim()) {
    whereClause.title = {
      contains: filters.search,
      mode: 'insensitive',
    }
  }

  // Get matching RoamTestCase records
  const testCases = await prisma.roamTestCase.findMany({
    where: whereClause,
    select: {
      id: true,
      title: true,
    },
    orderBy: {
      title: 'asc',
    },
  })

  return {
    matchingTests: testCases,
    count: testCases.length,
  }
}

export async function createSuiteFromFilters(
  projectId: string,
  name: string,
  description: string | undefined,
  filters: FilterCriteria
) {
  // Get matching RoamTestCase records
  let whereClause: any = {
    projectId,
  }

  if (filters.tags && filters.tags.length > 0) {
    whereClause.tags = {
      hasSome: filters.tags,
    }
  }

  if (filters.search && filters.search.trim()) {
    whereClause.title = {
      contains: filters.search,
      mode: 'insensitive',
    }
  }

  const roamTestCases = await prisma.roamTestCase.findMany({
    where: whereClause,
    select: { id: true, title: true },
    orderBy: { title: 'asc' },
  })

  // For each RoamTestCase, create a corresponding TestCase if needed
  // This bridges the execution pipeline which currently uses TestCase
  const testCaseIds: string[] = []

  for (const rtc of roamTestCases) {
    // Create a TestCase record for this RoamTestCase
    const testCase = await prisma.testCase.create({
      data: {
        projectId,
        title: rtc.title,
      },
    })
    testCaseIds.push(testCase.id)
  }

  // Create the suite with filter-based selection method
  const suite = await prisma.testSuite.create({
    data: {
      projectId,
      name,
      description,
      selectionMethod: 'FILTER',
      selectionConfig: filters as any,
      testCases: {
        createMany: {
          data: testCaseIds.map((testCaseId, order) => ({
            testCaseId,
            order,
          })),
        },
      },
    },
    include: {
      testCases: {
        include: { testCase: true },
        orderBy: { order: 'asc' },
      },
    },
  })

  return suite
}
