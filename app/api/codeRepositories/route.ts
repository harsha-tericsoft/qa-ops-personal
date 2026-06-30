import { NextRequest, NextResponse } from 'next/server'
import { codeRepositoryService } from '@/src/services/codeRepositories'

// GET /api/codeRepositories?projectId=...&status=...&type=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')
    const type = searchParams.get('type')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const repositories = await codeRepositoryService.listRepositories(projectId, {
      status: status || undefined,
      type: type || undefined,
    })

    return NextResponse.json({
      repositories,
      count: repositories.length,
    })
  } catch (error) {
    console.error('[GET /api/codeRepositories] Error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/codeRepositories
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      projectId,
      repositoryName,
      repositoryUrl,
      repositoryType,
      repositoryPurpose,
      branch,
      description,
      tags,
      createdBy,
    } = body

    // Validate required fields
    if (!projectId || !repositoryName || !repositoryUrl || !repositoryType) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, repositoryName, repositoryUrl, repositoryType' },
        { status: 400 }
      )
    }

    // Validate repository URL format
    if (!repositoryUrl.includes('github.com')) {
      return NextResponse.json(
        { error: 'Only GitHub repositories are supported' },
        { status: 400 }
      )
    }

    // Check for duplicate URL
    const isDuplicate = await codeRepositoryService.checkDuplicateUrl(projectId, repositoryUrl)
    if (isDuplicate) {
      return NextResponse.json(
        { error: 'Repository with this URL already exists in this project' },
        { status: 409 }
      )
    }

    const repository = await codeRepositoryService.createRepository({
      projectId,
      repositoryName,
      repositoryUrl,
      repositoryType,
      repositoryPurpose,
      branch: branch || 'main',
      description,
      tags: tags || [],
      createdBy,
    })

    return NextResponse.json(repository, { status: 201 })
  } catch (error) {
    console.error('[POST /api/codeRepositories] Error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
