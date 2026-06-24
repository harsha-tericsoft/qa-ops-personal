import { prisma } from '@/lib/prisma'

export interface FilterOptions {
  modules: { name: string; count: number }[]
  types: { name: string; count: number }[]
  tags: { name: string; count: number }[]
}

export interface TestCaseSummary {
  total: number
  byType: Record<string, number>
  byTag: Record<string, number>
  byModule: Record<string, number>
}

export interface TestCaseWithMetadata {
  id: string
  title: string
  description: string | null
  tags: string[]
  testRuns?: number
}

export async function findTestCasesByFilters(
  projectId: string,
  filters: {
    modules?: string[]
    types?: string[]
    tags?: string[]
    search?: string
  },
  pagination: { page: number; limit: number }
) {
  const offset = (pagination.page - 1) * pagination.limit

  // Build the where clause based on filters
  let whereClause: any = {
    projectId,
  }

  // Tag filter - check if tags array contains the filter tags
  if (filters.tags && filters.tags.length > 0) {
    whereClause.tags = {
      hasSome: filters.tags,
    }
  }

  // Search filter - search title only (RoamTestCase doesn't have description)
  if (filters.search && filters.search.trim()) {
    whereClause.title = {
      contains: filters.search,
      mode: 'insensitive',
    }
  }

  // Get total count for pagination
  const total = await prisma.roamTestCase.count({ where: whereClause })

  // Get paginated results
  const roamTestCases = await prisma.roamTestCase.findMany({
    where: whereClause,
    select: {
      id: true,
      title: true,
      tags: true,
      repositoryNodeId: true,
      sourceRoamUid: true,
    },
    orderBy: {
      title: 'asc',
    },
    skip: offset,
    take: pagination.limit,
  })

  // Enrich with repository node information (module/feature)
  const enrichedTestCases = await Promise.all(
    roamTestCases.map(async (rtc) => {
      let module = ''
      let feature = ''

      if (rtc.repositoryNodeId) {
        const node = await prisma.repositoryNode.findUnique({
          where: { id: rtc.repositoryNodeId },
          select: {
            name: true,
            parent: {
              select: {
                name: true,
              },
            },
          },
        })

        if (node) {
          // Assume parent is module, current is feature
          if (node.parent) {
            module = node.parent.name
            feature = node.name
          } else {
            module = node.name
          }
        }
      }

      return {
        id: rtc.id,
        title: rtc.title,
        tags: rtc.tags || [],
        module,
        feature,
        sourceRoamUid: rtc.sourceRoamUid,
      }
    })
  )

  return {
    testCases: enrichedTestCases,
    total,
    page: pagination.page,
    limit: pagination.limit,
    pages: Math.ceil(total / pagination.limit),
  }
}

export async function getFilterOptions(projectId: string): Promise<FilterOptions> {
  // Get all RoamTestCase records to extract unique tags
  const allRoamTests = await prisma.roamTestCase.findMany({
    where: { projectId },
    select: {
      tags: true,
    },
  })

  // Count tag occurrences
  const tagCounts: Record<string, number> = {}
  allRoamTests.forEach((test) => {
    if (test.tags && Array.isArray(test.tags)) {
      test.tags.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      })
    }
  })

  const tags = Object.entries(tagCounts)
    .map(([name, count]) => ({
      name,
      count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Get module values from RepositoryNode
  const modules = await prisma.repositoryNode.findMany({
    where: {
      projectId,
      type: { in: ['MODULE', 'FEATURE'] },
    },
    distinct: ['name'],
    select: {
      name: true,
    },
    orderBy: {
      name: 'asc',
    },
  })

  // Count tests by manual/automated based on tags
  const manualCount = allRoamTests.filter((t) =>
    t.tags?.includes('Manual')
  ).length
  const automatedCount = allRoamTests.filter((t) =>
    t.tags?.includes('Automated')
  ).length

  return {
    tags,
    types: [
      { name: 'Manual', count: manualCount },
      { name: 'Automated', count: automatedCount },
    ],
    modules: modules.map((m) => ({
      name: m.name,
      count: allRoamTests.filter((t) =>
        t.tags?.some((tag) => tag === m.name)
      ).length,
    })),
  }
}

export async function getTestCaseSummary(projectId: string): Promise<TestCaseSummary> {
  const total = await prisma.roamTestCase.count({
    where: { projectId },
  })

  // Get all RoamTestCase records to count by tags/type
  const allRoamTests = await prisma.roamTestCase.findMany({
    where: { projectId },
    select: {
      tags: true,
    },
  })

  // Count by tag
  const byTag: Record<string, number> = {}
  allRoamTests.forEach((test) => {
    if (test.tags && Array.isArray(test.tags)) {
      test.tags.forEach((tag) => {
        byTag[tag] = (byTag[tag] || 0) + 1
      })
    }
  })

  // Count by type
  const manualCount = allRoamTests.filter((t) =>
    t.tags?.includes('Manual')
  ).length
  const automatedCount = allRoamTests.filter((t) =>
    t.tags?.includes('Automated')
  ).length

  return {
    total,
    byType: {
      Manual: manualCount,
      Automated: automatedCount,
    },
    byTag,
    byModule: {}, // Placeholder for future enhancement
  }
}

export async function countTestCasesByTag(projectId: string) {
  const tags = await prisma.tag.findMany({
    where: {
      projectId,
      testCases: {
        some: {},
      },
    },
    select: {
      name: true,
      _count: {
        select: {
          testCases: true,
        },
      },
    },
  })

  return Object.fromEntries(tags.map((t) => [t.name, t._count.testCases]))
}

export async function getTestCasesByTag(projectId: string, tagName: string) {
  const tag = await prisma.tag.findFirst({
    where: {
      projectId,
      name: tagName,
    },
    include: {
      testCases: {
        include: {
          testCase: {
            select: {
              id: true,
              title: true,
              description: true,
            },
          },
        },
      },
    },
  })

  if (!tag) {
    return []
  }

  return tag.testCases.map((ttc) => ttc.testCase)
}
