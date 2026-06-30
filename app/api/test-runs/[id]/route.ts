import { NextRequest, NextResponse } from 'next/server'

import { updateRunStatus } from '@/lib/services/execution.service'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/test-runs/[id]
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    const run = await prisma.testRun.findUniqueOrThrow({
      where: { id },
      include: {
        testCase: true,
        cycle: true,
        comments: {
          orderBy: { createdAt: 'asc' },
        },
        jiraLinks: true,
        attachments: true,
      },
    })

    return NextResponse.json(run)
  } catch (error) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

// PATCH /api/test-runs/[id]
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    const body = await req.json()
    const { status, durationMs } = body

    if (!status) {
      return NextResponse.json({ error: 'status required' }, { status: 400 })
    }

    const run = await prisma.testRun.update({
      where: { id },
      data: {
        status,
        executedAt: new Date(),
        durationMs,
      },
      include: {
        testCase: true,
        comments: true,
        jiraLinks: true,
        attachments: true,
      },
    })

    return NextResponse.json(run)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
