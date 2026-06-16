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

// GET /api/repository/tree?projectId={id}
// Returns full tree structure with unlimited nesting depth
// OPTIMIZED: Loads all nodes in single query, builds tree in memory
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  let queryCount = 0

  try {
    const projectId = req.nextUrl.searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId required' },
        { status: 400 }
      )
    }

    // Query 1: Get repository
    console.log('[repository/tree] Query 1: Loading repository...')
    const repository = await prisma.repository.findFirst({
      where: { projectId },
    })
    queryCount++
    console.log('[repository/tree] Query 1 complete')

    if (!repository) {
      console.log('[repository/tree] No repository found for projectId:', projectId)
      return NextResponse.json({
        success: true,
        nodes: [],
      })
    }

    const repositoryId = repository.id
    console.log('[repository/tree] Repository found:', repositoryId)

    // Query 2: Load ALL repository nodes at once
    console.log('[repository/tree] Query 2: Loading all nodes...')
    const allNodes = await prisma.repositoryNode.findMany({
      where: {
        repositoryId,
        deletedAt: null,
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })
    queryCount++
    console.log('[repository/tree] Query 2 complete, loaded nodes:', allNodes.length)

    // Build tree structure in memory (zero additional database queries)
    console.log('[repository/tree] Building tree in memory...')
    const buildStartTime = Date.now()

    function buildTreeInMemory(parentId: string | null): TreeNode[] {
      return allNodes
        .filter((node) => node.parentId === parentId)
        .map((node) => ({
          id: node.id,
          name: node.name,
          type: node.type,
          depth: node.depth,
          path: node.path,
          metadata: node.metadata,
          tags: node.tags || [],
          roamPageId: node.roamPageId,
          children: buildTreeInMemory(node.id),
        }))
    }

    const nodes = buildTreeInMemory(null)
    const buildDuration = Date.now() - buildStartTime
    const totalDuration = Date.now() - startTime

    // Log instrumentation data
    console.log('[repository/tree] Tree build complete')
    console.log('[repository/tree] ───────────────────────────────────')
    console.log('[repository/tree] Total nodes loaded:', allNodes.length)
    console.log('[repository/tree] Root nodes (tree.length):', nodes.length)
    console.log('[repository/tree] Tree build duration:', `${buildDuration}ms`)
    console.log('[repository/tree] Total request duration:', `${totalDuration}ms`)
    console.log('[repository/tree] Total database queries:', queryCount)
    console.log('[repository/tree] Node type breakdown:')
    const folderCount = allNodes.filter((n) => n.type === 'FOLDER').length
    const fileCount = allNodes.filter((n) => n.type === 'FILE').length
    console.log(`[repository/tree]   FOLDER: ${folderCount}`)
    console.log(`[repository/tree]   FILE: ${fileCount}`)
    console.log('[repository/tree] ───────────────────────────────────')

    return NextResponse.json({
      success: true,
      repositoryId: repository.id,
      repositoryName: repository.name,
      nodes,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[repository/tree] Error:', msg)
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    )
  }
}
