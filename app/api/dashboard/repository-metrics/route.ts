import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    // Count test cases
    const testCases = await prisma.roamTestCase.findMany({
      where: { projectId },
      select: { id: true, tags: true },
    })

    const totalTests = testCases.length
    // Estimate: tests with 'Automated' tag are automated, otherwise manual
    const automatedTests = testCases.filter(t => t.tags?.includes('Automated')).length
    const manualTests = totalTests - automatedTests
    const coverage = totalTests > 0 ? ((automatedTests / totalTests) * 100).toFixed(1) : '0'

    // Count execution cycles by status
    const cycles = await prisma.executionCycle.findMany({
      where: { projectId },
      select: { status: true },
    })

    const draftCycles = cycles.filter(c => c.status === 'PLANNED').length
    const activeCycles = cycles.filter(c => c.status === 'IN_PROGRESS').length
    const completedCycles = cycles.filter(c => c.status === 'COMPLETED').length

    // Count unique tags
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
  } catch (error) {
    console.error('[repository-metrics]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
