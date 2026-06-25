import { NextRequest, NextResponse } from 'next/server'
import { syncTestCases } from '@/lib/sync-test-cases'

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json().catch(() => ({}))

    console.log('[api/admin/sync-test-cases] Starting sync', projectId ? `for project ${projectId}` : 'for all projects')

    const result = await syncTestCases(projectId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[api/admin/sync-test-cases] Error:', msg)
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    )
  }
}
