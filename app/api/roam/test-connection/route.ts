import { NextRequest, NextResponse } from 'next/server'
import { RoamClient } from '@/lib/roam/client'
import { prisma } from '@/lib/prisma'

// POST /api/roam/test-connection
// Tests connection to Roam Desktop using local API token
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

    if (!config.apiToken) {
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
    const client = new RoamClient(config.graphName, config.apiToken)

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
          message: `Connected to Roam graph "${config.graphName}"`,
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
          details: 'Ensure Roam Desktop is running and the token is valid',
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
