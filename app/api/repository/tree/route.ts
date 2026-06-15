import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/repository/tree?projectId={id}
// Returns full tree structure with unlimited nesting depth
export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId required' },
        { status: 400 }
      )
    }

    // Get repository
    const repository = await prisma.repository.findFirst({
      where: { projectId },
    })

    if (!repository) {
      return NextResponse.json({
        success: true,
        nodes: [],
      })
    }

    const repositoryId = repository.id

    // Recursively build tree
    async function buildTree(parentId: string | null): Promise<any[]> {
      const nodes = await prisma.repositoryNode.findMany({
        where: {
          repositoryId,
          parentId,
          deletedAt: null,
        },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      })

      // Recursively add children for each node
      return Promise.all(
        nodes.map(async (node) => ({
          id: node.id,
          name: node.name,
          type: node.type,
          depth: node.depth,
          path: node.path,
          metadata: node.metadata,
          tags: node.tags || [],
          roamPageId: node.roamPageId,
          children: await buildTree(node.id),
        }))
      )
    }

    const nodes = await buildTree(null)

    return NextResponse.json({
      success: true,
      repositoryId: repository.id,
      repositoryName: repository.name,
      nodes,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    )
  }
}
