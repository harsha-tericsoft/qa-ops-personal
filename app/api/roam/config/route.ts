import { NextRequest, NextResponse } from 'next/server'
import { encryptApiKey } from '@/lib/roam/crypto'
import { prisma } from '@/lib/prisma'

// GET /api/roam/config?projectId=X
export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    const config = await prisma.roamConfig.findUnique({
      where: { projectId },
    })

    if (!config) {
      return NextResponse.json({
        success: false,
        configured: false,
      })
    }

    return NextResponse.json({
      success: true,
      configured: true,
      config: {
        projectId: config.projectId,
        graphName: config.graphName,
        apiEndpoint: config.apiEndpoint,
        lastSyncAt: config.lastSyncAt,
        lastSyncStatus: config.lastSyncStatus,
        lastSyncError: config.lastSyncError,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

// POST /api/roam/config - Save Roam Local API configuration
export async function POST(req: NextRequest) {
  try {
    const { projectId, graphName, apiToken, apiEndpoint = 'http://localhost:8000' } = await req.json()

    // Validate required fields
    if (!projectId || !graphName || !apiToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          details: 'Project ID, Graph Name, and API Token are required',
        },
        { status: 400 }
      )
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project not found',
        },
        { status: 404 }
      )
    }

    // Save configuration (encrypt token)
    const config = await prisma.roamConfig.upsert({
      where: { projectId },
      create: {
        projectId,
        graphName,
        apiToken: encryptApiKey(apiToken),
        apiEndpoint: apiEndpoint || 'http://localhost:8000',
      },
      update: {
        graphName,
        apiToken: encryptApiKey(apiToken),
        apiEndpoint: apiEndpoint || 'http://localhost:8000',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Roam configuration saved successfully',
      config: {
        projectId: config.projectId,
        graphName: config.graphName,
        apiEndpoint: apiEndpoint,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
