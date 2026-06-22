import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ cycleId: string }> }

// GET /api/execution-cycles/[cycleId]/versions
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { cycleId } = await params

  try {
    const versions = await prisma.executionVersion.findMany({
      where: { cycleId },
      orderBy: { versionNumber: 'desc' },
      include: {
        testRuns: {
          select: {
            id: true,
            status: true,
            testCaseId: true,
          },
        },
      },
    })

    return NextResponse.json(versions)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/execution-cycles/[cycleId]/versions
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { cycleId } = await params

  try {
    const body = await req.json()
    const { buildVersion, releaseNotes } = body

    if (!buildVersion || typeof buildVersion !== 'string') {
      return NextResponse.json(
        { error: 'buildVersion is required and must be a string' },
        { status: 400 }
      )
    }

    // Validate: Check for duplicate build version in same cycle
    const existingVersion = await prisma.executionVersion.findFirst({
      where: {
        cycleId,
        buildVersion: buildVersion.trim(),
      },
    })

    if (existingVersion) {
      return NextResponse.json(
        { error: 'Build version already exists for this cycle.' },
        { status: 409 }
      )
    }

    // Validate: Check for active DRAFT or IN_PROGRESS version
    const activeVersion = await prisma.executionVersion.findFirst({
      where: {
        cycleId,
        status: {
          in: ['DRAFT', 'IN_PROGRESS'],
        },
      },
    })

    if (activeVersion) {
      return NextResponse.json(
        { error: 'Complete or delete the current draft before creating a new version.' },
        { status: 409 }
      )
    }

    // Get the next version number
    const lastVersion = await prisma.executionVersion.findFirst({
      where: { cycleId },
      orderBy: { versionNumber: 'desc' },
    })

    const nextVersionNumber = (lastVersion?.versionNumber ?? 0) + 1

    // Create new version
    const version = await prisma.executionVersion.create({
      data: {
        cycleId,
        versionNumber: nextVersionNumber,
        buildVersion: buildVersion.trim(),
        releaseNotes,
        status: 'DRAFT',
      },
    })

    return NextResponse.json(version, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
