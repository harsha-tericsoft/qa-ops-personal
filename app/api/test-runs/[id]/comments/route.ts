import { NextRequest, NextResponse } from 'next/server'
import { addComment } from '@/lib/services/execution.service'

type RouteParams = { params: Promise<{ id: string }> }

// POST /api/test-runs/[id]/comments
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    const body = await req.json()
    const { content, author } = body

    if (!content) {
      return NextResponse.json({ error: 'content required' }, { status: 400 })
    }

    const comment = await addComment(id, content, author)

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
