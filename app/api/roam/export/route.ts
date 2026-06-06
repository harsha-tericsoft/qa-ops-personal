import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/app/generated/prisma'
import { exportToRoamJSON } from '@/lib/roam/exporter'

const prisma = new PrismaClient()

// GET /api/roam/export
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  try {
    // Get the primary repository
    const repository = await prisma.repository.findFirst({
      where: { projectId },
    })

    if (!repository) {
      return NextResponse.json({ error: 'No repository found' }, { status: 404 })
    }

    // Export as JSON
    const pages = await exportToRoamJSON(repository.id)

    // Log this export
    await prisma.syncLog.create({
      data: {
        projectId,
        action: 'EXPORT_FILE',
        status: 'SUCCESS',
      },
    })

    // Return as downloadable JSON file
    return new NextResponse(JSON.stringify(pages, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="roam-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
