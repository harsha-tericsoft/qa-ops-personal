import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/repository/tree?projectId={id}&parentId={id?}&search={query?}
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  const parentId = req.nextUrl.searchParams.get('parentId') || null
  const search = req.nextUrl.searchParams.get('search') || ''
  const tags = req.nextUrl.searchParams.getAll('tags')

  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  try {
    const query: any = {
      projectId,
    }

    if (parentId) {
      query.parentId = parentId
    } else {
      query.parentId = null // Root nodes only
    }

    let nodes = await prisma.repositoryNode.findMany({
      where: query,
      include: {
        children: {
          select: { id: true }, // Just count
        },
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })

    // Apply search filter
    if (search) {
      nodes = nodes.filter(
        (n) =>
          n.name.toLowerCase().includes(search.toLowerCase()) ||
          n.description?.toLowerCase().includes(search.toLowerCase())
      )
    }

    return NextResponse.json(nodes)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
