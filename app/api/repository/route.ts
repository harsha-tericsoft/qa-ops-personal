import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/repository - Get repository hierarchy (flat list of all nodes)
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  try {
    // Query 1: Check if repository exists
    const repo = await prisma.repository.findFirst({
      where: { projectId },
      select: {
        id: true,
        name: true,
      },
    })

    if (!repo) {
      return NextResponse.json({ nodes: [] })
    }

    // Query 2: Fetch ALL nodes for this repository (needed for client-side tree building)
    // RepositoryTree component builds complete hierarchy client-side without lazy loading
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

    return NextResponse.json({
      id: repo.id,
      name: repo.name,
      nodes: allNodes,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[api/repository] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
