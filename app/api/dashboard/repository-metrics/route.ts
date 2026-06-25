import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    try {
      // Count test cases efficiently - use direct count queries
      const totalTests = await prisma.roamTestCase.count({
        where: { projectId },
      })

      // Count automated tests (those with 'Automated' tag)
      const automatedTests = await prisma.roamTestCase.count({
        where: {
          projectId,
          tags: { has: 'Automated' },
        },
      })

      const manualTests = totalTests - automatedTests
      const coverage = totalTests > 0 ? ((automatedTests / totalTests) * 100).toFixed(1) : '0'

      // Count execution cycles by status efficiently
      const [draftCycles, activeCycles, completedCycles] = await Promise.all([
        prisma.executionCycle.count({
          where: { projectId, status: 'PLANNED' },
        }),
        prisma.executionCycle.count({
          where: { projectId, status: 'IN_PROGRESS' },
        }),
        prisma.executionCycle.count({
          where: { projectId, status: 'COMPLETED' },
        }),
      ])

      // Get unique tags
      const tags = await prisma.tag.findMany({
        where: { projectId },
        distinct: ['name'],
        select: { name: true },
      })

      // Get last sync
      const lastSync = await prisma.syncLog.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, status: true },
      })

      return NextResponse.json({
        totalTests,
        manualTests,
        automatedTests,
        coverage: parseFloat(coverage),
        draftCycles,
        activeCycles,
        completedCycles,
        tags: tags.map(t => t.name),
        lastSync: lastSync ? {
          time: lastSync.createdAt,
          status: lastSync.status,
        } : null,
      })
    } catch (dbErr) {
      console.error('[repository-metrics] Database error:', dbErr)
      // Return empty metrics on database error
      return NextResponse.json({
        totalTests: 0,
        manualTests: 0,
        automatedTests: 0,
        coverage: 0,
        draftCycles: 0,
        activeCycles: 0,
        completedCycles: 0,
        tags: [],
        lastSync: null,
      })
    }
  } catch (error) {
    console.error('[repository-metrics] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
