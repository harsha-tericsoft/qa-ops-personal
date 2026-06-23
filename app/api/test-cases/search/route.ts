import { NextRequest, NextResponse } from 'next/server'
import { requireFeatureFlag } from '@/lib/feature-flags'
import { findTestCasesByFilters } from '@/lib/services/test-cases.service'

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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || undefined
    const tagsParam = searchParams.get('tags')
    const tags = tagsParam ? tagsParam.split(',').map((t) => t.trim()) : undefined
    const modulesParam = searchParams.get('modules')
    const modules = modulesParam ? modulesParam.split(',').map((m) => m.trim()) : undefined
    const typesParam = searchParams.get('types')
    const types = typesParam ? typesParam.split(',').map((t) => t.trim()) : undefined

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      )
    }

    const result = await findTestCasesByFilters(
      projectId,
      {
        tags,
        modules,
        types,
        search,
      },
      { page, limit }
    )

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('Error searching test cases:', error)
    return NextResponse.json(
      { error: 'Failed to search test cases' },
      { status: 500 }
    )
  }
}
