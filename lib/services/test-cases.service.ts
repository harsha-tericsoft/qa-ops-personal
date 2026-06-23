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

  // Tag filter - use TagTestCase relationships
  if (filters.tags && filters.tags.length > 0) {
    whereClause.tags = {
      some: {
        tag: {
          name: {
            in: filters.tags,
          },
        },
      },
    }
  }

  // Search filter - search title and description
  if (filters.search && filters.search.trim()) {
    whereClause.OR = [
      {
        title: {
          contains: filters.search,
          mode: 'insensitive',
        },
      },
      {
        description: {
          contains: filters.search,
          mode: 'insensitive',
        },
      },
    ]
  }

  // Get total count for pagination
  const total = await prisma.testCase.count({ where: whereClause })

  // Get paginated results
  const testCases = await prisma.testCase.findMany({
    where: whereClause,
    select: {
      id: true,
      title: true,
      description: true,
      tags: {
        select: {
          tag: {
            select: {
              name: true,
            },
          },
        },
      },
      testRuns: {
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      title: 'asc',
    },
    skip: offset,
    take: pagination.limit,
  })

  return {
    testCases: testCases.map((tc) => ({
      id: tc.id,
      title: tc.title,
      description: tc.description,
      tags: tc.tags.map((t) => t.tag.name),
      testRuns: tc.testRuns.length,
    })),
    total,
    page: pagination.page,
    limit: pagination.limit,
    pages: Math.ceil(total / pagination.limit),
  }
}

export async function getFilterOptions(projectId: string): Promise<FilterOptions> {
  // Get all tags used in this project
  const tags = await prisma.tag.findMany({
    where: {
      projectId,
      testCases: {
        some: {}, // Only tags that are used
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
    orderBy: {
      name: 'asc',
    },
  })

  // Get module values from RepositoryNode (placeholder - can be enhanced)
  const modules = await prisma.repositoryNode.findMany({
    where: {
      projectId,
      type: 'MODULE',
    },
    distinct: ['name'],
    select: {
      name: true,
    },
    orderBy: {
      name: 'asc',
    },
  })

  return {
    tags: tags.map((t) => ({
      name: t.name,
      count: t._count.testCases,
    })),
    types: [
      { name: 'Manual', count: 0 }, // Placeholder - can be populated from tags
      { name: 'Automated', count: 0 },
    ],
    modules: modules.map((m) => ({
      name: m.name,
      count: 0, // Could be enhanced with test case counts
    })),
  }
}

export async function getTestCaseSummary(projectId: string): Promise<TestCaseSummary> {
  const total = await prisma.testCase.count({
    where: { projectId },
  })

  // Count by tag
  const byTag: Record<string, number> = {}
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

  tags.forEach((t) => {
    byTag[t.name] = t._count.testCases
  })

  return {
    total,
    byType: {
      Manual: 0, // Placeholder
      Automated: 0,
    },
    byTag,
    byModule: {}, // Placeholder
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
