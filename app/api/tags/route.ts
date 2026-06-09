import { NextRequest, NextResponse } from 'next/server'
import { getTags, createTag } from '@/lib/db'

// GET /api/tags
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  try {
    const tags = await getTags(projectId)
    return NextResponse.json(tags)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/tags
export async function POST(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  try {
    const body = await req.json()
    const { name, color } = body

    if (!name) {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }

    const tag = await createTag(projectId, name, color)
    return NextResponse.json(tag, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
