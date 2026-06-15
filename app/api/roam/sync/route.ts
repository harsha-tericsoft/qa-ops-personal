import { NextRequest, NextResponse } from 'next/server'
import { initialSync, refreshSync } from '@/lib/roam/sync'

// POST /api/roam/sync
export async function POST(req: NextRequest) {
  try {
    const { projectId, syncType = 'refresh' } = await req.json()

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId required' },
        { status: 400 }
      )
    }

    if (syncType === 'initial') {
      const result = await initialSync(projectId)
      return NextResponse.json(result)
    } else if (syncType === 'refresh') {
      const result = await refreshSync(projectId)
      return NextResponse.json(result)
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid syncType. Use "initial" or "refresh".' },
        { status: 400 }
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
