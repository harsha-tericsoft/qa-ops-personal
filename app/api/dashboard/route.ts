import { NextRequest, NextResponse } from 'next/server'
import { getProjectDashboardMetrics } from '@/lib/services/dashboard.service'

// GET /api/dashboard?projectId=...
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')

  if (!projectId) {
    return NextResponse.json(
      { error: 'projectId query parameter required' },
      { status: 400 }
    )
  }

  try {
    const metrics = await getProjectDashboardMetrics(projectId)
    return NextResponse.json(metrics, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
