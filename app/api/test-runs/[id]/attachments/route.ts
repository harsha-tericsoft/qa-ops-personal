import { NextRequest, NextResponse } from 'next/server'
import { addAttachment, deleteAttachment } from '@/lib/services/execution.service'

type RouteParams = { params: Promise<{ id: string }> }

// POST /api/test-runs/[id]/attachments
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    const body = await req.json()
    const { name, url, mimeType, sizeBytes } = body

    if (!name || !url) {
      return NextResponse.json({ error: 'name and url required' }, { status: 400 })
    }

    const attachment = await addAttachment(id, name, url, mimeType, sizeBytes)

    return NextResponse.json(attachment, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/test-runs/[id]/attachments/[attachmentId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId?: string }> }
) {
  const { attachmentId } = await params

  if (!attachmentId) {
    return NextResponse.json({ error: 'attachmentId required in path' }, { status: 400 })
  }

  try {
    await deleteAttachment(attachmentId)
    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
