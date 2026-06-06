import { NextRequest, NextResponse } from 'next/server'
import { createCycleFromSuite } from '@/lib/services/suite.service'

type RouteParams = { params: Promise<{ id: string }> }

// POST /api/test-suites/[id]/create-cycle
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    const body = await req.json()
    const { projectId, name, description, startDate, endDate } = body

    if (!projectId || !name) {
      return NextResponse.json(
        { error: 'projectId and name required' },
        { status: 400 }
      )
    }

    const cycle = await createCycleFromSuite(id, {
      projectId,
      name,
      description,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    })

    return NextResponse.json(cycle, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
