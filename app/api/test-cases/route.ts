import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      )
    }

    const testCases = await prisma.roamTestCase.findMany({
      where: { projectId },
      select: {
        id: true,
        title: true,
        status: true,
        sourceRoamUid: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(testCases)
  } catch (error) {
    console.error('[test-cases] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
