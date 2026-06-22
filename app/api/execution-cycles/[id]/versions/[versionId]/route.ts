import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ExecutionStatus } from '@prisma/client'

type RouteParams = { params: Promise<{ id: string; versionId: string }> }

// GET /api/execution-cycles/[id]/versions/[versionId]
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { versionId } = await params

  try {
    const version = await prisma.executionVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: {
        testRuns: {
          include: {
            testCase: true,
            comments: { orderBy: { createdAt: 'asc' } },
            jiraLinks: true,
          },
        },
      },
    })

    return NextResponse.json(version)
  } catch (error) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 })
  }
}

// PATCH /api/execution-cycles/[id]/versions/[versionId]
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { versionId } = await params

  try {
    const body = await req.json()
    const { status } = body

    if (!status || !['DRAFT', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be DRAFT, IN_PROGRESS, or COMPLETED.' },
        { status: 400 }
      )
    }

    const updateData: {
      status: ExecutionStatus
      completedAt?: Date
    } = {
      status: status as ExecutionStatus,
    }

    // Set completedAt when marking as COMPLETED
    if (status === 'COMPLETED') {
      updateData.completedAt = new Date()
    }

    const version = await prisma.executionVersion.update({
      where: { id: versionId },
      data: updateData,
      include: {
        testRuns: {
          include: {
            testCase: true,
            comments: true,
            jiraLinks: true,
          },
        },
      },
    })

    return NextResponse.json(version)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
