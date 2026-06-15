import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/repository/status?projectId=X
export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId required' },
        { status: 400 }
      )
    }

    const repository = await prisma.repository.findFirst({
      where: { projectId },
    })

    if (!repository) {
      return NextResponse.json({
        success: true,
        exists: false,
        message: 'No repository found. Run initial sync first.',
      })
    }

    // Count nodes by type
    const nodes = await prisma.repositoryNode.findMany({
      where: { repositoryId: repository.id, deletedAt: null },
    })

    const nodeCount = nodes.length
    const folderCount = nodes.filter((n) => n.type === 'FOLDER').length
    const fileCount = nodes.filter((n) => n.type === 'FILE').length

    return NextResponse.json({
      success: true,
      exists: true,
      repository: {
        id: repository.id,
        name: repository.name,
        lastSyncAt: repository.lastSyncAt,
        lastSyncStatus: repository.lastSyncStatus,
        lastSyncError: repository.lastSyncError,
        totalTestCount: repository.totalTestCount,
        stats: {
          totalNodes: nodeCount,
          folders: folderCount,
          files: fileCount,
        },
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
