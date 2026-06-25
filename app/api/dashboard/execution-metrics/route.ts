import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    const cycleId = request.nextUrl.searchParams.get('cycleId')
    const versionId = request.nextUrl.searchParams.get('versionId')

    if (!projectId || !cycleId || !versionId) {
      return NextResponse.json(
        { error: 'projectId, cycleId, and versionId are required' },
        { status: 400 }
      )
    }

    // Get test run metrics for this version
    const testRuns = await prisma.testRun.findMany({
      where: {
        versionId,
      },
      select: {
        status: true,
      },
    })

    const metrics = {
      totalTests: testRuns.length,
      passedTests: testRuns.filter(t => t.status === 'PASS').length,
      failedTests: testRuns.filter(t => t.status === 'FAIL').length,
      blockedTests: testRuns.filter(t => t.status === 'BLOCKED').length,
      skippedTests: 0,
      notExecutedTests: testRuns.filter(t => t.status === 'NOT_EXECUTED').length,
      executionRate: testRuns.length > 0 
        ? ((testRuns.filter(t => t.status !== 'NOT_EXECUTED').length / testRuns.length) * 100)
        : 0,
      passRate: testRuns.filter(t => t.status === 'PASS' || t.status === 'FAIL').length > 0
        ? ((testRuns.filter(t => t.status === 'PASS').length / 
            testRuns.filter(t => t.status === 'PASS' || t.status === 'FAIL').length) * 100)
        : 0,
    }

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('[dashboard/execution-metrics] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
