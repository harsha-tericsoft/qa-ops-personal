import { NextRequest, NextResponse } from 'next/server'
import { requireFeatureFlag } from '@/lib/feature-flags'
import { createSuiteFromFilters } from '@/lib/services/suite.service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, name, description, filters } = body

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      )
    }

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      )
    }

    if (!filters) {
      return NextResponse.json(
        { error: 'filters are required' },
        { status: 400 }
      )
    }

    const suite = await createSuiteFromFilters(projectId, name, description, filters)

    return NextResponse.json(suite, { status: 201 })
  } catch (error) {
    console.error('Error creating suite from filters:', error)
    return NextResponse.json(
      { error: 'Failed to create suite' },
      { status: 500 }
    )
  }
}
