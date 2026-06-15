import { NextRequest, NextResponse } from 'next/server'
import { credentialService, codeRepositoryService } from '@/src/services/codeRepositories'

// POST /api/codeRepositories/:id/credentials
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { githubToken } = body

    if (!githubToken) {
      return NextResponse.json({ error: 'GitHub token is required' }, { status: 400 })
    }

    // Verify repository exists
    const repository = await codeRepositoryService.getRepository(id)
    if (!repository) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 })
    }

    // Encrypt and store the token
    const encryptedToken = credentialService.encryptToken(githubToken)

    const credential = await credentialService.createCredential({
      codeRepositoryId: id,
      credentialType: 'github_pat',
      encryptedValue: encryptedToken,
    })

    return NextResponse.json({
      message: 'Credential stored successfully',
      credential: {
        id: credential.id,
        codeRepositoryId: credential.codeRepositoryId,
        credentialType: credential.credentialType,
        isActive: credential.isActive,
        createdAt: credential.createdAt,
      },
    })
  } catch (error) {
    console.error('[POST /api/codeRepositories/:id/credentials] Error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// GET /api/codeRepositories/:id/credentials
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const credentials = await credentialService.listCredentials(id)

    // Don't expose encrypted values
    const safeCredentials = credentials.map(c => ({
      id: c.id,
      credentialType: c.credentialType,
      isActive: c.isActive,
      lastUsedAt: c.lastUsedAt,
      expiresAt: c.expiresAt,
      createdAt: c.createdAt,
    }))

    return NextResponse.json({
      repositoryId: id,
      credentials: safeCredentials,
      count: safeCredentials.length,
    })
  } catch (error) {
    console.error('[GET /api/codeRepositories/:id/credentials] Error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
