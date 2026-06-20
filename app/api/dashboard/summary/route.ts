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

    // Aggregate execution cycle test run metrics
    const testRunMetrics = await prisma.testRun.groupBy({
      by: ['status'],
      where: {
        cycle: {
          projectId,
        },
      },
      _count: true,
    })

    // Build execution cycle metrics
    const cycleMetrics = {
      PASS: 0,
      FAIL: 0,
      BLOCKED: 0,
      NOT_EXECUTED: 0,
    }

    let totalExecutionTests = 0
    testRunMetrics.forEach((metric) => {
      if (metric.status in cycleMetrics) {
        cycleMetrics[metric.status] = metric._count
        totalExecutionTests += metric._count
      }
    })

    // Also get roam test case metrics for backward compatibility
    const statusCounts = await prisma.roamTestCase.groupBy({
      by: ['status'],
      where: { projectId },
      _count: true,
    })

    const roamMetrics = {
      PASSED: 0,
      FAILED: 0,
      BLOCKED: 0,
      IN_PROGRESS: 0,
      NOT_RUN: 0,
    }

    let totalTests = 0
    statusCounts.forEach((sc) => {
      if (sc.status in roamMetrics) {
        roamMetrics[sc.status] = sc._count
        totalTests += sc._count
      }
    })

    const { PASSED: passed, FAILED: failed, BLOCKED: blocked, IN_PROGRESS: inProgress, NOT_RUN: notRun } = roamMetrics
    const { PASS: cyclePass, FAIL: cycleFail, BLOCKED: cycleBlocked, NOT_EXECUTED: cycleNotExecuted } = cycleMetrics

    // Calculate percentages for execution cycles
    const executedTests = cyclePass + cycleFail + cycleBlocked
    const cyclePassRate = executedTests > 0 ? Math.round((cyclePass / executedTests) * 100) : 0
    const cycleExecutionRate = totalExecutionTests > 0 ? Math.round((executedTests / totalExecutionTests) * 100) : 0

    // Calculate percentages for roam tests
    const roamExecuted = passed + failed + blocked + inProgress
    const passRate = roamExecuted > 0 ? Math.round((passed / roamExecuted) * 100) : 0
    const executionRate = totalTests > 0 ? Math.round((roamExecuted / totalTests) * 100) : 0

    return NextResponse.json({
      totalTests,
      passed,
      failed,
      blocked,
      inProgress,
      notRun,
      passRate,
      executionRate,
      // Execution cycle metrics
      executionCycles: {
        total: totalExecutionTests,
        pass: cyclePass,
        fail: cycleFail,
        blocked: cycleBlocked,
        notExecuted: cycleNotExecuted,
        passRate: cyclePassRate,
        executionRate: cycleExecutionRate,
      },
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
