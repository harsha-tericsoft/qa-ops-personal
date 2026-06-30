import { NextRequest, NextResponse } from 'next/server'
import { RoamCliService } from '@/lib/roam/cli-service'
import { decryptApiKey } from '@/lib/roam/crypto'
import { prisma } from '@/lib/prisma'
import { shouldUseBridge, getBridgeFeatureFlag, logRoutingDecision } from '@/lib/bridge/routing'
import { fetchPageFromBridge } from '@/lib/bridge/bridge-client'

// GET /api/roam/page?title=...
// Fetches a specific page from the Roam graph
export async function GET(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  console.log(`[ROAM_PAGE:${requestId}] Request received`)

  try {
    const searchParams = req.nextUrl.searchParams
    const pageTitle = searchParams.get('title')
    const projectId = searchParams.get('projectId')
    const graphName = searchParams.get('graphName')
    const apiToken = searchParams.get('apiToken')

    console.log(`[ROAM_PAGE:${requestId}] Page title: "${pageTitle}"`)

    if (!pageTitle) {
      return NextResponse.json(
        { success: false, error: 'Page title (title parameter) required' },
        { status: 400 }
      )
    }

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
    logRoutingDecision(requestId, routingDecision, 'GET_PAGE')

    const startTime = Date.now()

    // If bridge available: try it first
    if (routingDecision.useBridge) {
      console.log(`[ROAM_PAGE:${requestId}] ⭐ Attempting bridge page fetch | Title: "${pageTitle}" | Endpoint: ${routingDecision.bridgeEndpoint}`)

      try {
        const bridgeConfig = {
          endpoint: routingDecision.bridgeEndpoint!,
          token: routingDecision.bridgeToken!,
          userId,
          requestId,
        }

        const bridgeResponse = await fetchPageFromBridge(bridgeConfig, pageTitle)
        const duration = Date.now() - startTime

        if (bridgeResponse.success) {
          console.log(`[ROAM_PAGE:${requestId}] ✅ Bridge page fetch succeeded | Duration: ${duration}ms`)
          return NextResponse.json({
            success: true,
            page: bridgeResponse.data || null,
            _source: 'BRIDGE',
            _duration_ms: duration,
            timestamp: new Date().toISOString(),
          })
        } else {
          const errorCode = bridgeResponse.code || 'UNKNOWN'
          console.warn(
            `[ROAM_PAGE:${requestId}] ⚠️ Bridge page fetch failed | Error: ${bridgeResponse.error} | Code: ${errorCode} | Falling back to CLI`
          )
          // Fall through to CLI fallback
        }
      } catch (bridgeError) {
        const duration = Date.now() - startTime
        const errorMsg = bridgeError instanceof Error ? bridgeError.message : String(bridgeError)
        console.warn(
          `[ROAM_PAGE:${requestId}] ⚠️ Bridge request exception after ${duration}ms | Error: ${errorMsg} | Falling back to CLI`
        )
        // Fall through to CLI fallback
      }
    }

    // CLI FALLBACK (EXISTING - unchanged)
    const cliStartTime = Date.now()
    console.log(`[ROAM_PAGE:${requestId}] 📋 Using CLI fallback for page fetch | Reason: ${routingDecision.reason}`)

    let config = {
      graphName: graphName || '',
      apiToken: apiToken || '',
    }

    // If values not provided in request, try to load from database
    if (!graphName || !apiToken) {
      console.log(`[ROAM_PAGE:${requestId}] Form values not fully provided, loading from database`)
      const dbConfig = await prisma.roamConfig.findUnique({
        where: { projectId },
      })

      if (dbConfig) {
        console.log(`[ROAM_PAGE:${requestId}] Loaded config from database`)
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
        console.log(`[ROAM_PAGE:${requestId}] Token was encrypted, decrypted successfully`)
      } catch (decryptError) {
        console.log(`[ROAM_PAGE:${requestId}] Token is plain text, using as-is`)
        decryptedToken = config.apiToken
      }

      const cliService = new RoamCliService(config.graphName, decryptedToken)
      console.log(`[ROAM_PAGE:${requestId}] RoamCliService created for graph: ${config.graphName}`)

      const page = await cliService.fetchPageByTitle(pageTitle)
      const cliDuration = Date.now() - cliStartTime

      console.log(`[ROAM_PAGE:${requestId}] ✅ CLI page fetch succeeded | Duration: ${cliDuration}ms`)

      if (!page) {
        console.warn(`[ROAM_PAGE:${requestId}] ⚠️ Page not found: "${pageTitle}"`)
        return NextResponse.json(
          {
            success: false,
            error: 'Page not found',
            details: `No page found with title "${pageTitle}"`,
            _source: 'CLI',
            _duration_ms: cliDuration,
            _fallback_reason: routingDecision.reason,
          },
          { status: 404 }
        )
      }

      // Log successful operation
      try {
        await prisma.syncLog.create({
          data: {
            projectId,
            action: 'FETCH_PAGE',
            status: 'SUCCESS',
            durationMs: cliDuration,
          },
        })
      } catch (logError) {
        console.log(`[ROAM_PAGE:${requestId}] Could not log to database`)
      }

      return NextResponse.json({
        success: true,
        page: page,
        _source: 'CLI',
        _duration_ms: cliDuration,
        _fallback_reason: routingDecision.reason,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'

      console.error(`[ROAM_PAGE:${requestId}] Page fetch error: ${errorMsg}`)

      try {
        await prisma.syncLog.create({
          data: {
            projectId,
            action: 'FETCH_PAGE',
            status: 'FAILED',
            error: errorMsg,
          },
        })
      } catch (logError) {
        console.log(`[ROAM_PAGE:${requestId}] Could not log failure to database`)
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
    console.error(`[ROAM_PAGE] Fatal error:`, errorMsg)

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
