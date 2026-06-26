import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cycleId } = await params
    const minimal = request.nextUrl.searchParams.get('minimal') === 'true'

    console.log(`[execution-cycles/versions] GET ${cycleId}, minimal=${minimal}`)

    // If minimal=true, return only basic info (for dropdown)
    // Otherwise, return full data including testRuns (for detail view)
    if (minimal) {
      const versions = await prisma.executionVersion.findMany({
        where: { cycleId },
        orderBy: { versionNumber: 'desc' },
        select: {
          id: true,
          buildVersion: true,
          versionNumber: true,
          status: true,
        },
      })
      return NextResponse.json(versions)
    }

    // Full data with testRuns for detail view
    const versions = await prisma.executionVersion.findMany({
      where: { cycleId },
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

    console.log(`[execution-cycles/versions] Returning ${versions.length} versions with testRuns`)
    return NextResponse.json(versions)
  } catch (error) {
    console.error('[execution-cycles/versions] Error:', error)
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: errorMsg, code: 'DB_ERROR' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cycleId } = await params
    const { buildVersion, releaseNotes } = await request.json()

    // Validate required fields
    if (!buildVersion || typeof buildVersion !== 'string') {
      return NextResponse.json(
        { error: 'buildVersion is required and must be a string' },
        { status: 400 }
      )
    }

    // Get the cycle to verify it exists
    const cycle = await prisma.executionCycle.findUnique({
      where: { id: cycleId },
    })

    if (!cycle) {
      return NextResponse.json(
        { error: 'Execution cycle not found' },
        { status: 404 }
      )
    }

    // Get the next version number
    const lastVersion = await prisma.executionVersion.findFirst({
      where: { cycleId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    })

    const nextVersionNumber = (lastVersion?.versionNumber || 0) + 1

    // Create new version with DRAFT status
    const newVersion = await prisma.executionVersion.create({
      data: {
        cycleId,
        versionNumber: nextVersionNumber,
        buildVersion: buildVersion.trim(),
        status: 'DRAFT',
        releaseNotes: releaseNotes ? releaseNotes.trim() : null,
      },
    })

    return NextResponse.json(newVersion, { status: 201 })
  } catch (error) {
    console.error('[execution-cycles/versions] POST Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create version' },
      { status: 500 }
    )
  }
}
