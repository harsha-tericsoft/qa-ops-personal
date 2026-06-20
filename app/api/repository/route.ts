import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/repository - Get repository hierarchy
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  try {
    const repo = await prisma.repository.findFirst({
      where: { projectId },
      include: {
        nodes: {
          orderBy: { depth: 'asc' },
          select: {
            id: true,
            name: true,
            type: true,
            parentId: true,
            depth: true,
          },
        },
      },
    })

    if (!repo) {
      return NextResponse.json({ nodes: [] })
    }

    return NextResponse.json({
      id: repo.id,
      name: repo.name,
      nodes: repo.nodes,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
