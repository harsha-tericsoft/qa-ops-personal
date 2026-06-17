import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { refreshSync } from '@/lib/roam/sync'

/**
 * Scheduled sync endpoint - called every 5 minutes
 * Refreshes all configured Roam repositories and updates test case metrics
 *
 * Usage with cron service:
 * POST /api/roam/scheduled-sync every 5 minutes
 *
 * Example with curl:
 * curl -X POST http://localhost:3000/api/roam/scheduled-sync
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[scheduled-sync] Starting scheduled sync...')
    const startTime = Date.now()

    // Get all projects with Roam configuration
    const configs = await prisma.roamConfig.findMany({
      where: {
        AND: [
          { apiToken: { not: '' } },
          { repositoryRootPage: { not: '' } },
        ],
      },
    })

    console.log('[scheduled-sync] Found', configs.length, 'projects to sync')

    const results = []
    for (const config of configs) {
      try {
        console.log('[scheduled-sync] Syncing project:', config.projectId)
        const result = await refreshSync(config.projectId)
        results.push({
          projectId: config.projectId,
          success: result.success,
          message: result.message,
          nodesAdded: result.nodesAdded,
          nodesUpdated: result.nodesUpdated,
        })
      } catch (error) {
        console.error('[scheduled-sync] Error syncing project:', config.projectId, error)
        results.push({
          projectId: config.projectId,
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const duration = Date.now() - startTime

    // Log sync job
    await prisma.syncLog.create({
      data: {
        projectId: configs[0]?.projectId || 'system',
        action: 'SCHEDULED_SYNC',
        status: results.every((r) => r.success) ? 'SUCCESS' : 'PARTIAL',
        nodesAdded: results.reduce((sum, r) => sum + (r.nodesAdded || 0), 0),
        nodesUpdated: results.reduce((sum, r) => sum + (r.nodesUpdated || 0), 0),
        error: results.filter((r) => !r.success).length > 0 ? `${results.filter((r) => !r.success).length} projects failed` : null,
        durationMs: duration,
      },
    }).catch(() => null) // Ignore errors in logging

    console.log('[scheduled-sync] Completed in', duration, 'ms')

    return NextResponse.json({
      success: true,
      message: `Scheduled sync completed: ${results.length} projects processed`,
      results,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[scheduled-sync] Fatal error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

/**
 * Health check for scheduled sync
 * Returns status of last 5 sync jobs
 */
export async function GET() {
  try {
    const recentSyncs = await prisma.syncLog.findMany({
      where: { action: 'SCHEDULED_SYNC' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    return NextResponse.json({
      status: 'healthy',
      lastSyncCount: recentSyncs.length,
      lastSync: recentSyncs[0] || null,
      recentSyncs: recentSyncs.slice(0, 5),
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
