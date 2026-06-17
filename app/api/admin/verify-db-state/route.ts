import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get all counts
    const repositoryNodeCount = await prisma.repositoryNode.count()
    const roamTestCaseCount = await prisma.roamTestCase.count()
    const repositoryCount = await prisma.repository.count()
    const projectCount = await prisma.project.count()

    // Get first 20 RepositoryNodes with all details
    const first20Nodes = await prisma.repositoryNode.findMany({
      take: 20,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        roamNodeId: true,
        type: true,
        depth: true,
        parentId: true,
        tags: true,
        createdAt: true,
      },
    })

    // Get first 20 RoamTestCases with linked RepositoryNode data
    const first20TestCases = await prisma.roamTestCase.findMany({
      take: 20,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        repositoryNodeId: true,
        sourceRoamUid: true,
        status: true,
        priority: true,
        createdAt: true,
        repositoryNode: {
          select: {
            name: true,
            roamNodeId: true,
          },
        },
      },
    })

    // Detect if data is synthetic
    const syntheticIndicators = {
      testNodeNames: first20Nodes.filter(n =>
        n.name?.includes('Test::') ||
        n.name?.includes('When I enter') ||
        n.name?.includes('Regular folder node')
      ).length,
      roamNodeIdsPattern: first20Nodes.filter(n =>
        n.roamNodeId?.startsWith('uid-')
      ).length,
      manualTestCases: first20TestCases.filter(tc =>
        tc.title?.includes('When I enter') ||
        tc.title?.includes('Test::')
      ).length,
    }

    const isSyntheticData =
      syntheticIndicators.roamNodeIdsPattern > 0 ||
      (syntheticIndicators.testNodeNames > 0 && repositoryNodeCount < 100)

    return NextResponse.json({
      counts: {
        repositoryNodes: repositoryNodeCount,
        roamTestCases: roamTestCaseCount,
        repositories: repositoryCount,
        projects: projectCount,
      },
      first20RepositoryNodes: first20Nodes,
      first20RoamTestCases: first20TestCases,
      dataAnalysis: {
        isSyntheticData,
        syntheticIndicators,
        explanation: isSyntheticData
          ? 'Data appears to be test/synthetic (uid-* RoamNodeIds, small dataset, manual test names)'
          : 'Data appears to be real Roam import (proper RoamNodeIds, larger dataset)',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
