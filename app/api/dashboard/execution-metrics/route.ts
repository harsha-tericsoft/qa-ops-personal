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

    // CHANGED: Run queries SEQUENTIALLY instead of Promise.all()
    // Reason: 5 concurrent queries exhaust the connection pool (only ~10-15 total)
    // Sequential is slower but prevents pool exhaustion
    console.log(`[execution-metrics:${requestId}] Running 5 sequential count queries on testRun table (changed from concurrent)`)

    const queriesStartTime = Date.now()

    console.log(`[execution-metrics:${requestId}] Query 1: total count`)
    const totalTests = await prisma.testRun.count({
      where: { versionId },
    })

    console.log(`[execution-metrics:${requestId}] Query 2: PASS count`)
    const passedTests = await prisma.testRun.count({
      where: { versionId, status: 'PASS' },
    })

    console.log(`[execution-metrics:${requestId}] Query 3: FAIL count`)
    const failedTests = await prisma.testRun.count({
      where: { versionId, status: 'FAIL' },
    })

    console.log(`[execution-metrics:${requestId}] Query 4: BLOCKED count`)
    const blockedTests = await prisma.testRun.count({
      where: { versionId, status: 'BLOCKED' },
    })

    console.log(`[execution-metrics:${requestId}] Query 5: NOT_EXECUTED count`)
    const notExecutedTests = await prisma.testRun.count({
      where: { versionId, status: 'NOT_EXECUTED' },
    })

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
