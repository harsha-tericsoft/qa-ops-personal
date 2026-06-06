import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/app/generated/prisma'

const prisma = new PrismaClient()

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

// POST /api/test-suites
export async function POST(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  try {
    const body = await req.json()
    const { name, description, selectionMethod, selectionConfig, testCaseIds } = body

    if (!name || !selectionMethod || !testCaseIds || !Array.isArray(testCaseIds)) {
      return NextResponse.json(
        { error: 'name, selectionMethod, and testCaseIds array required' },
        { status: 400 }
      )
    }

    const suite = await prisma.testSuite.create({
      data: {
        projectId,
        name,
        description,
        selectionMethod,
        selectionConfig,
        testCases: {
          createMany: {
            data: testCaseIds.map((testCaseId: string, order: number) => ({
              testCaseId,
              order,
            })),
          },
        },
      },
      include: {
        testCases: {
          include: { testCase: true },
        },
      },
    })

    return NextResponse.json(suite, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
