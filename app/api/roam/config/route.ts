import { NextRequest, NextResponse } from 'next/server'
import { encryptApiKey, maskApiKey } from '@/lib/roam/crypto'
import { prisma } from '@/lib/prisma'

// GET /api/roam/config
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  const config = await prisma.roamConfig.findUnique({
    where: { projectId },
  })

  if (!config) {
    return NextResponse.json(null)
  }

  return NextResponse.json({
    id: config.id,
    projectId: config.projectId,
    graphName: config.graphName,
    graphUrl: config.graphUrl,
    apiKey: maskApiKey(config.apiKey),
    syncEnabled: config.syncEnabled,
    syncIntervalMin: config.syncIntervalMin,
    syncDirection: config.syncDirection,
    lastSyncAt: config.lastSyncAt,
    lastSyncStatus: config.lastSyncStatus,
  })
}

// PUT /api/roam/config
export async function PUT(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  const body = await req.json()
  const { graphUrl, apiKey, syncEnabled, syncIntervalMin, syncDirection } = body

  if (!graphUrl || !apiKey) {
    return NextResponse.json({ error: 'graphUrl and apiKey required' }, { status: 400 })
  }

  // Extract graph name from URL like "https://roamresearch.com/app/my-graph"
  const match = graphUrl.match(/\/app\/([a-z0-9-]+)$/i)
  if (!match) {
    return NextResponse.json({ error: 'Invalid graph URL format' }, { status: 400 })
  }

  const graphName = match[1]
  const encryptedKey = encryptApiKey(apiKey)

  const config = await prisma.roamConfig.upsert({
    where: { projectId },
    create: {
      projectId,
      graphName,
      graphUrl,
      apiKey: encryptedKey,
      syncEnabled: syncEnabled ?? false,
      syncIntervalMin: syncIntervalMin ?? 15,
      syncDirection: syncDirection ?? 'IMPORT_ONLY',
    },
    update: {
      graphName,
      graphUrl,
      apiKey: encryptedKey,
      syncEnabled: syncEnabled ?? false,
      syncIntervalMin: syncIntervalMin ?? 15,
      syncDirection: syncDirection ?? 'IMPORT_ONLY',
    },
  })

  return NextResponse.json({
    id: config.id,
    projectId: config.projectId,
    graphName: config.graphName,
    graphUrl: config.graphUrl,
    apiKey: maskApiKey(config.apiKey),
    syncEnabled: config.syncEnabled,
    syncIntervalMin: config.syncIntervalMin,
    syncDirection: config.syncDirection,
    lastSyncAt: config.lastSyncAt,
    lastSyncStatus: config.lastSyncStatus,
  })
}
