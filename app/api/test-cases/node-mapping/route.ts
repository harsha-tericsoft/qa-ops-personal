import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Cache for node mappings (projectId -> mapping data)
const nodeMappingCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCachedMappings(projectId: string) {
  const cached = nodeMappingCache.get(projectId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('[api/test-cases/node-mapping] Cache HIT for project:', projectId)
    return cached.data
  }
  return null
}

function setCachedMappings(projectId: string, data: any) {
  nodeMappingCache.set(projectId, { data, timestamp: Date.now() })
}

// Fast endpoint for tree selector: returns ONLY id + repositoryNodeId (minimal data)
// Used by RepositoryTreeSelector to show test counts per node
export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId')

  if (!projectId) {
    return NextResponse.json(
      { error: 'projectId is required' },
      { status: 400 }
    )
  }

  try {
    // Check cache first
    const cached = getCachedMappings(projectId)
    if (cached) {
      return NextResponse.json(cached)
    }

    console.log('[api/test-cases/node-mapping] Fetching node mappings for project:', projectId)
    const startTime = Date.now()

    // OPTIMIZED: Fetch ONLY the minimal fields needed
    // No title, no sourceRoamUid, no ordering - just pure mapping data
    const testCases = await prisma.roamTestCase.findMany({
      where: { projectId },
      select: {
        id: true,
        repositoryNodeId: true,
      },
      // No orderBy - faster query without sorting
      // No skip/take - get all in one go
    })

    const elapsed = Date.now() - startTime
    console.log(
      `[api/test-cases/node-mapping] Fetched ${testCases.length} mappings in ${elapsed}ms`
    )

    const response = {
      data: testCases,
      count: testCases.length,
    }

    // Cache the result
    setCachedMappings(projectId, response)

    return NextResponse.json(response)
  } catch (error) {
    console.error('[test-cases/node-mapping] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
