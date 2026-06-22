import { NextRequest, NextResponse } from 'next/server'
import {
  getProjectMetrics,
  getCycleMetrics,
  getVersionMetrics,
} from '@/lib/services/dashboard.service'

export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get('scope')
  const projectId = req.nextUrl.searchParams.get('projectId')
  const cycleId = req.nextUrl.searchParams.get('cycleId')
  const versionId = req.nextUrl.searchParams.get('versionId')

  try {
    if (scope === 'project' && projectId) {
      const metrics = await getProjectMetrics(projectId)
      return NextResponse.json(metrics)
    }

    if (scope === 'cycle' && cycleId) {
      const metrics = await getCycleMetrics(cycleId)
      return NextResponse.json(metrics)
    }

    if (scope === 'version' && versionId) {
      const metrics = await getVersionMetrics(versionId)
      return NextResponse.json(metrics)
    }

    return NextResponse.json(
      { error: 'Invalid parameters. Provide scope and required ID.' },
      { status: 400 }
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
