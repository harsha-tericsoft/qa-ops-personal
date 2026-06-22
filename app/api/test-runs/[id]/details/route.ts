import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params

    const testRun = await prisma.testRun.findUnique({
      where: { id },
      include: {
        testCase: true,
        comments: {
          orderBy: { createdAt: 'asc' },
        },
        jiraLinks: true,
      },
    })

    if (!testRun) {
      return NextResponse.json(
        { error: 'Test run not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(testRun)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
