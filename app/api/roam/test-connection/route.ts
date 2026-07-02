import { NextRequest, NextResponse } from 'next/server'
import { RoamClient } from '@/lib/roam/client'
import { RoamCliService } from '@/lib/roam/cli-service'
import { decryptApiKey } from '@/lib/roam/crypto'
import { prisma } from '@/lib/prisma'
import { shouldUseBridge, getBridgeFeatureFlag, logRoutingDecision } from '@/lib/bridge/routing'
import { testBridgeConnection } from '@/lib/bridge/bridge-client'

// POST /api/roam/test-connection
// Tests connection to Roam Desktop using provided or saved configuration
// Accepts either form values or saved config
export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  let bridgeResponse: any = null
  let cliResponse: any = null
  let finalResponse: any = null

  const execEnv = {
    platform: process.platform,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    vercelUrl: process.env.VERCEL_URL,
    hostname: require('os').hostname(),
  }

  console.log(`[TEST_CONNECTION:${requestId}] ===== EXECUTION ENVIRONMENT DIAGNOSTIC =====`)
  console.log(`[TEST_CONNECTION:${requestId}] Execution Platform: ${execEnv.platform}`)
  console.log(`[TEST_CONNECTION:${requestId}] Node Environment: ${execEnv.nodeEnv}`)
  console.log(`[TEST_CONNECTION:${requestId}] Vercel Environment: ${execEnv.vercelEnv || 'NOT_SET'}`)
  console.log(`[TEST_CONNECTION:${requestId}] Vercel URL: ${execEnv.vercelUrl || 'NOT_SET'}`)
  console.log(`[TEST_CONNECTION:${requestId}] Hostname: ${execEnv.hostname}`)
  console.log(`[TEST_CONNECTION:${requestId}] ==========================================`)
  console.log(`[TEST_CONNECTION:${requestId}] Request received`)

  try {
    const requestBody = await req.json()
    const { projectId, graphName, apiToken, repositoryRootPage } = requestBody

    console.log(`[TEST_CONNECTION:${requestId}] Raw request body received:`)
    console.log(JSON.stringify(requestBody, null, 2))

    console.log(`[TEST_CONNECTION:${requestId}] Parsed parameters:`)
    console.log(`  projectId: ${projectId}`)
    console.log(`  graphName (from body): ${graphName || '(not provided)'}`)
    console.log(`  apiToken (from body): ${apiToken ? '(set, length: ' + apiToken.length + ')' : '(not provided)'}`)
    console.log(`  repositoryRootPage (from body): ${repositoryRootPage || '(not provided)'}`)

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId required' },
        { status: 400 }
      )
    }

    // BRIDGE ROUTING LOGIC (NEW - Parallel path)
    const userId = extractUserIdFromRequest(req) // TODO: Get from actual auth
    const featureFlagEnabled = getBridgeFeatureFlag()
    const routingDecision = await shouldUseBridge(userId, featureFlagEnabled)
    logRoutingDecision(requestId, routingDecision, 'TEST_CONNECTION')

    console.log(`[TEST_CONNECTION:${requestId}] ===== ROUTING DECISION DETAILS =====`)
    console.log(`[TEST_CONNECTION:${requestId}] useBridge: ${routingDecision.useBridge}`)
    console.log(`[TEST_CONNECTION:${requestId}] bridgeId: ${routingDecision.bridgeId || 'NOT_SET'}`)
    console.log(`[TEST_CONNECTION:${requestId}] bridgeEndpoint: ${routingDecision.bridgeEndpoint || 'NOT_SET'}`)
    console.log(`[TEST_CONNECTION:${requestId}] reason: ${routingDecision.reason}`)
    console.log(`[TEST_CONNECTION:${requestId}] ====================================`)

    // If bridge available: try it first
    if (routingDecision.useBridge) {
      console.log(`[TEST_CONNECTION:${requestId}] ===== BRIDGE ATTEMPT =====`)
      console.log(`[TEST_CONNECTION:${requestId}] Bridge ID: ${routingDecision.bridgeId}`)
      console.log(`[TEST_CONNECTION:${requestId}] Bridge Endpoint: ${routingDecision.bridgeEndpoint}`)
      console.log(`[TEST_CONNECTION:${requestId}] Bridge Token: ${routingDecision.bridgeToken?.substring(0, 20)}...`)
      console.log(`[TEST_CONNECTION:${requestId}] Making HTTP request FROM: ${execEnv.hostname} (${execEnv.platform})`)
      console.log(`[TEST_CONNECTION:${requestId}] Making HTTP request TO: ${routingDecision.bridgeEndpoint}/api/roam/test-connection`)
      console.log(`[TEST_CONNECTION:${requestId}] ========================`)

      try {
        const bridgeConfig = {
          endpoint: routingDecision.bridgeEndpoint!,
          token: routingDecision.bridgeToken!,
          userId,
          requestId,
        }

        console.log(`[TEST_CONNECTION:${requestId}] Calling testBridgeConnection()...`)
        bridgeResponse = await testBridgeConnection(bridgeConfig, graphName, apiToken)
        console.log(`[TEST_CONNECTION:${requestId}] Bridge response received:`)
        console.log(`[TEST_CONNECTION:${requestId}]   success: ${bridgeResponse.success}`)
        console.log(`[TEST_CONNECTION:${requestId}]   error: ${bridgeResponse.error || 'NONE'}`)
        console.log(`[TEST_CONNECTION:${requestId}]   code: ${bridgeResponse.code || 'NONE'}`)
        console.log(`[TEST_CONNECTION:${requestId}]   full object: ${JSON.stringify(bridgeResponse)}`)

        if (bridgeResponse.success) {
          console.log(`[TEST_CONNECTION:${requestId}] Bridge connection test successful`)
          finalResponse = {
            success: true,
            message: 'Connected via bridge',
            graphName: (bridgeResponse.data as any)?.graphName,
            _source: 'BRIDGE',
          }
          console.log(`[TEST_CONNECTION:${requestId}] RETURNING BRIDGE SUCCESS: ${JSON.stringify(finalResponse)}`)
          return NextResponse.json(finalResponse)
        } else {
          console.warn(
            `[TEST_CONNECTION:${requestId}] Bridge connection test failed: ${bridgeResponse.error}`
          )
          console.log(`[TEST_CONNECTION:${requestId}] Falling back to CLI...`)
          // Fall through to CLI fallback
        }
      } catch (bridgeError) {
        console.warn(
          `[TEST_CONNECTION:${requestId}] Bridge request exception, falling back to CLI:`,
          bridgeError instanceof Error ? bridgeError.message : bridgeError
        )
        // Fall through to CLI fallback
      }
    } else {
      console.log(`[TEST_CONNECTION:${requestId}] Bridge NOT available, using CLI directly`)
      console.log(`[TEST_CONNECTION:${requestId}] Reason: ${routingDecision.reason}`)
    }

    // CLI FALLBACK (EXISTING - All original code below is unchanged)
    console.log(`[TEST_CONNECTION:${requestId}] ===== CLI FALLBACK PATH =====`)
    console.log(`[TEST_CONNECTION:${requestId}] Using CLI fallback for test connection`)
    console.log(`[TEST_CONNECTION:${requestId}] Execution Environment: ${execEnv.hostname} (${execEnv.platform})`)
    console.log(`[TEST_CONNECTION:${requestId}] Bridge was attempted: ${routingDecision.useBridge}`)

    let config = {
      graphName: graphName || '',
      apiToken: apiToken || '',
      repositoryRootPage: repositoryRootPage || '',
    }

    // If values not provided in request body, try to load from database
    if (!graphName || !apiToken) {
      console.log(`[TEST_CONNECTION:${requestId}] Form values not fully provided, loading from database`)
      const dbConfig = await prisma.roamConfig.findUnique({
        where: { projectId },
      })

      if (dbConfig) {
        console.log(`[TEST_CONNECTION:${requestId}] Loaded config from database`)
        config = {
          graphName: graphName || dbConfig.graphName,
          apiToken: apiToken || dbConfig.apiToken,
          repositoryRootPage: repositoryRootPage || (dbConfig.repositoryRootPage || ''),
        }
      }
    }

    console.log(`[TEST_CONNECTION:${requestId}] Final config to test:`)
    console.log(`  graphName: ${config.graphName}`)
    console.log(`  apiToken: ${config.apiToken ? '(set)' : '(missing)'}`)
    console.log(`  repositoryRootPage: ${config.repositoryRootPage || '(not set)'}`)

    // Validate required fields
    if (!config.graphName) {
      finalResponse = {
        success: false,
        error: 'Graph Name required',
        details: 'Enter the Roam graph name to test connection',
      }
      console.log(`[TEST_CONNECTION:${requestId}] RETURNING ERROR (no graphName): ${JSON.stringify(finalResponse)}`)
      return NextResponse.json(finalResponse, { status: 400 })
    }

    if (!config.apiToken) {
      finalResponse = {
        success: false,
        error: 'API Token required',
        details: 'Enter your local API token to test connection',
      }
      console.log(`[TEST_CONNECTION:${requestId}] RETURNING ERROR (no apiToken): ${JSON.stringify(finalResponse)}`)
      return NextResponse.json(finalResponse, { status: 400 })
    }

    // Create client with token
    console.log(`[TEST_CONNECTION:${requestId}] ===== ROAM CLI SERVICE =====`)
    console.log(`[TEST_CONNECTION:${requestId}] Creating RoamCliService with graphName: ${config.graphName}`)
    console.log(`[TEST_CONNECTION:${requestId}] Hostname: ${execEnv.hostname}`)
    console.log(`[TEST_CONNECTION:${requestId}] Platform: ${execEnv.platform}`)
    console.log(`[TEST_CONNECTION:${requestId}] Node Env: ${execEnv.nodeEnv}`)
    console.log(`[TEST_CONNECTION:${requestId}] Vercel Env: ${execEnv.vercelEnv || 'NOT_SET'}`)

    let cliService: any
    let decryptedToken: string

    try {
      // Try to decrypt the token (it might be encrypted from database)
      // If decryption fails, assume it's a plain token from the form
      try {
        decryptedToken = decryptApiKey(config.apiToken)
        console.log(`[TEST_CONNECTION:${requestId}] Token was encrypted, decrypted successfully`)
      } catch (decryptError) {
        console.log(`[TEST_CONNECTION:${requestId}] Token is plain text (not encrypted), using as-is`)
        decryptedToken = config.apiToken
      }

      cliService = new RoamCliService(config.graphName, decryptedToken)
      console.log(`[TEST_CONNECTION:${requestId}] RoamCliService created successfully`)
    } catch (error) {
      console.error(`[TEST_CONNECTION:${requestId}] ERROR creating RoamCliService:`, error)
      throw error
    }

    const startTime = Date.now()

    try {
      console.log(`[TEST_CONNECTION:${requestId}] ===== CLI EXECUTION =====`)
      console.log(`[TEST_CONNECTION:${requestId}] Calling cliService.testConnection()`)
      const result = await cliService.testConnection()
      cliResponse = result
      const success = result.success
      console.log(`[TEST_CONNECTION:${requestId}] testConnection() returned:`)
      console.log(`[TEST_CONNECTION:${requestId}]   success: ${success}`)
      console.log(`[TEST_CONNECTION:${requestId}]   message: ${result.message}`)
      console.log(`[TEST_CONNECTION:${requestId}]   details: ${result.details || 'NONE'}`)
      console.log(`[TEST_CONNECTION:${requestId}]   full object: ${JSON.stringify(result)}`)

      const duration = Date.now() - startTime

      if (success) {
        console.log(`[TEST_CONNECTION:${requestId}] Test successful`)
        console.log(`[TEST_CONNECTION:${requestId}] Connection result:`)
        console.log(`  projectId: ${projectId}`)
        console.log(`  graphName: ${config.graphName}`)
        console.log(`  repositoryRootPage: ${config.repositoryRootPage || '(not set)'}`)
        console.log(`  duration: ${duration}ms`)

        // Try to log successful test (only if project exists in DB)
        try {
          await prisma.syncLog.create({
            data: {
              projectId,
              action: 'TEST_CONNECTION',
              status: 'SUCCESS',
              durationMs: duration,
            },
          })
          console.log(`[TEST_CONNECTION:${requestId}] Logged to database`)
        } catch (logError) {
          console.log(`[TEST_CONNECTION:${requestId}] Could not log to database (project may not exist yet), continuing...`)
        }

        finalResponse = {
          success: true,
          message: `Connected to Roam graph "${config.graphName}"`,
          graphName: config.graphName,
          repositoryRootPage: config.repositoryRootPage || null,
          _source: 'CLI',
        }
        console.log(`[TEST_CONNECTION:${requestId}] RETURNING CLI SUCCESS: ${JSON.stringify(finalResponse)}`)
        return NextResponse.json(finalResponse)
      } else {
        console.log(`[TEST_CONNECTION:${requestId}] Test returned false (success=${success})`)
        console.log(`[TEST_CONNECTION:${requestId}] cliResponse object: ${JSON.stringify(cliResponse)}`)
        throw new Error('Connection test failed - received false from CLI')
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : ''

      console.error(`[TEST_CONNECTION:${requestId}] Test failed with error:`)
      console.error(`[TEST_CONNECTION:${requestId}] Message: ${errorMsg}`)
      console.error(`[TEST_CONNECTION:${requestId}] Stack: ${errorStack}`)
      console.error(`[TEST_CONNECTION:${requestId}] projectId: ${projectId}, graphName: ${config.graphName}, duration: ${duration}ms`)
      console.error(`[TEST_CONNECTION:${requestId}] bridgeResponse: ${JSON.stringify(bridgeResponse)}`)
      console.error(`[TEST_CONNECTION:${requestId}] cliResponse: ${JSON.stringify(cliResponse)}`)

      // Try to log failed test (only if project exists in DB)
      try {
        await prisma.syncLog.create({
          data: {
            projectId,
            action: 'TEST_CONNECTION',
            status: 'FAILED',
            error: errorMsg,
            durationMs: duration,
          },
        })
        console.log(`[TEST_CONNECTION:${requestId}] Logged failure to database`)
      } catch (logError) {
        console.log(`[TEST_CONNECTION:${requestId}] Could not log to database (project may not exist yet), continuing...`)
      }

      finalResponse = {
        success: false,
        error: errorMsg,
        details: 'Check server logs for full error details',
      }
      console.error(`[TEST_CONNECTION:${requestId}] RETURNING ERROR RESPONSE: ${JSON.stringify(finalResponse)}`)
      return NextResponse.json(finalResponse, { status: 500 })
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : ''

    console.error(`[TEST_CONNECTION] Outer catch - fatal error:`)
    console.error(`[TEST_CONNECTION] Message: ${errorMsg}`)
    console.error(`[TEST_CONNECTION] Stack: ${errorStack}`)

    finalResponse = {
      success: false,
      error: errorMsg,
      details: 'Check server logs for full error details',
    }
    console.error(`[TEST_CONNECTION] RETURNING FATAL ERROR RESPONSE: ${JSON.stringify(finalResponse)}`)
    return NextResponse.json(finalResponse, { status: 500 })
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
