import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/repository - Get repository hierarchy (flat list of all nodes)
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  try {
    console.log('[api/repository] Fetching repository for project:', projectId)

    // Query 1: Check if repository exists
    const repo = await prisma.repository.findFirst({
      where: { projectId },
      select: {
        id: true,
        name: true,
      },
    })

    console.log('[api/repository] Repository found:', repo?.id)

    if (!repo) {
      console.log('[api/repository] No repository found, returning empty nodes')
      return NextResponse.json({ nodes: [] })
    }

    // Query 2: Fetch ALL nodes for this repository (needed for client-side tree building)
    // RepositoryTree component builds complete hierarchy client-side without lazy loading
    console.log('[api/repository] Fetching nodes for repository:', repo.id)

    const allNodes = await prisma.repositoryNode.findMany({
      where: { repositoryId: repo.id },
      orderBy: [{ depth: 'asc' }, { order: 'asc' }],
      select: {
        id: true,
        name: true,
        type: true,
        parentId: true,
        depth: true,
      },
    })

    console.log('[api/repository] Found', allNodes.length, 'nodes')

    return NextResponse.json({
      id: repo.id,
      name: repo.name,
      nodes: allNodes,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[api/repository] Error:', msg)
    console.error('[api/repository] Full error:', error)
    return NextResponse.json({ error: msg, code: 'REPOSITORY_ERROR' }, { status: 500 })
  }
}
