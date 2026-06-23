import { NextRequest, NextResponse } from 'next/server'
import { requireFeatureFlag } from '@/lib/feature-flags'
import { previewSuiteFromFilters } from '@/lib/services/suite.service'

export async function POST(request: NextRequest) {
  // Feature flag guard
  if (!requireFeatureFlag('enableFilterBasedSuites')) {
    return NextResponse.json(
      { error: 'Feature not enabled' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { projectId, filters } = body

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      )
    }

    if (!filters) {
      return NextResponse.json(
        { error: 'filters are required' },
        { status: 400 }
      )
    }

    const preview = await previewSuiteFromFilters(projectId, filters)

    return NextResponse.json(preview, { status: 200 })
  } catch (error) {
    console.error('Error previewing suite from filters:', error)
    return NextResponse.json(
      { error: 'Failed to preview suite' },
      { status: 500 }
    )
  }
}
