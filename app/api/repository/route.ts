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

    // Query 2: Fetch all nodes for this repository (flat list)
    // Using separate query instead of include to avoid N+1 and large result sets
    // Get root level nodes only to avoid fetching thousands of rows
    const nodes = await prisma.repositoryNode.findMany({
      where: {
        repositoryId: repo.id,
        // Fetch root nodes first, lazy load children on demand
        depth: 0,
      },
      orderBy: [{ order: 'asc' }],
      select: {
        id: true,
        name: true,
        type: true,
        parentId: true,
        depth: true,
      },
    })

    // If no root nodes, fetch first 100 nodes (fallback for flat structures)
    const allNodes = nodes.length === 0 ? await prisma.repositoryNode.findMany({
      where: { repositoryId: repo.id },
      orderBy: [{ depth: 'asc' }, { order: 'asc' }],
      take: 100,
      select: {
        id: true,
        name: true,
        type: true,
        parentId: true,
        depth: true,
      },
    }) : nodes

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
