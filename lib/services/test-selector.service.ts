import { prisma } from '@/lib/prisma'

export async function selectByRepoNode(nodeId: string): Promise<string[]> {
  // Get the node to find its path
  const node = await prisma.repositoryNode.findUniqueOrThrow({
    where: { id: nodeId },
  })

  // Find all nodes at this path or under it (descendants)
  const descendantNodes = await prisma.repositoryNode.findMany({
    where: {
      OR: [
        { id: nodeId },
        { path: { startsWith: node.path + '/' } },
      ],
    },
  })

  // Get all test cases linked to these nodes
  const testCaseNodes = await prisma.testCaseNode.findMany({
    where: {
      nodeId: {
        in: descendantNodes.map(n => n.id),
      },
    },
    distinct: ['testCaseId'],
  })

  return testCaseNodes.map(tcn => tcn.testCaseId)
}

export async function selectByTags(
  tagIds: string[],
  mode: 'AND' | 'OR' = 'OR'
): Promise<string[]> {
  if (tagIds.length === 0) return []

  if (mode === 'OR') {
    // Test cases that have ANY of the selected tags
    const tagTestCases = await prisma.tagTestCase.findMany({
      where: {
        tagId: { in: tagIds },
      },
      distinct: ['testCaseId'],
    })

    return tagTestCases.map(ttc => ttc.testCaseId)
  } else {
    // Test cases that have ALL of the selected tags
    const testCases = await prisma.testCase.findMany({
      where: {
        tags: {
          every: {
            tagId: { in: tagIds },
          },
        },
      },
    })

    return testCases.map(tc => tc.id)
  }
}

export async function selectBySuite(suiteId: string): Promise<string[]> {
  const suiteTestCases = await prisma.suiteTestCase.findMany({
    where: { suiteId },
    orderBy: { order: 'asc' },
  })

  return suiteTestCases.map(stc => stc.testCaseId)
}

export async function selectBySearch(query: string, projectId: string): Promise<string[]> {
  const testCases = await prisma.testCase.findMany({
    where: {
      projectId,
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    },
  })

  return testCases.map(tc => tc.id)
}
