import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const count = await prisma.repositoryNode.count()

    const first20 = await prisma.repositoryNode.findMany({
      take: 20,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        depth: true,
        parentId: true,
        roamNodeId: true,
        tags: true,
      },
    })

    // Check for test case patterns
    const hasTestMarkers = first20.filter(n =>
      n.name.startsWith('Test::') ||
      n.name.startsWith('Test:') ||
      n.tags?.includes('Manual') ||
      n.tags?.includes('Automation')
    )

    return NextResponse.json({
      totalRepositoryNodeCount: count,
      first20Nodes: first20,
      nodesWithTestMarkers: hasTestMarkers.length,
      testMarkerExamples: hasTestMarkers.slice(0, 5),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
