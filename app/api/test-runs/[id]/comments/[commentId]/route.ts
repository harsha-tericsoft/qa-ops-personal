import { NextRequest, NextResponse } from 'next/server'
import { deleteComment } from '@/lib/services/execution.service'

type RouteParams = { params: Promise<{ id: string; commentId: string }> }

// DELETE /api/test-runs/[id]/comments/[commentId]
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { commentId } = await params

  try {
    await deleteComment(commentId)
    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
