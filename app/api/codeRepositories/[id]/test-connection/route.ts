import { NextRequest, NextResponse } from 'next/server'
import { connectionService, codeRepositoryService } from '@/src/services/codeRepositories'

// POST /api/codeRepositories/:id/test-connection
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { testTypes = ['basic_connectivity', 'github_api', 'branch_verification'], testedBy } = body

    // Verify repository exists
    const repository = await codeRepositoryService.getRepository(id)
    if (!repository) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 })
    }

    // Run tests
    const results = await connectionService.testConnection({
      codeRepositoryId: id,
      testTypes,
      testedBy,
    })

    // Update connection status based on results
    const lastResult = results[results.length - 1]
    if (lastResult.testStatus === 'failed') {
      await codeRepositoryService.updateConnectionStatus(
        id,
        'error',
        lastResult.testError || 'Connection test failed'
      )
    } else {
      const allPassed = results.every(r => r.testStatus === 'success')
      if (allPassed) {
        await codeRepositoryService.updateConnectionStatus(id, 'connected')
      }
    }

    return NextResponse.json({
      testId: `test-${Date.now()}`,
      repositoryId: id,
      results,
      status: results.every(r => r.testStatus === 'success') ? 'success' : 'partial_failure',
    })
  } catch (error) {
    console.error('[POST /api/codeRepositories/:id/test-connection] Error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// GET /api/codeRepositories/:id/test-connection (get history)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    const history = await connectionService.getTestHistory(id, limit)

    return NextResponse.json({
      repositoryId: id,
      tests: history,
      count: history.length,
    })
  } catch (error) {
    console.error('[GET /api/codeRepositories/:id/test-connection] Error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
