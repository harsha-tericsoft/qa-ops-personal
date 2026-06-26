import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Simple in-memory cache for repository nodes
const repositoryCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 60 * 1000 // 60 seconds

function getCachedRepository(projectId: string) {
  const cached = repositoryCache.get(projectId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('[api/repository] Cache HIT for project:', projectId)
    return cached.data
  }
  return null
}

function setCachedRepository(projectId: string, data: any) {
  repositoryCache.set(projectId, { data, timestamp: Date.now() })
}

// GET /api/repository - Get repository hierarchy (flat list of all nodes)
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  try {
    // Check cache first
    const cached = getCachedRepository(projectId)
    if (cached) {
      return NextResponse.json(cached)
    }

    console.log('[api/repository] Fetching repository for project:', projectId)
    const startTime = Date.now()

    // Query 1: Check if repository exists
    const repo = await prisma.repository.findFirst({
      where: { projectId },
      select: {
        id: true,
        name: true,
      },
    })

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

    const elapsed = Date.now() - startTime
    console.log(`[api/repository] Found ${allNodes.length} nodes in ${elapsed}ms`)

    const response = {
      id: repo.id,
      name: repo.name,
      nodes: allNodes,
    }

    // Cache the result
    setCachedRepository(projectId, response)

    return NextResponse.json(response)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[api/repository] Error:', msg)
    console.error('[api/repository] Full error:', error)
    return NextResponse.json({ error: msg, code: 'REPOSITORY_ERROR' }, { status: 500 })
  }
}
