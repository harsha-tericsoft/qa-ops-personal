import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface LightweightNode {
  id: string
  name: string
  type: string
  depth: number
  hasChildren: boolean
  children?: LightweightNode[]
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    const parentId = request.nextUrl.searchParams.get('parentId')

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      )
    }

    // Find the repository
    const repository = await prisma.repository.findFirst({
      where: { projectId },
    })

    if (!repository) {
      return NextResponse.json([])
    }

    // If parentId provided, fetch direct children only (lazy loading)
    if (parentId) {
      const queryStart = Date.now()
      const nodes = await prisma.repositoryNode.findMany({
        where: {
          parentId: parentId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          type: true,
          depth: true,
        },
        orderBy: { name: 'asc' },
      })

      const queryMs = Date.now() - queryStart

      // Check which ones have children
      const nodeIds = nodes.map((n) => n.id)
      const childCounts = await prisma.repositoryNode.groupBy({
        by: ['parentId'],
        where: { parentId: { in: nodeIds }, deletedAt: null },
        _count: true,
      })

      const childCountMap = new Map(
        childCounts.map((c) => [c.parentId, c._count > 0])
      )

      const result = nodes.map((n) => ({
        id: n.id,
        name: n.name,
        type: n.type,
        depth: n.depth,
        hasChildren: childCountMap.get(n.id) || false,
      }))

      const totalMs = Date.now() - startTime
      console.log(`[hierarchy/children] Fetched ${result.length} children in ${queryMs}ms (total ${totalMs}ms)`)

      return NextResponse.json(result)
    }

    // Root query: Get top-level nodes only (depth 0-1)
    const queryStart = Date.now()
    const rootNodes = await prisma.repositoryNode.findMany({
      where: {
        repositoryId: repository.id,
        deletedAt: null,
        depth: { lte: 1 },
      },
      select: {
        id: true,
        name: true,
        type: true,
        depth: true,
      },
      orderBy: { name: 'asc' },
    })

    const queryMs = Date.now() - queryStart

    // Check which ones have children
    const nodeIds = rootNodes.map((n) => n.id)
    const childCounts = await prisma.repositoryNode.groupBy({
      by: ['parentId'],
      where: { parentId: { in: nodeIds }, deletedAt: null },
      _count: true,
    })

    const childCountMap = new Map(
      childCounts.map((c) => [c.parentId, c._count > 0])
    )

    const result: LightweightNode[] = rootNodes.map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      depth: n.depth,
      hasChildren: childCountMap.get(n.id) || false,
    }))

    const totalMs = Date.now() - startTime
    console.log(`[hierarchy/root] Fetched ${result.length} root nodes in ${queryMs}ms (total ${totalMs}ms)`)

    return NextResponse.json(result)
  } catch (error) {
    console.error('[test-cases/hierarchy] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

