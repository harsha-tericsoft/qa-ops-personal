import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1', 10)
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '100', 10)

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      )
    }

    const skip = (page - 1) * limit

    // Combine count + findMany into a single Promise.all to reduce database round trips
    const [total, roamTestCases] = await Promise.all([
      prisma.roamTestCase.count({
        where: { projectId },
      }),
      prisma.roamTestCase.findMany({
        where: { projectId },
        select: {
          id: true,
          title: true,
          sourceRoamUid: true,
          repositoryNodeId: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    return NextResponse.json({
      data: roamTestCases,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[test-cases] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, title, description } = body

    if (!projectId || !title) {
      return NextResponse.json(
        { error: 'projectId and title are required' },
        { status: 400 }
      )
    }

    const testCase = await prisma.testCase.create({
      data: {
        projectId,
        title,
        description,
      },
    })

    return NextResponse.json(testCase, { status: 201 })
  } catch (error) {
    console.error('[test-cases POST] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
