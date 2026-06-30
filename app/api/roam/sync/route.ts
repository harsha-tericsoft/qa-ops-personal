import { NextRequest, NextResponse } from 'next/server'
import { initialSync, refreshSync } from '@/lib/roam/sync'
import { shouldUseBridge, getBridgeFeatureFlag, logRoutingDecision } from '@/lib/bridge/routing'
import { syncTestCases } from '@/lib/bridge/bridge-client'

// POST /api/roam/sync
export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)

  try {
    const { projectId, syncType = 'refresh' } = await req.json()

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId required' },
        { status: 400 }
      )
    }

    if (syncType !== 'initial' && syncType !== 'refresh') {
      return NextResponse.json(
        { success: false, error: 'Invalid syncType. Use "initial" or "refresh".' },
        { status: 400 }
      )
    }

    // BRIDGE ROUTING LOGIC (NEW - Parallel path)
    // Get routing decision
    const userId = extractUserIdFromRequest(req) // TODO: Get from actual auth
    const featureFlagEnabled = getBridgeFeatureFlag()
    const routingDecision = await shouldUseBridge(userId, featureFlagEnabled)
    logRoutingDecision(requestId, routingDecision, 'SYNC')

    // If bridge available: try it first
    if (routingDecision.useBridge) {
      console.log(
        `[ROAM_SYNC:${requestId}] Attempting bridge sync for project ${projectId}`
      )

      try {
        // Load Roam configuration for credentials
        const { prisma } = await import('@/lib/prisma')
        const roamConfig = await prisma.roamConfig.findUnique({
          where: { projectId },
        })

        if (!roamConfig || !roamConfig.graphName || !roamConfig.apiToken) {
          console.warn(
            `[ROAM_SYNC:${requestId}] Roam config not found or incomplete, falling back to CLI`
          )
          // Fall through to CLI fallback
        } else {
          const bridgeConfig = {
            endpoint: routingDecision.bridgeEndpoint!,
            token: routingDecision.bridgeToken!,
            userId,
            requestId,
          }

          const bridgeResponse = await syncTestCases(
            bridgeConfig,
            projectId,
            syncType,
            roamConfig.graphName,
            roamConfig.apiToken
          )

          if (bridgeResponse.success) {
            console.log(`[ROAM_SYNC:${requestId}] Bridge sync successful`)
            return NextResponse.json({
              ...bridgeResponse,
              _source: 'BRIDGE',
            })
          } else {
            console.warn(
              `[ROAM_SYNC:${requestId}] Bridge sync failed: ${bridgeResponse.error}`
            )
            // Fall through to CLI fallback
          }
        }
      } catch (bridgeError) {
        console.warn(
          `[ROAM_SYNC:${requestId}] Bridge request failed, falling back to CLI:`,
          bridgeError instanceof Error ? bridgeError.message : bridgeError
        )
        // Fall through to CLI fallback
      }
    }

    // CLI FALLBACK (EXISTING - Unchanged)
    // All original code preserved - runs if bridge disabled or failed
    console.log(`[ROAM_SYNC:${requestId}] Using CLI fallback for sync`)

    if (syncType === 'initial') {
      const result = await initialSync(projectId)
      return NextResponse.json({
        ...result,
        _source: 'CLI',
      })
    } else {
      // syncType === 'refresh' (checked above)
      const result = await refreshSync(projectId)
      return NextResponse.json({
        ...result,
        _source: 'CLI',
      })
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[ROAM_SYNC:${requestId}] Fatal error:`, msg)
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    )
  }
}

/**
 * Extract user ID from request (placeholder)
 * TODO: Get from actual authentication system
 */
function extractUserIdFromRequest(req: NextRequest): string {
  // Placeholder - will be replaced with actual auth
  return 'user_placeholder'
}
