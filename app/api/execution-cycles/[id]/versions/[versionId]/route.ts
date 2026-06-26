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
  const { id: cycleId, versionId } = await params

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

    // Update version
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

    // Auto-update parent cycle status based on version statuses
    if (status === 'IN_PROGRESS') {
      // When any version is IN_PROGRESS, mark cycle as IN_PROGRESS
      await prisma.executionCycle.update({
        where: { id: cycleId },
        data: { status: 'IN_PROGRESS' },
      })
    } else if (status === 'COMPLETED') {
      // Check if ALL versions are now COMPLETED
      const nonCompletedVersions = await prisma.executionVersion.count({
        where: {
          cycleId,
          status: { not: 'COMPLETED' },
        },
      })

      if (nonCompletedVersions === 0) {
        // All versions completed - mark cycle as COMPLETED
        await prisma.executionCycle.update({
          where: { id: cycleId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        })
      } else {
        // Still have versions in progress - keep cycle IN_PROGRESS
        await prisma.executionCycle.update({
          where: { id: cycleId },
          data: { status: 'IN_PROGRESS' },
        })
      }
    }

    return NextResponse.json(version)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
