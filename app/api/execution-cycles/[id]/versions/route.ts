import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/execution-cycles/[id]/versions
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    const versions = await prisma.executionVersion.findMany({
      where: { cycleId: id },
      orderBy: { versionNumber: 'desc' },
      include: {
        testRuns: {
          include: {
            testCase: true,
            comments: {
              orderBy: { createdAt: 'asc' },
            },
            jiraLinks: true,
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

// POST /api/execution-cycles/[id]/versions
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params

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
        cycleId: id,
        buildVersion: buildVersion.trim(),
      },
    })

    if (existingVersion) {
      return NextResponse.json(
        { error: 'Build version already exists for this cycle.' },
        { status: 409 }
      )
    }

    // Validate: Check for active DRAFT version only
    const draftVersion = await prisma.executionVersion.findFirst({
      where: {
        cycleId: id,
        status: 'DRAFT',
      },
    })

    if (draftVersion) {
      return NextResponse.json(
        { error: 'Complete or delete the current draft before creating a new version.' },
        { status: 409 }
      )
    }

    // Get the next version number
    const lastVersion = await prisma.executionVersion.findFirst({
      where: { cycleId: id },
      orderBy: { versionNumber: 'desc' },
    })

    const nextVersionNumber = (lastVersion?.versionNumber ?? 0) + 1

    // Get all test cases associated with this cycle (from existing test runs)
    const existingTestRuns = await prisma.testRun.findMany({
      where: { cycleId: id },
      distinct: ['testCaseId'],
      select: { testCaseId: true },
    })

    const testCaseIds = existingTestRuns.map((tr) => tr.testCaseId)

    // Create new version
    const version = await prisma.executionVersion.create({
      data: {
        cycleId: id,
        versionNumber: nextVersionNumber,
        buildVersion: buildVersion.trim(),
        releaseNotes,
        status: 'DRAFT',
      },
    })

    // Create test runs for the new version with the same test cases as V1
    if (testCaseIds.length > 0) {
      await prisma.testRun.createMany({
        data: testCaseIds.map((testCaseId) => ({
          cycleId: id,
          versionId: version.id,
          testCaseId,
          status: 'NOT_EXECUTED',
        })),
      })
    }

    // Fetch the version with its test runs
    const versionWithTestRuns = await prisma.executionVersion.findUniqueOrThrow({
      where: { id: version.id },
      include: {
        testRuns: {
          include: {
            testCase: true,
            comments: {
              orderBy: { createdAt: 'asc' },
            },
            jiraLinks: true,
          },
        },
      },
    })

    return NextResponse.json(versionWithTestRuns, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
