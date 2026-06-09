import { NextRequest, NextResponse } from 'next/server'
import { getTestCases, createTestCase } from '@/lib/db'

// GET /api/test-cases
export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId query parameter required' },
        { status: 400 }
      )
    }

    const testCases = await getTestCases(projectId)
    return NextResponse.json(testCases)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/test-cases
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { projectId, title, description } = body

    if (!projectId || !title) {
      return NextResponse.json(
        { error: 'projectId and title are required' },
        { status: 400 }
      )
    }

    const testCase = await createTestCase(projectId, title, description)
    return NextResponse.json(testCase, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
