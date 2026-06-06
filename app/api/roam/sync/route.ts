import { NextRequest, NextResponse } from 'next/server'
import { syncNow } from '@/lib/roam/sync'

// POST /api/roam/sync (Server-Sent Events)
export async function POST(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  // Create a ReadableStream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (type: string, data: unknown) => {
        const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(new TextEncoder().encode(message))
      }

      try {
        sendEvent('start', { message: 'Sync starting...' })

        const result = await syncNow(projectId)

        sendEvent('progress', {
          message: `Added: ${result.added}, Updated: ${result.updated}, Skipped: ${result.skipped}`,
        })

        if (result.error) {
          sendEvent('error', { message: result.error })
        } else {
          sendEvent('done', {
            added: result.added,
            updated: result.updated,
            skipped: result.skipped,
            message: 'Sync completed successfully',
          })
        }
      } catch (error) {
        sendEvent('error', {
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
