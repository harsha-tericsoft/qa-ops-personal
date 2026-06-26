import { NextRequest, NextResponse } from 'next/server'
import { prisma, incrementActiveRequests, decrementActiveRequests, getPoolStatus } from '@/lib/prisma'

// Simple in-memory cache for metrics
// Reduced TTL to 30 seconds since versions change frequently
const metricsCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 30 * 1000 // 30 seconds (was 5 minutes - too long!)

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
  const requestId = Math.random().toString(36).substr(2, 9)
  const startTime = Date.now()

  try {
    incrementActiveRequests()
    const poolStatus = getPoolStatus()
    console.log(`[repository-metrics:${requestId}] START - ${poolStatus.activeRequests} active requests`)

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
        console.log(`[repository-metrics:${requestId}] Cache HIT (30s TTL)`)
        const elapsed = Date.now() - startTime
        console.log(`[repository-metrics:${requestId}] FINISH (${elapsed}ms)`)
        decrementActiveRequests()
        return NextResponse.json(cached)
      } else {
        console.log(`[repository-metrics:${requestId}] Cache MISS`)
      }
    } else {
      console.log(`[repository-metrics:${requestId}] Cache SKIPPED`)
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
        // For Level 1, we need to find all cycle IDs for this project first
        // Then count versions in those cycles
        const cycleIds = await prisma.executionCycle.findMany({
          where: { projectId },
          select: { id: true },
        })
        const cycleIdList = cycleIds.map(c => c.id)

        // Now use these cycle IDs to filter versions
        draftWhere = {
          cycleId: { in: cycleIdList },
          status: 'DRAFT'
        }
        activeWhere = {
          cycleId: { in: cycleIdList },
          status: 'IN_PROGRESS'
        }
        completedWhere = {
          cycleId: { in: cycleIdList },
          status: 'COMPLETED'
        }
      }

      // CHANGED: Run queries SEQUENTIALLY instead of Promise.all()
      // Reason: 7 concurrent queries exhaust the connection pool (only ~10-15 total)
      // Sequential is slower but prevents pool exhaustion and ECHECKOUTTIMEOUT errors
      console.log(`[repository-metrics:${requestId}] Running 7 queries sequentially (changed from concurrent Promise.all)`)

      console.log(`[repository-metrics:${requestId}] Query 1: total tests count`)
      const totalTests = await prisma.roamTestCase.count({
        where: { projectId },
      })

      console.log(`[repository-metrics:${requestId}] Query 2: automated tests count`)
      const automatedTests = await prisma.roamTestCase.count({
        where: {
          projectId,
          tags: { has: 'Automated' },
        },
      })

      console.log(`[repository-metrics:${requestId}] Query 3: draft versions count`)
      const draftVersions = typeof draftWhere === 'number'
        ? draftWhere
        : await prisma.executionVersion.count({ where: draftWhere })

      console.log(`[repository-metrics:${requestId}] Query 4: active versions count`)
      const activeVersions = typeof activeWhere === 'number'
        ? activeWhere
        : await prisma.executionVersion.count({ where: activeWhere })

      console.log(`[repository-metrics:${requestId}] Query 5: completed versions count`)
      const completedVersions = typeof completedWhere === 'number'
        ? completedWhere
        : await prisma.executionVersion.count({ where: completedWhere })

      console.log(`[repository-metrics:${requestId}] Query 6: unique tags`)
      const tags = await prisma.tag.findMany({
        where: { projectId },
        distinct: ['name'],
        select: { name: true },
        take: 50,
      })

      console.log(`[repository-metrics:${requestId}] Query 7: last sync`)
      const lastSync = await prisma.syncLog.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, status: true },
      })

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
      console.log(`[repository-metrics:${requestId}] Completed in ${elapsed}ms`)
      decrementActiveRequests()
      const poolStatusEnd = getPoolStatus()
      console.log(`[repository-metrics:${requestId}] FINISH - ${poolStatusEnd.activeRequests} active requests remain`)

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
    const elapsed = Date.now() - startTime
    console.log(`[repository-metrics:${requestId}] ERROR after ${elapsed}ms`)
    decrementActiveRequests()
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
