import { NextRequest, NextResponse } from 'next/server'
import { RoamClient } from '@/lib/roam/client'
import { decryptApiKey } from '@/lib/roam/crypto'
import { prisma } from '@/lib/prisma'
import { testConnection } from '@/lib/roam/sync'

// POST /api/roam/test-connection
export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json()

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId required' },
        { status: 400 }
      )
    }

    // Load config from database
    const config = await prisma.roamConfig.findUnique({
      where: { projectId },
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

    // Decrypt token
    const decryptedToken = decryptApiKey(config.apiToken || '')

    // Create client with per-project endpoint
    const client = new RoamClient(config.graphName, decryptedToken, config.apiEndpoint)

    const startTime = Date.now()

    try {
      const success = await client.testConnection()

      const duration = Date.now() - startTime

      if (success) {
        // Log successful test
        await prisma.syncLog.create({
          data: {
            projectId,
            action: 'TEST_CONNECTION',
            status: 'SUCCESS',
            durationMs: duration,
          },
        })

        return NextResponse.json({
          success: true,
          message: `Connected to Roam at ${config.apiEndpoint}`,
          endpoint: config.apiEndpoint,
          graphName: config.graphName,
        })
      } else {
        throw new Error('Connection test failed')
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'

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
          endpoint: config.apiEndpoint,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    )
  }
}
