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

    // OPTIMIZED: Get versions in 2 queries for better performance
    // Query 1: Get all versions (metadata only - fast)
    const versionsMetadata = await prisma.executionVersion.findMany({
      where: { cycleId },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        cycleId: true,
        versionNumber: true,
        buildVersion: true,
        status: true,
        releaseNotes: true,
        createdAt: true,
        completedAt: true,
      },
    })

    console.log(`[execution-cycles/versions] Fetched ${versionsMetadata.length} versions metadata (fast)`)

    // Query 2: Get testRuns for FIRST version only
    // This allows initial UI display without loading all testRuns for all versions
    let versions: any[] = versionsMetadata

    if (versionsMetadata.length > 0) {
      const firstVersion = versionsMetadata[0]
      console.log(`[execution-cycles/versions] Fetching testRuns for first version ${firstVersion.buildVersion}`)

      const firstVersionWithTestRuns = await prisma.executionVersion.findUnique({
        where: { id: firstVersion.id },
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

      // Merge testRuns into first version, keep others without testRuns
      versions = [
        firstVersionWithTestRuns,
        ...versionsMetadata.slice(1),
      ]
    }

    console.log(`[execution-cycles/versions] Returning ${versions.length} versions (optimized - testRuns for first version only)`)
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

    console.log(`[execution-cycles/versions POST] Cycle found: ${cycle.name}`)

    // Get test cases from the cycle's first version (simpler than sourceSuiteId)
    // This ensures new versions have the same test cases as existing versions
    let testCaseIds: string[] = []

    console.log(`[execution-cycles/versions POST] Fetching test cases from first version of cycle`)

    const firstVersion = await prisma.executionVersion.findFirst({
      where: { cycleId },
      orderBy: { versionNumber: 'asc' },
      select: {
        testRuns: {
          select: { testCaseId: true }
        }
      }
    })

    if (firstVersion?.testRuns && firstVersion.testRuns.length > 0) {
      testCaseIds = firstVersion.testRuns.map(tr => tr.testCaseId)
      console.log(`[execution-cycles/versions POST] Found ${testCaseIds.length} test cases from first version`)
      if (testCaseIds.length > 0) {
        console.log(`[execution-cycles/versions POST] First 3 test case IDs: ${testCaseIds.slice(0, 3).join(', ')}`)
      }
    } else {
      console.warn(`[execution-cycles/versions POST] First version has no testRuns - cannot copy test cases`)
    }

    // Create new version with DRAFT status
    console.log(`[execution-cycles/versions POST] Creating ExecutionVersion: v${nextVersionNumber} - ${buildVersion}`)

    const newVersion = await prisma.executionVersion.create({
      data: {
        cycleId,
        versionNumber: nextVersionNumber,
        buildVersion: buildVersion.trim(),
        status: 'DRAFT',
        releaseNotes: releaseNotes ? releaseNotes.trim() : null,
      },
    })

    console.log(`[execution-cycles/versions POST] ExecutionVersion created: ${newVersion.id}`)

    // Create TestRun records for all test cases with NOT_EXECUTED status
    if (testCaseIds.length > 0) {
      console.log(`[execution-cycles/versions POST] Creating ${testCaseIds.length} testRuns for version ${newVersion.id}`)

      try {
        const testRuns = await prisma.testRun.createMany({
          data: testCaseIds.map(testCaseId => ({
            cycleId,
            versionId: newVersion.id,
            testCaseId,
            status: 'NOT_EXECUTED' as const,
          })),
          skipDuplicates: true,
        })

        console.log(`[execution-cycles/versions POST] Successfully created ${testRuns.count} testRuns`)
      } catch (createError) {
        console.error(`[execution-cycles/versions POST] Error creating testRuns:`, createError)
        throw createError
      }
    } else {
      console.warn(`[execution-cycles/versions POST] No test cases to create testRuns for`)
    }

    // Verify testRuns were created
    const verifyCount = await prisma.testRun.count({
      where: { versionId: newVersion.id }
    })
    console.log(`[execution-cycles/versions POST] Verified: Version ${newVersion.id} has ${verifyCount} testRuns`)

    // Return full version data with testRuns
    const fullVersion = await prisma.executionVersion.findUnique({
      where: { id: newVersion.id },
      include: {
        testRuns: {
          include: {
            testCase: true,
          },
        },
      },
    })

    console.log(`[execution-cycles/versions POST] Returning version with ${fullVersion?.testRuns?.length || 0} testRuns`)

    return NextResponse.json(fullVersion, { status: 201 })
  } catch (error) {
    console.error('[execution-cycles/versions] POST Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create version' },
      { status: 500 }
    )
  }
}
