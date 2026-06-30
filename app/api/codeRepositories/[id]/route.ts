import { NextRequest, NextResponse } from 'next/server'
import { codeRepositoryService } from '@/src/services/codeRepositories'

// GET /api/codeRepositories/:id
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const repository = await codeRepositoryService.getRepository(id)
    if (!repository) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 })
    }

    return NextResponse.json(repository)
  } catch (error) {
    console.error('[GET /api/codeRepositories/:id] Error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PATCH /api/codeRepositories/:id
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const {
      branch,
      description,
      repositoryPurpose,
      tags,
      isActive,
    } = body

    const updateData: any = {}
    if (branch !== undefined) updateData.branch = branch
    if (description !== undefined) updateData.description = description
    if (repositoryPurpose !== undefined) updateData.repositoryPurpose = repositoryPurpose
    if (tags !== undefined) updateData.tags = tags
    if (isActive !== undefined) updateData.isActive = isActive

    const repository = await codeRepositoryService.updateRepository(id, updateData)

    return NextResponse.json(repository)
  } catch (error) {
    console.error('[PATCH /api/codeRepositories/:id] Error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/codeRepositories/:id
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const repository = await codeRepositoryService.deleteRepository(id)

    return NextResponse.json({
      message: 'Repository deleted',
      repository,
    })
  } catch (error) {
    console.error('[DELETE /api/codeRepositories/:id] Error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
