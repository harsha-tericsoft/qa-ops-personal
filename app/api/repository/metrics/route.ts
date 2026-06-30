import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/repository/metrics?projectId={id}
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')

  if (!projectId || typeof projectId !== 'string') {
    return NextResponse.json(
      { error: 'projectId query parameter is required' },
      { status: 400 }
    )
  }

  try {
    // Get all roam test cases to count unique tags
    const allRoamTests = await prisma.roamTestCase.findMany({
      where: { projectId },
      select: { tags: true },
    })

    // Count unique tags
    const uniqueTags = new Set<string>()
    for (const test of allRoamTests) {
      if (test.tags && Array.isArray(test.tags)) {
        test.tags.forEach(tag => uniqueTags.add(tag))
      }
    }

    // Run other counts in parallel for performance
    const [totalTestCases, totalNodes, roamConfig] = await Promise.all([
      prisma.roamTestCase.count({
        where: { projectId },
      }),
      prisma.repositoryNode.count({
        where: { projectId },
      }),
      prisma.roamConfig.findUnique({
        where: { projectId },
        select: {
          id: true,
          lastSyncAt: true,
          lastSyncStatus: true,
          syncEnabled: true,
          graphName: true,
        },
      }),
    ])

    const totalTags = uniqueTags.size

    return NextResponse.json({
      totalTestCases: totalTestCases || 0,
      totalNodes: totalNodes || 0,
      totalTags: totalTags || 0,
      isConfigured: !!roamConfig,
      lastSyncAt: roamConfig?.lastSyncAt || null,
      lastSyncStatus: roamConfig?.lastSyncStatus || 'NEVER',
    })
  } catch (error) {
    console.error('Error fetching repository metrics:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
