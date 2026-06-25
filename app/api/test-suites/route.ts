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
    const { name, description, category = 'CUSTOM', selectionMethod = 'HIERARCHY', testIds = [] } = body

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      )
    }

    // Create suite and add test cases in a single transaction
    const suite = await prisma.testSuite.create({
      data: {
        projectId,
        name,
        description,
        category,
        selectionMethod,
        // Bulk insert test cases if provided
        testCases: testIds.length > 0
          ? {
              createMany: {
                data: testIds.map((testId: string, index: number) => ({
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

    return NextResponse.json(suite, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
