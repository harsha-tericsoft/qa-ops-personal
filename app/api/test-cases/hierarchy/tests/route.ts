import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface TestCase {
  id: string
  title: string
  status: string
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const nodeId = request.nextUrl.searchParams.get('nodeId')

    if (!nodeId) {
      return NextResponse.json(
        { error: 'nodeId is required' },
        { status: 400 }
      )
    }

    // Get test cases directly under this node
    const queryStart = Date.now()
    const testCases = await prisma.roamTestCase.findMany({
      where: {
        repositoryNodeId: nodeId,
      },
      select: {
        id: true,
        title: true,
        status: true,
      },
      orderBy: { title: 'asc' },
    })

    const queryMs = Date.now() - queryStart
    const totalMs = Date.now() - startTime

    console.log(`[hierarchy/tests] Fetched ${testCases.length} tests in ${queryMs}ms (total ${totalMs}ms)`)

    return NextResponse.json({
      count: testCases.length,
      tests: testCases,
    })
  } catch (error) {
    console.error('[hierarchy/tests] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
