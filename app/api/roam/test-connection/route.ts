import { NextRequest, NextResponse } from 'next/server'
import { RoamClient } from '@/lib/roam/client'
import { RoamCliService } from '@/lib/roam/cli-service'
import { decryptApiKey } from '@/lib/roam/crypto'
import { prisma } from '@/lib/prisma'

// POST /api/roam/test-connection
// Tests connection to Roam Desktop using provided or saved configuration
// Accepts either form values or saved config
export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
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
      return NextResponse.json(
        {
          success: false,
          error: 'Graph Name required',
          details: 'Enter the Roam graph name to test connection',
        },
        { status: 400 }
      )
    }

    if (!config.apiToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'API Token required',
          details: 'Enter your local API token to test connection',
        },
        { status: 400 }
      )
    }

    // Create client with token
    console.log(`[TEST_CONNECTION:${requestId}] Creating RoamCliService with graphName: ${config.graphName}`)
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
      console.log(`[TEST_CONNECTION:${requestId}] Calling cliService.testConnection()`)
      const result = await cliService.testConnection()
      const success = result.success
      console.log(`[TEST_CONNECTION:${requestId}] testConnection() returned:`, success)

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

        console.log(`[TEST_CONNECTION:${requestId}] Success response sent`)
        return NextResponse.json({
          success: true,
          message: `Connected to Roam graph "${config.graphName}"`,
          graphName: config.graphName,
          repositoryRootPage: config.repositoryRootPage || null,
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
      console.log(`[TEST_CONNECTION:${requestId}] projectId: ${projectId}, graphName: ${config.graphName}, duration: ${duration}ms`)

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
