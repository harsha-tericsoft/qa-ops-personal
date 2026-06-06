import { NextRequest, NextResponse } from 'next/server'
import { getSuite, updateSuite, deleteSuite } from '@/lib/services/suite.service'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/test-suites/[id]
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    const suite = await getSuite(id)
    return NextResponse.json(suite)
  } catch (error) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

// PATCH /api/test-suites/[id]
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    const body = await req.json()
    const { name, description, category, testCaseIds } = body

    const suite = await updateSuite(id, {
      name,
      description,
      category,
      testCaseIds,
    })

    return NextResponse.json(suite)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/test-suites/[id]
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    await deleteSuite(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
