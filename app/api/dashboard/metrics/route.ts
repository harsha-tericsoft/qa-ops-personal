import { NextRequest, NextResponse } from 'next/server'
import {
  getProjectMetrics,
  getCycleMetrics,
  getCycleMetricsForVersion,
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
      // If versionId is provided, return metrics for that specific version within the cycle
      if (versionId) {
        const metrics = await getCycleMetricsForVersion(cycleId, versionId)
        return NextResponse.json(metrics)
      }
      // Otherwise return aggregate cycle metrics across all versions
      const metrics = await getCycleMetrics(cycleId)
      return NextResponse.json(metrics)
    }

    if (scope === 'version' && versionId) {
      const metrics = await getVersionMetrics(versionId)
      if (!metrics) {
        return NextResponse.json(
          { error: 'Version not found' },
          { status: 404 }
        )
      }
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
