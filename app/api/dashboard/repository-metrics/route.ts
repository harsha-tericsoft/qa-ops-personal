import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Simple in-memory cache for metrics (5 minute TTL)
const metricsCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCachedMetrics(projectId: string) {
  const cached = metricsCache.get(projectId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  return null
}

function setCachedMetrics(projectId: string, data: any) {
  metricsCache.set(projectId, { data, timestamp: Date.now() })
}

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    const cycleId = request.nextUrl.searchParams.get('cycleId')
    const versionId = request.nextUrl.searchParams.get('versionId')
    const skipCache = request.nextUrl.searchParams.get('skipCache') === 'true'

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    // Generate cache key based on filters
    const cacheKey = `${projectId}:${cycleId || 'all'}:${versionId || 'all'}`

    // Check cache first
    if (!skipCache) {
      const cached = getCachedMetrics(cacheKey)
      if (cached) {
        console.log(`[repository-metrics] Cache HIT for ${cacheKey}`)
        return NextResponse.json(cached)
      }
    }

    try {
      const startTime = Date.now()
      console.log(`[repository-metrics] Query: project=${projectId}, cycle=${cycleId || 'all'}, version=${versionId || 'all'}`)

      // Build where clauses based on filters
      let draftWhere: any, activeWhere: any, completedWhere: any

      if (versionId) {
        // LEVEL 3: Show status of ONLY that selected version
        console.log('[repository-metrics] Level 3: Single version selected')
        const version = await prisma.executionVersion.findUnique({
          where: { id: versionId },
          select: { status: true },
        })

        if (!version) {
          return NextResponse.json({ error: 'Version not found' }, { status: 404 })
        }

        draftWhere = version.status === 'DRAFT' ? 1 : 0
        activeWhere = version.status === 'IN_PROGRESS' ? 1 : 0
        completedWhere = version.status === 'COMPLETED' ? 1 : 0
      } else if (cycleId) {
        // LEVEL 2: Count versions in THAT specific cycle only
        console.log('[repository-metrics] Level 2: Cycle selected')
        draftWhere = { cycleId, status: 'DRAFT' }
        activeWhere = { cycleId, status: 'IN_PROGRESS' }
        completedWhere = { cycleId, status: 'COMPLETED' }
      } else {
        // LEVEL 1: Count versions across ALL cycles in project
        console.log('[repository-metrics] Level 1: Project only')
        // Filter versions by cycles that belong to this project
        draftWhere = {
          cycle: { projectId },
          status: 'DRAFT'
        }
        activeWhere = {
          cycle: { projectId },
          status: 'IN_PROGRESS'
        }
        completedWhere = {
          cycle: { projectId },
          status: 'COMPLETED'
        }
      }

      // OPTIMIZED: Run all queries in parallel
      const [
        totalTests,
        automatedTests,
        draftVersions,
        activeVersions,
        completedVersions,
        tags,
        lastSync,
      ] = await Promise.all([
        // Query 1: Count total tests
        prisma.roamTestCase.count({
          where: { projectId },
        }),

        // Query 2: Count automated tests
        prisma.roamTestCase.count({
          where: {
            projectId,
            tags: { has: 'Automated' },
          },
        }),

        // Query 3: Count draft versions (or check single version)
        typeof draftWhere === 'number'
          ? Promise.resolve(draftWhere)
          : prisma.executionVersion.count({ where: draftWhere }),

        // Query 4: Count active versions (or check single version)
        typeof activeWhere === 'number'
          ? Promise.resolve(activeWhere)
          : prisma.executionVersion.count({ where: activeWhere }),

        // Query 5: Count completed versions (or check single version)
        typeof completedWhere === 'number'
          ? Promise.resolve(completedWhere)
          : prisma.executionVersion.count({ where: completedWhere }),

        // Query 6: Get unique tags
        prisma.tag.findMany({
          where: { projectId },
          distinct: ['name'],
          select: { name: true },
          take: 50,
        }),

        // Query 7: Get last sync
        prisma.syncLog.findFirst({
          where: { projectId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true, status: true },
        }),
      ])

      const manualTests = totalTests - automatedTests
      const coverage = totalTests > 0 ? (automatedTests / totalTests) * 100 : 0

      const response = {
        totalTests,
        manualTests,
        automatedTests,
        coverage: parseFloat(coverage.toFixed(1)),
        draftVersions,
        activeVersions,
        completedVersions,
        tags: tags.map(t => t.name),
        lastSync: lastSync ? {
          time: lastSync.createdAt,
          status: lastSync.status,
        } : null,
      }

      // Cache the results (using enhanced cache key)
      setCachedMetrics(cacheKey, response)

      const elapsed = Date.now() - startTime
      console.log(`[repository-metrics] Completed in ${elapsed}ms`)

      return NextResponse.json(response)
    } catch (dbErr) {
      console.error('[repository-metrics] Database error:', dbErr)
      // Return empty metrics on database error
      return NextResponse.json({
        totalTests: 0,
        manualTests: 0,
        automatedTests: 0,
        coverage: 0,
        draftVersions: 0,
        activeVersions: 0,
        completedVersions: 0,
        tags: [],
        lastSync: null,
      })
    }
  } catch (error) {
    console.error('[repository-metrics] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
