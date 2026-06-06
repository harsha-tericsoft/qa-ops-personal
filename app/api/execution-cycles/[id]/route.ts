import { NextRequest, NextResponse } from 'next/server'
import { getCycle, updateCycleStatus, getCycleMetrics } from '@/lib/services/execution.service'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/execution-cycles/[id]
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    const cycle = await getCycle(id)
    const metrics = await getCycleMetrics(id)

    return NextResponse.json({
      ...cycle,
      metrics,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Not found'
    return NextResponse.json({ error: msg }, { status: 404 })
  }
}

// PATCH /api/execution-cycles/[id]
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    const body = await req.json()
    const { status } = body

    if (!status) {
      return NextResponse.json({ error: 'status required' }, { status: 400 })
    }

    const cycle = await updateCycleStatus(id, status)
    const metrics = await getCycleMetrics(id)

    return NextResponse.json({
      ...cycle,
      metrics,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
