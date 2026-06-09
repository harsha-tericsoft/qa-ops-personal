import { NextRequest, NextResponse } from 'next/server'
import { RoamClient } from '@/lib/roam/client'
import { decryptApiKey } from '@/lib/roam/crypto'
import { prisma } from '@/lib/prisma'

// POST /api/roam/test-connection
export async function POST(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  const body = await req.json()
  const { graphUrl, apiKey } = body

  if (!graphUrl || !apiKey) {
    return NextResponse.json({ error: 'graphUrl and apiKey required' }, { status: 400 })
  }

  // Extract graph name from URL
  const match = graphUrl.match(/\/app\/([a-z0-9-]+)$/i)
  if (!match) {
    return NextResponse.json({ error: 'Invalid graph URL format' }, { status: 400 })
  }

  const graphName = match[1]

  try {
    const client = new RoamClient(graphName, apiKey)
    const success = await client.testConnection()

    if (success) {
      // Also log this test in sync logs
      await prisma.syncLog.create({
        data: {
          projectId,
          action: 'TEST_CONNECTION',
          status: 'SUCCESS',
          durationMs: 0,
        },
      })

      return NextResponse.json({ success: true, message: 'Connected successfully' })
    } else {
      return NextResponse.json(
        { success: false, message: 'Failed to connect to Roam API' },
        { status: 401 }
      )
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'

    await prisma.syncLog.create({
      data: {
        projectId,
        action: 'TEST_CONNECTION',
        status: 'FAILED',
        error: errorMsg,
        durationMs: 0,
      },
    })

    return NextResponse.json(
      { success: false, message: errorMsg },
      { status: 500 }
    )
  }
}
