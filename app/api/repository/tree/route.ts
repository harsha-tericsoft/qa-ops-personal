import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface TreeNode {
  id: string
  name: string
  type: string
  depth: number
  path: string
  metadata: any
  tags: string[]
  roamPageId: string | null
  children: TreeNode[]
}

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId required' },
        { status: 400 }
      )
    }

    // Try to fetch repository
    const repository = await prisma.repository.findFirst({
      where: { projectId },
    })

    if (!repository) {
      return NextResponse.json(
        { 
          success: true,
          tree: {
            id: 'root',
            name: 'Repository',
            type: 'ROOT',
            depth: 0,
            path: '/',
            metadata: {},
            tags: [],
            roamPageId: null,
            children: []
          },
          message: 'No repository configured'
        }
      )
    }

    // Fetch all nodes
    const nodes = await prisma.repositoryNode.findMany({
      where: { repositoryId: repository.id },
    })

    // Build tree structure
    const buildTree = (parentId: string | null = null): TreeNode[] => {
      return nodes
        .filter((n) => n.parentId === parentId)
        .map((node) => ({
          id: node.id,
          name: node.name,
          type: node.type,
          depth: node.depth,
          path: node.path,
          metadata: node.metadata,
          tags: node.tags || [],
          roamPageId: node.roamPageId,
          children: buildTree(node.id),
        }))
    }

    const tree: TreeNode = {
      id: repository.id,
      name: repository.name,
      type: 'ROOT',
      depth: 0,
      path: '/',
      metadata: {},
      tags: [],
      roamPageId: null,
      children: buildTree(null),
    }

    return NextResponse.json({ success: true, tree })
  } catch (err) {
    console.error('[repository/tree] Error:', err)
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    
    // Return graceful error response
    return NextResponse.json(
      {
        success: false,
        error: 'Database connection failed',
        details: errorMsg,
        tree: {
          id: 'root',
          name: 'Repository',
          type: 'ROOT',
          depth: 0,
          path: '/',
          metadata: {},
          tags: [],
          roamPageId: null,
          children: []
        }
      },
      { status: 200 } // Return 200 with empty tree instead of 500
    )
  }
}
