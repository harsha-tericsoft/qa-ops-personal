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

    // Use aggregation instead of fetching all records
    const statusCounts = await prisma.roamTestCase.groupBy({
      by: ['status'],
      where: { projectId },
      _count: true,
    })

    // Build metrics from aggregation
    const metrics = {
      PASSED: 0,
      FAILED: 0,
      BLOCKED: 0,
      IN_PROGRESS: 0,
      NOT_RUN: 0,
    }

    let totalTests = 0
    statusCounts.forEach((sc) => {
      if (sc.status in metrics) {
        metrics[sc.status] = sc._count
        totalTests += sc._count
      }
    })

    const { PASSED: passed, FAILED: failed, BLOCKED: blocked, IN_PROGRESS: inProgress, NOT_RUN: notRun } = metrics

    // Calculate percentages
    const executed = passed + failed + blocked + inProgress
    const passRate = executed > 0 ? Math.round((passed / executed) * 100) : 0
    const executionRate = totalTests > 0 ? Math.round((executed / totalTests) * 100) : 0

    return NextResponse.json({
      totalTests,
      passed,
      failed,
      blocked,
      inProgress,
      notRun,
      passRate,
      executionRate,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[dashboard/summary] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
