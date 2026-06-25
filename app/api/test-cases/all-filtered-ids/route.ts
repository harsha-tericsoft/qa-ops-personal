import { NextRequest, NextResponse } from 'next/server'
import { findTestCasesByFilters } from '@/lib/services/test-cases.service'

/**
 * GET /api/test-cases/all-filtered-ids
 * Returns ALL test case IDs matching the current filter criteria
 * Used by "Select All" button to select all filtered tests across all pages
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('projectId')
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

    // Fetch all matching test cases WITHOUT pagination
    const result = await findTestCasesByFilters(
      projectId,
      {
        tags,
        modules,
        types,
        search,
      },
      { page: 1, limit: 10000 } // Get up to 10k test cases (very large limit)
    )

    // Return just the IDs
    const ids = (result.testCases || []).map((tc: any) => tc.id)

    return NextResponse.json(
      { ids, total: result.total },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error fetching all filtered test case IDs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch test case IDs' },
      { status: 500 }
    )
  }
}
