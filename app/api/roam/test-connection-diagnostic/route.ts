/**
 * Public diagnostic endpoint - NO AUTH REQUIRED
 * Only for testing the deployed backend bridge connection
 */
import { NextRequest, NextResponse } from 'next/server'
import { RoamCliService } from '@/lib/roam/cli-service'
import { decryptApiKey } from '@/lib/roam/crypto'
import { prisma } from '@/lib/prisma'
import { shouldUseBridge, getBridgeFeatureFlag, logRoutingDecision } from '@/lib/bridge/routing'
import { testBridgeConnection } from '@/lib/bridge/bridge-client'

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  const execEnv = {
    platform: process.platform,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    vercelUrl: process.env.VERCEL_URL,
    hostname: require('os').hostname(),
  }

  console.log(`[DIAGNOSTIC:${requestId}] ===== EXECUTION ENVIRONMENT DIAGNOSTIC =====`)
  console.log(`[DIAGNOSTIC:${requestId}] Execution Platform: ${execEnv.platform}`)
  console.log(`[DIAGNOSTIC:${requestId}] Node Environment: ${execEnv.nodeEnv}`)
  console.log(`[DIAGNOSTIC:${requestId}] Vercel Environment: ${execEnv.vercelEnv || 'NOT_SET'}`)
  console.log(`[DIAGNOSTIC:${requestId}] Vercel URL: ${execEnv.vercelUrl || 'NOT_SET'}`)
  console.log(`[DIAGNOSTIC:${requestId}] Hostname: ${execEnv.hostname}`)
  console.log(`[DIAGNOSTIC:${requestId}] ==========================================`)

  try {
    const requestBody = await req.json()
    const { graphName, apiToken } = requestBody

    console.log(`[DIAGNOSTIC:${requestId}] Request parameters:`)
    console.log(`  graphName: ${graphName}`)
    console.log(`  apiToken: ${apiToken ? '(set, length: ' + apiToken.length + ')' : '(not provided)'}`)

    if (!graphName || !apiToken) {
      return NextResponse.json(
        { success: false, error: 'graphName and apiToken required' },
        { status: 400 }
      )
    }

    // BRIDGE ROUTING LOGIC
    const userId = 'diagnostic_test_user'
    const featureFlagEnabled = getBridgeFeatureFlag()
    const routingDecision = await shouldUseBridge(userId, featureFlagEnabled)
    logRoutingDecision(requestId, routingDecision, 'DIAGNOSTIC_TEST')

    // If bridge available: try it first
    if (routingDecision.useBridge) {
      console.log(`[DIAGNOSTIC:${requestId}] ===== BRIDGE ATTEMPT =====`)
      console.log(`[DIAGNOSTIC:${requestId}] Bridge ID: ${routingDecision.bridgeId}`)
      console.log(`[DIAGNOSTIC:${requestId}] Bridge Endpoint: ${routingDecision.bridgeEndpoint}`)
      console.log(`[DIAGNOSTIC:${requestId}] Making request FROM: ${execEnv.hostname} (${execEnv.platform}) TO: ${routingDecision.bridgeEndpoint}/api/roam/test-connection`)

      try {
        const bridgeConfig = {
          endpoint: routingDecision.bridgeEndpoint!,
          token: routingDecision.bridgeToken!,
          userId,
          requestId,
        }

        console.log(`[DIAGNOSTIC:${requestId}] Calling testBridgeConnection()...`)
        const bridgeResponse = await testBridgeConnection(bridgeConfig, graphName, apiToken)
        console.log(`[DIAGNOSTIC:${requestId}] Bridge response: success=${bridgeResponse.success}, error=${bridgeResponse.error}`)

        if (bridgeResponse.success) {
          return NextResponse.json({
            success: true,
            message: 'Connected via bridge',
            graphName,
            _source: 'BRIDGE',
          })
        } else {
          console.warn(`[DIAGNOSTIC:${requestId}] Bridge failed: ${bridgeResponse.error}`)
          console.log(`[DIAGNOSTIC:${requestId}] Falling back to CLI...`)
        }
      } catch (bridgeError) {
        console.error(`[DIAGNOSTIC:${requestId}] Bridge exception:`, bridgeError instanceof Error ? bridgeError.message : bridgeError)
      }
    } else {
      console.log(`[DIAGNOSTIC:${requestId}] Bridge NOT available: ${routingDecision.reason}`)
    }

    // CLI FALLBACK
    console.log(`[DIAGNOSTIC:${requestId}] ===== CLI FALLBACK PATH =====`)

    let decryptedToken: string
    try {
      decryptedToken = decryptApiKey(apiToken)
      console.log(`[DIAGNOSTIC:${requestId}] Token was encrypted, decrypted successfully`)
    } catch {
      console.log(`[DIAGNOSTIC:${requestId}] Token is plain text (not encrypted), using as-is`)
      decryptedToken = apiToken
    }

    const cliService = new RoamCliService(graphName, decryptedToken)
    console.log(`[DIAGNOSTIC:${requestId}] RoamCliService created`)

    const startTime = Date.now()
    try {
      console.log(`[DIAGNOSTIC:${requestId}] Calling cliService.testConnection()...`)
      const result = await cliService.testConnection()
      const duration = Date.now() - startTime

      console.log(`[DIAGNOSTIC:${requestId}] CLI result: success=${result.success}, message=${result.message}`)

      if (result.success) {
        console.log(`[DIAGNOSTIC:${requestId}] TEST SUCCESSFUL (duration: ${duration}ms)`)
        return NextResponse.json({
          success: true,
          message: result.message,
          graphName,
          _source: 'CLI',
        })
      } else {
        console.error(`[DIAGNOSTIC:${requestId}] CLI returned success=false`)
        throw new Error('Connection test failed - received false from CLI')
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error(`[DIAGNOSTIC:${requestId}] CLI ERROR (duration: ${duration}ms):`)
      console.error(`[DIAGNOSTIC:${requestId}] Message: ${errorMsg}`)
      if (error instanceof Error) {
        console.error(`[DIAGNOSTIC:${requestId}] Stack: ${error.stack}`)
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMsg,
          _source: 'CLI',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[DIAGNOSTIC:${requestId}] FATAL ERROR: ${errorMsg}`)
    if (error instanceof Error) {
      console.error(`[DIAGNOSTIC:${requestId}] Stack: ${error.stack}`)
    }

    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    )
  }
}
