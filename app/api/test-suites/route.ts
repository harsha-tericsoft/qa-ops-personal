import { NextRequest, NextResponse } from 'next/server'
import { createTestSuite } from '@/lib/db'
import { prisma } from '@/lib/prisma'

// GET /api/test-suites
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  try {
    const suites = await prisma.testSuite.findMany({
      where: { projectId },
      include: {
        testCases: {
          include: { testCase: true },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(suites)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/test-suites - Create suite with bulk test case assignment
export async function POST(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  try {
    const body = await req.json()
    const {
      name,
      description,
      category = 'CUSTOM',
      selectionMethod = 'HIERARCHY',
      testIds = [],
      roamTestCaseIds = []
    } = body

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      )
    }

    // Handle roamTestCaseIds: bulk create TestCase records and link them in a transaction
    const suite = await prisma.$transaction(async (tx) => {
      // Step 1: Fetch RoamTestCase records
      let finalTestIds = testIds
      if (roamTestCaseIds.length > 0) {
        const roamTestCases = await tx.roamTestCase.findMany({
          where: {
            id: { in: roamTestCaseIds },
            projectId,
          },
          select: {
            id: true,
            title: true,
            sourceRoamUid: true,
          },
        })

        // Step 2: Bulk create TestCase records
        const createdTestCases = await tx.testCase.createMany({
          data: roamTestCases.map((rtc) => ({
            projectId,
            title: rtc.title,
            description: `Extracted from: ${rtc.sourceRoamUid}`,
          })),
          skipDuplicates: true,
        })

        // Step 3: Fetch the created TestCase records to get their IDs
        const testCases = await tx.testCase.findMany({
          where: {
            projectId,
            title: { in: roamTestCases.map((rtc) => rtc.title) },
          },
          select: { id: true },
        })

        finalTestIds = testCases.map((tc) => tc.id)
      }

      // Step 4: Create suite with test cases in a single transaction
      const newSuite = await tx.testSuite.create({
        data: {
          projectId,
          name,
          description,
          category,
          selectionMethod,
          // Bulk insert test cases if provided
          testCases: finalTestIds.length > 0
            ? {
                createMany: {
                  data: finalTestIds.map((testId: string, index: number) => ({
                    testCaseId: testId,
                    order: index,
                  })),
                },
              }
            : undefined,
        },
        include: {
          testCases: {
            include: { testCase: true },
            orderBy: { order: 'asc' },
          },
        },
      })

      return newSuite
    })

    return NextResponse.json(suite, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
