import { NextRequest, NextResponse } from 'next/server'
import { deleteJiraLink } from '@/lib/services/execution.service'

type RouteParams = { params: Promise<{ id: string; linkId: string }> }

// DELETE /api/test-runs/[id]/jira-links/[linkId]
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { linkId } = await params

  try {
    await deleteJiraLink(linkId)
    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
