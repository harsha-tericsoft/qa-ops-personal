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

    // OPTIMIZED: Use count queries instead of fetching all data
    const startTime = Date.now()

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
    console.log(`[execution-metrics] Completed in ${elapsed}ms`)

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('[dashboard/execution-metrics] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
