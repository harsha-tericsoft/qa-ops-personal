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
    const skipCache = request.nextUrl.searchParams.get('skipCache') === 'true'

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    // Check cache first
    if (!skipCache) {
      const cached = getCachedMetrics(projectId)
      if (cached) {
        return NextResponse.json(cached)
      }
    }

    try {
      // OPTIMIZED: Run all queries in parallel
      // Also use select to only get needed fields, not full objects
      const startTime = Date.now()

      const [
        totalTests,
        automatedTests,
        draftCycles,
        activeCycles,
        completedCycles,
        tags,
        lastSync,
      ] = await Promise.all([
        // Query 1: Count total tests
        prisma.roamTestCase.count({
          where: { projectId },
        }),

        // Query 2: Count automated tests (optimized)
        // Use native query if tags filtering is slow
        prisma.roamTestCase.count({
          where: {
            projectId,
            tags: { has: 'Automated' },
          },
        }),

        // Query 3: Count draft cycles
        prisma.executionCycle.count({
          where: { projectId, status: 'PLANNED' },
        }),

        // Query 4: Count active cycles
        prisma.executionCycle.count({
          where: { projectId, status: 'IN_PROGRESS' },
        }),

        // Query 5: Count completed cycles
        prisma.executionCycle.count({
          where: { projectId, status: 'COMPLETED' },
        }),

        // Query 6: Get unique tags
        prisma.tag.findMany({
          where: { projectId },
          distinct: ['name'],
          select: { name: true },
          take: 50, // Limit to first 50 tags
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
        draftCycles,
        activeCycles,
        completedCycles,
        tags: tags.map(t => t.name),
        lastSync: lastSync ? {
          time: lastSync.createdAt,
          status: lastSync.status,
        } : null,
      }

      // Cache the results
      setCachedMetrics(projectId, response)

      const elapsed = Date.now() - startTime
      console.log(`[repository-metrics] Completed in ${elapsed}ms for project ${projectId}`)

      return NextResponse.json(response)
    } catch (dbErr) {
      console.error('[repository-metrics] Database error:', dbErr)
      // Return empty metrics on database error
      return NextResponse.json({
        totalTests: 0,
        manualTests: 0,
        automatedTests: 0,
        coverage: 0,
        draftCycles: 0,
        activeCycles: 0,
        completedCycles: 0,
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
