import { NextRequest, NextResponse } from 'next/server'
import { prisma, incrementActiveRequests, decrementActiveRequests, getPoolStatus } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substr(2, 9)
  const startTime = Date.now()

  try {
    incrementActiveRequests()
    const poolStatus = getPoolStatus()
    console.log(`[execution-metrics:${requestId}] START - ${poolStatus.activeRequests} active requests - Running 5 concurrent count queries`)

    const projectId = request.nextUrl.searchParams.get('projectId')
    const cycleId = request.nextUrl.searchParams.get('cycleId')
    const versionId = request.nextUrl.searchParams.get('versionId')

    if (!projectId || !cycleId || !versionId) {
      decrementActiveRequests()
      return NextResponse.json(
        { error: 'projectId, cycleId, and versionId are required' },
        { status: 400 }
      )
    }

    // OPTIMIZED: Use count queries instead of fetching all data
    console.log(`[execution-metrics:${requestId}] About to run 5 concurrent count queries on testRun table`)

    const queriesStartTime = Date.now()
    const [totalTests, passedTests, failedTests, blockedTests, notExecutedTests] = await Promise.all([
      prisma.testRun.count({
        where: { versionId },
      }),
      prisma.testRun.count({
        where: { versionId, status: 'PASS' },
      }),
      prisma.testRun.count({
        where: { versionId, status: 'FAIL' },
      }),
      prisma.testRun.count({
        where: { versionId, status: 'BLOCKED' },
      }),
      prisma.testRun.count({
        where: { versionId, status: 'NOT_EXECUTED' },
      }),
    ])

    const queriesElapsed = Date.now() - queriesStartTime
    console.log(`[execution-metrics:${requestId}] 5 count queries completed in ${queriesElapsed}ms`)

    const executedTests = totalTests - notExecutedTests
    const executionRate = totalTests > 0 ? (executedTests / totalTests) * 100 : 0
    const passRate = (passedTests + failedTests) > 0
      ? (passedTests / (passedTests + failedTests)) * 100
      : 0

    const metrics = {
      totalTests,
      passedTests,
      failedTests,
      blockedTests,
      notExecutedTests,
      executionRate: parseFloat(executionRate.toFixed(1)),
      passRate: parseFloat(passRate.toFixed(1)),
    }

    const elapsed = Date.now() - startTime
    console.log(`[execution-metrics:${requestId}] FINISH (${elapsed}ms total)`)
    decrementActiveRequests()
    const poolStatusEnd = getPoolStatus()
    console.log(`[execution-metrics:${requestId}] Pool status: ${poolStatusEnd.activeRequests} active requests remain`)

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('[dashboard/execution-metrics] Error:', error)
    const elapsed = Date.now() - startTime
    console.log(`[execution-metrics:${requestId}] ERROR after ${elapsed}ms`)
    decrementActiveRequests()
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
