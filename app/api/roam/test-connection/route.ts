import { NextRequest, NextResponse } from 'next/server'
import { RoamClient } from '@/lib/roam/client'
import { prisma } from '@/lib/prisma'

// POST /api/roam/test-connection
// Tests connection to Roam Desktop using local API token
export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  console.log(`[TEST_CONNECTION:${requestId}] Request received`)

  try {
    const { projectId } = await req.json()
    console.log(`[TEST_CONNECTION:${requestId}] projectId:`, projectId)

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId required' },
        { status: 400 }
      )
    }

    // Load config from database
    console.log(`[TEST_CONNECTION:${requestId}] Loading RoamConfig from database`)
    const config = await prisma.roamConfig.findUnique({
      where: { projectId },
    })
    console.log(`[TEST_CONNECTION:${requestId}] Config loaded:`, {
      exists: !!config,
      graphName: config?.graphName,
      hasApiToken: !!config?.apiToken,
    })

    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error: 'No Roam configuration found',
          details: 'Configure Roam settings first',
        },
        { status: 400 }
      )
    }

    if (!config.apiToken) {
      console.log(`[TEST_CONNECTION:${requestId}] ERROR: apiToken is missing`)
      return NextResponse.json(
        {
          success: false,
          error: 'Local API token not configured',
          details: 'Save your local API token in Roam configuration first',
        },
        { status: 400 }
      )
    }

    // Create client with encrypted token
    console.log(`[TEST_CONNECTION:${requestId}] Creating RoamClient with graphName: ${config.graphName}`)
    let client: any
    try {
      client = new RoamClient(config.graphName, config.apiToken)
      console.log(`[TEST_CONNECTION:${requestId}] RoamClient created successfully`)
    } catch (error) {
      console.error(`[TEST_CONNECTION:${requestId}] ERROR creating RoamClient:`, error)
      throw error
    }

    const startTime = Date.now()

    try {
      console.log(`[TEST_CONNECTION:${requestId}] Calling client.testConnection()`)
      const success = await client.testConnection()
      console.log(`[TEST_CONNECTION:${requestId}] testConnection() returned:`, success)

      const duration = Date.now() - startTime

      if (success) {
        console.log(`[TEST_CONNECTION:${requestId}] Test successful, logging to database`)
        // Log successful test
        await prisma.syncLog.create({
          data: {
            projectId,
            action: 'TEST_CONNECTION',
            status: 'SUCCESS',
            durationMs: duration,
          },
        })

        console.log(`[TEST_CONNECTION:${requestId}] Success response sent`)
        return NextResponse.json({
          success: true,
          message: `Connected to Roam graph "${config.graphName}"`,
          graphName: config.graphName,
        })
      } else {
        console.log(`[TEST_CONNECTION:${requestId}] Test returned false`)
        throw new Error('Connection test failed - received false from CLI')
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : ''

      console.error(`[TEST_CONNECTION:${requestId}] Test failed with error:`)
      console.error(`[TEST_CONNECTION:${requestId}] Message: ${errorMsg}`)
      console.error(`[TEST_CONNECTION:${requestId}] Stack: ${errorStack}`)

      // Log failed test
      await prisma.syncLog.create({
        data: {
          projectId,
          action: 'TEST_CONNECTION',
          status: 'FAILED',
          error: errorMsg,
          durationMs: duration,
        },
      })

      return NextResponse.json(
        {
          success: false,
          error: errorMsg,
          details: 'Check server logs for full error details',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : ''

    console.error(`[TEST_CONNECTION] Outer catch - fatal error:`)
    console.error(`[TEST_CONNECTION] Message: ${errorMsg}`)
    console.error(`[TEST_CONNECTION] Stack: ${errorStack}`)

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        details: 'Check server logs for full error details',
      },
      { status: 500 }
    )
  }
}
