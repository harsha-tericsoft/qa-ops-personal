import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get a sample of nodes with their parent references
    const nodes = await prisma.repositoryNode.findMany({
      take: 50,
      where: { depth: { gt: 0 } }, // Only non-root nodes
      select: {
        id: true,
        name: true,
        roamNodeId: true,
        depth: true,
        parentId: true,
        createdAt: true,
      },
      orderBy: { depth: 'asc' },
    })

    // Check if any parentId is set
    const withParent = nodes.filter(n => n.parentId)
    const withoutParent = nodes.filter(n => !n.parentId)

    // Try to find what the parentId should be for the first node
    if (nodes.length > 0) {
      const firstNode = nodes[0]
      console.log('[debug-import] First child node:', firstNode)

      // For a node at depth 1, parent should be root (depth 0)
      const root = await prisma.repositoryNode.findFirst({
        where: { depth: 0 },
        select: { id: true, roamNodeId: true, name: true },
      })

      console.log('[debug-import] Root node:', root)

      // Check if we're looking up by roamNodeId or id
      if (firstNode.parentId) {
        const parent = await prisma.repositoryNode.findUnique({
          where: { id: firstNode.parentId },
          select: { id: true, roamNodeId: true, name: true },
        })
        console.log('[debug-import] Found parent:', parent)
      }
    }

    return NextResponse.json({
      totalNonRootNodes: nodes.length,
      nodesWithParent: withParent.length,
      nodesWithoutParent: withoutParent.length,
      samples: {
        withParent: withParent.slice(0, 5),
        withoutParent: withoutParent.slice(0, 5),
      },
      analysis: {
        issue: 'All parentId are null',
        possibleCause: 'PASS 2 parent update either did not execute or failed silently',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
