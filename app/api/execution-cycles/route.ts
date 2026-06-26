import { NextRequest, NextResponse } from 'next/server'
import { createCycle, listCycles } from '@/lib/services/execution.service'

// GET /api/execution-cycles
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  try {
    // Optimized for dashboard: fetch only necessary fields for dropdown
    // Full data if explicitly requested
    const skipTestRuns = req.nextUrl.searchParams.get('skipTestRuns') === 'true'

    if (skipTestRuns) {
      // Lightweight response for dropdown (no testRuns data)
      const { prisma } = await import('@/lib/prisma')
      const cycles = await prisma.executionCycle.findMany({
        where: { projectId },
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json(cycles)
    } else {
      // Full data for detailed views
      const cycles = await listCycles(projectId)
      return NextResponse.json(cycles)
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/execution-cycles
export async function POST(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  try {
    const body = await req.json()
    const { name, description, startDate, endDate, testCaseIds } = body

    if (!name || !testCaseIds || !Array.isArray(testCaseIds)) {
      return NextResponse.json(
        { error: 'name and testCaseIds array required' },
        { status: 400 }
      )
    }

    const cycle = await createCycle({
      projectId,
      name,
      description,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      testCaseIds,
    })

    return NextResponse.json(cycle, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
