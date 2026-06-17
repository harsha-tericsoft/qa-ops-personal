import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const configs = await prisma.roamConfig.findMany({
      select: {
        projectId: true,
        graphName: true,
        repositoryRootPage: true,
        lastSyncAt: true,
        lastSyncStatus: true,
      },
    })

    return NextResponse.json({
      count: configs.length,
      configs,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
