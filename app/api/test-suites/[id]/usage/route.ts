import { NextRequest, NextResponse } from 'next/server'
import { getSuiteUsageHistory } from '@/lib/services/suite.service'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/test-suites/[id]/usage
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    const usage = await getSuiteUsageHistory(id)
    return NextResponse.json(usage)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
