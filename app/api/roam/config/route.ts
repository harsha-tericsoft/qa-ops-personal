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
        repositoryRootPage: config.repositoryRootPage,
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
// Requires: graphName, apiToken (format: roam-graph-local-token-*), and repositoryRootPage
export async function POST(req: NextRequest) {
  try {
    const { projectId, graphName, apiToken, repositoryRootPage } = await req.json()

    // Validate required fields
    if (!projectId || !graphName || !apiToken || !repositoryRootPage) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          details: 'Project ID, Graph Name, API Token, and Repository Root Page are required',
        },
        { status: 400 }
      )
    }

    // Validate repositoryRootPage is not empty
    if (typeof repositoryRootPage !== 'string' || repositoryRootPage.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid repository root page',
          details: 'Repository Root Page must be a non-empty string (e.g., "Project_Kinergy" or "QA Repository")',
        },
        { status: 400 }
      )
    }

    // Validate token format (should be: roam-graph-local-token-*)
    if (!apiToken.startsWith('roam-graph-local-token-')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid token format',
          details: 'Token must be a local API token in format: roam-graph-local-token-*. Generate one in Roam Desktop Settings.',
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
        repositoryRootPage: repositoryRootPage.trim(),
      },
      update: {
        graphName,
        apiToken: encryptApiKey(apiToken),
        repositoryRootPage: repositoryRootPage.trim(),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Roam configuration saved successfully',
      config: {
        projectId: config.projectId,
        graphName: config.graphName,
        repositoryRootPage: config.repositoryRootPage,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
