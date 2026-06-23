import { NextRequest, NextResponse } from 'next/server'
import { requireFeatureFlag } from '@/lib/feature-flags'
import { getTestCaseSummary } from '@/lib/services/test-cases.service'

export async function GET(request: NextRequest) {
  // Feature flag guard
  if (!requireFeatureFlag('enableFilterBasedSuites')) {
    return NextResponse.json(
      { error: 'Feature not enabled' },
      { status: 403 }
    )
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      )
    }

    const summary = await getTestCaseSummary(projectId)

    return NextResponse.json(summary, { status: 200 })
  } catch (error) {
    console.error('Error getting test case summary:', error)
    return NextResponse.json(
      { error: 'Failed to get test case summary' },
      { status: 500 }
    )
  }
}
