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

    // Step 1-2: Create TestCase records OUTSIDE transaction (avoids network latency in tx)
    let finalTestIds = testIds
    if (roamTestCaseIds.length > 0) {
      const roamTestCases = await prisma.roamTestCase.findMany({
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

      // Bulk create TestCase records outside transaction
      await prisma.testCase.createMany({
        data: roamTestCases.map((rtc) => ({
          projectId,
          title: rtc.title,
          description: `Extracted from: ${rtc.sourceRoamUid}`,
        })),
        skipDuplicates: true,
      })

      // Fetch created TestCase records to get IDs
      const testCases = await prisma.testCase.findMany({
        where: {
          projectId,
          title: { in: roamTestCases.map((rtc) => rtc.title) },
        },
        select: { id: true },
      })

      finalTestIds = testCases.map((tc) => tc.id)
    }

    // Step 3: Create suite and link tests in a single fast transaction
    const suite = await prisma.$transaction(async (tx) => {
      const newSuite = await tx.testSuite.create({
        data: {
          projectId,
          name,
          description,
          category,
          selectionMethod,
          // Bulk insert test cases
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
    }, {
      // Increase timeout for this specific transaction
      timeout: 30000, // 30 seconds (was default 5 seconds)
    })

    return NextResponse.json(suite, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
