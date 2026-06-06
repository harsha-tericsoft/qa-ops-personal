import { NextRequest, NextResponse } from 'next/server'
import { addJiraLink, deleteJiraLink } from '@/lib/services/execution.service'

type RouteParams = { params: Promise<{ id: string }> }

// POST /api/test-runs/[id]/jira-links
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    const body = await req.json()
    const { issueKey, issueUrl, issueType, summary } = body

    if (!issueKey) {
      return NextResponse.json({ error: 'issueKey required' }, { status: 400 })
    }

    const link = await addJiraLink(id, issueKey, issueUrl, issueType, summary)

    return NextResponse.json(link, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/test-runs/[id]/jira-links/[linkId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; linkId?: string }> }
) {
  const { linkId } = await params

  if (!linkId) {
    return NextResponse.json({ error: 'linkId required in path' }, { status: 400 })
  }

  try {
    await deleteJiraLink(linkId)
    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
