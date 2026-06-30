import { NextRequest, NextResponse } from 'next/server'
import { RoamCliService } from '@/lib/roam/cli-service'
import { decryptApiKey } from '@/lib/roam/crypto'
import { prisma } from '@/lib/prisma'
import { shouldUseBridge, getBridgeFeatureFlag, logRoutingDecision } from '@/lib/bridge/routing'
import { searchBridge } from '@/lib/bridge/bridge-client'

// POST /api/roam/search
// Searches the Roam graph
export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  console.log(`[ROAM_SEARCH:${requestId}] Request received`)

  try {
    const requestBody = await req.json()
    const { projectId, query = '', graphName, apiToken } = requestBody

    console.log(`[ROAM_SEARCH:${requestId}] Query: "${query || '(empty - returns recent)'}"`)

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId required' },
        { status: 400 }
      )
    }

    // BRIDGE ROUTING LOGIC
    const userId = extractUserIdFromRequest(req) // TODO: Get from actual auth
    const featureFlagEnabled = getBridgeFeatureFlag()
    const routingDecision = await shouldUseBridge(userId, featureFlagEnabled)
    logRoutingDecision(requestId, routingDecision, 'SEARCH')

    const startTime = Date.now()

    // If bridge available: try it first
    if (routingDecision.useBridge) {
      console.log(`[ROAM_SEARCH:${requestId}] ⭐ Attempting bridge search (query: "${query || '(empty)'}") | Endpoint: ${routingDecision.bridgeEndpoint}`)

      try {
        const bridgeConfig = {
          endpoint: routingDecision.bridgeEndpoint!,
          token: routingDecision.bridgeToken!,
          userId,
          requestId,
        }

        const bridgeResponse = await searchBridge(bridgeConfig, graphName, apiToken, query)
        const duration = Date.now() - startTime

        if (bridgeResponse.success) {
          const resultCount = Array.isArray(bridgeResponse.data) ? bridgeResponse.data.length : 0
          console.log(`[ROAM_SEARCH:${requestId}] ✅ Bridge search succeeded | Results: ${resultCount} | Duration: ${duration}ms`)

          return NextResponse.json({
            success: true,
            results: bridgeResponse.data || [],
            _source: 'BRIDGE',
            _duration_ms: duration,
            timestamp: new Date().toISOString(),
          })
        } else {
          const errorCode = bridgeResponse.code || 'UNKNOWN'
          console.warn(
            `[ROAM_SEARCH:${requestId}] ⚠️ Bridge search failed | Error: ${bridgeResponse.error} | Code: ${errorCode} | Falling back to CLI`
          )
          // Fall through to CLI fallback
        }
      } catch (bridgeError) {
        const duration = Date.now() - startTime
        const errorMsg = bridgeError instanceof Error ? bridgeError.message : String(bridgeError)
        console.warn(
          `[ROAM_SEARCH:${requestId}] ⚠️ Bridge request exception after ${duration}ms | Error: ${errorMsg} | Falling back to CLI`
        )
        // Fall through to CLI fallback
      }
    }

    // CLI FALLBACK (EXISTING - unchanged)
    const cliStartTime = Date.now()
    console.log(`[ROAM_SEARCH:${requestId}] 📋 Using CLI fallback for search | Reason: ${routingDecision.reason}`)

    let config = {
      graphName: graphName || '',
      apiToken: apiToken || '',
    }

    // If values not provided in request body, try to load from database
    if (!graphName || !apiToken) {
      console.log(`[ROAM_SEARCH:${requestId}] Form values not fully provided, loading from database`)
      const dbConfig = await prisma.roamConfig.findUnique({
        where: { projectId },
      })

      if (dbConfig) {
        console.log(`[ROAM_SEARCH:${requestId}] Loaded config from database`)
        config = {
          graphName: graphName || dbConfig.graphName,
          apiToken: apiToken || dbConfig.apiToken,
        }
      }
    }

    // Validate required fields
    if (!config.graphName || !config.apiToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Graph name and API token required',
          details: 'Configure Roam connection first',
        },
        { status: 400 }
      )
    }

    // Create client with token
    let decryptedToken: string

    try {
      try {
        decryptedToken = decryptApiKey(config.apiToken)
        console.log(`[ROAM_SEARCH:${requestId}] Token was encrypted, decrypted successfully`)
      } catch (decryptError) {
        console.log(`[ROAM_SEARCH:${requestId}] Token is plain text, using as-is`)
        decryptedToken = config.apiToken
      }

      const cliService = new RoamCliService(config.graphName, decryptedToken)
      console.log(`[ROAM_SEARCH:${requestId}] RoamCliService created for graph: ${config.graphName}`)

      const results = await cliService.search(query)
      const cliDuration = Date.now() - cliStartTime

      console.log(`[ROAM_SEARCH:${requestId}] ✅ CLI search succeeded | Results: ${results.length} | Duration: ${cliDuration}ms`)

      // Log successful operation
      try {
        await prisma.syncLog.create({
          data: {
            projectId,
            action: 'SEARCH',
            status: 'SUCCESS',
            durationMs: cliDuration,
          },
        })
      } catch (logError) {
        console.log(`[ROAM_SEARCH:${requestId}] Could not log to database`)
      }

      return NextResponse.json({
        success: true,
        results: results || [],
        _source: 'CLI',
        _duration_ms: cliDuration,
        _fallback_reason: routingDecision.reason,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'

      console.error(`[ROAM_SEARCH:${requestId}] Search error: ${errorMsg}`)

      try {
        await prisma.syncLog.create({
          data: {
            projectId,
            action: 'SEARCH',
            status: 'FAILED',
            error: errorMsg,
          },
        })
      } catch (logError) {
        console.log(`[ROAM_SEARCH:${requestId}] Could not log failure to database`)
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMsg,
          details: 'Check server logs for details',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[ROAM_SEARCH] Fatal error:`, errorMsg)

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        details: 'Check server logs for details',
      },
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
