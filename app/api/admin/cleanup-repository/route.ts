import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// TEMPORARY: Clean up broken imports
export async function POST(req: NextRequest) {
  try {
    console.log('[cleanup-repository] Deleting all RepositoryNode records...')

    const deleted = await prisma.repositoryNode.deleteMany({})

    console.log('[cleanup-repository] Deleted', deleted.count, 'nodes')

    return NextResponse.json({
      success: true,
      message: 'Cleanup complete',
      deletedCount: deleted.count,
    })
  } catch (error) {
    console.error('[cleanup-repository] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
