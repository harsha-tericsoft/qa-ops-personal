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

// GET /api/repository/tree?projectId={id}&parentId={parentId}
// Returns tree structure with lazy loading support
// If parentId is null, returns only root nodes
// If parentId is provided, returns children of that node
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  let queryCount = 0

  try {
    const projectId = req.nextUrl.searchParams.get('projectId')
    const parentId = req.nextUrl.searchParams.get('parentId') || null
    const search = req.nextUrl.searchParams.get('search')
    const tags = req.nextUrl.searchParams.getAll('tags')
    const nodeType = req.nextUrl.searchParams.get('nodeType')
    const isAutomated = req.nextUrl.searchParams.get('automated')

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId required' },
        { status: 400 }
      )
    }

    // Log filter parameters
    if (search) console.log('[repository/tree] Search filter:', search)
    if (tags.length > 0) console.log('[repository/tree] Tag filters:', tags)
    if (nodeType) console.log('[repository/tree] Type filter:', nodeType)
    if (isAutomated) console.log('[repository/tree] Automated filter:', isAutomated)

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

    // Build WHERE clause with filters
    const whereClause: any = {
      repositoryId,
      deletedAt: null,
      parentId: parentId, // Lazy load: only load this parent's children
    }

    // Add search filter (search in name or path)
    if (search) {
      whereClause.AND = [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { path: { contains: search, mode: 'insensitive' } },
          ]
        }
      ]
    }

    // Add node type filter
    if (nodeType) {
      if (whereClause.AND) {
        whereClause.AND.push({ type: nodeType })
      } else {
        whereClause.type = nodeType
      }
    }

    // Add tag filter (node must have at least one of the selected tags)
    if (tags.length > 0) {
      if (whereClause.AND) {
        whereClause.AND.push({ tags: { hasSome: tags } })
      } else {
        whereClause.tags = { hasSome: tags }
      }
    }

    // Add manual/automated filter (based on tags containing 'Automated' or 'Manual')
    if (isAutomated !== null && isAutomated !== '') {
      const automatedValue = isAutomated === 'true'
      if (automatedValue) {
        // Filter to nodes with 'Automated' tag
        if (whereClause.AND) {
          whereClause.AND.push({ tags: { has: 'Automated' } })
        } else {
          whereClause.tags = { has: 'Automated' }
        }
      } else {
        // Filter to nodes WITHOUT 'Automated' tag
        if (whereClause.AND) {
          whereClause.AND.push({ NOT: { tags: { has: 'Automated' } } })
        } else {
          whereClause.NOT = { tags: { has: 'Automated' } }
        }
      }
    }

    // Query 2: Load nodes for this level only (lazy loading)
    console.log(`[repository/tree] Query 2: Loading nodes (parentId: ${parentId || 'root'})...`)
    const nodes = await prisma.repositoryNode.findMany({
      where: whereClause,
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        type: true,
        depth: true,
        path: true,
        metadata: true,
        tags: true,
        roamPageId: true,
      },
    })
    queryCount++

    const totalDuration = Date.now() - startTime
    console.log('[repository/tree] Queries complete, loaded nodes:', nodes.length)
    console.log('[repository/tree] Total request duration:', `${totalDuration}ms`)
    console.log('[repository/tree] Total database queries:', queryCount)

    return NextResponse.json({
      success: true,
      repositoryId: repository.id,
      repositoryName: repository.name,
      nodes: nodes.map((node) => ({
        ...node,
        children: [], // Children loaded on demand via separate request
        hasMore: node.type === 'FOLDER', // FOLDER types can be expanded to load children
      })),
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
