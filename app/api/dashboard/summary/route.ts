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

    // Get all test cases for this project
    const testCases = await prisma.roamTestCase.findMany({
      where: { projectId },
    })

    // Calculate metrics
    const totalTests = testCases.length
    const passed = testCases.filter((tc) => tc.status === 'PASSED').length
    const failed = testCases.filter((tc) => tc.status === 'FAILED').length
    const blocked = testCases.filter((tc) => tc.status === 'BLOCKED').length
    const inProgress = testCases.filter((tc) => tc.status === 'IN_PROGRESS').length
    const notRun = testCases.filter((tc) => tc.status === 'NOT_RUN').length

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
