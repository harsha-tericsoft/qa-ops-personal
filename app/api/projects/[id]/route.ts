import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/projects/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      )
    }

    console.log(`[DEBUG] Fetching project with ID: ${id}`)

    try {
      const project = await prisma.project.findUnique({
        where: { id },
        include: {
          roamConfig: {
            select: {
              id: true,
              graphName: true,
              lastSyncAt: true,
              lastSyncStatus: true,
              syncEnabled: true,
            },
          },
        },
      })

      if (!project) {
        console.log(`[DEBUG] Project not found: ${id}`)
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }

      console.log(`[DEBUG] Project found: ${id}`)
      return NextResponse.json(project)
    } catch (dbError) {
      console.error('[DEBUG] Database error:', dbError)
      throw dbError
    }
  } catch (error) {
    console.error('Error fetching project:', error)
    const msg = error instanceof Error ? error.message : JSON.stringify(error)
    return NextResponse.json(
      {
        error: msg,
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    )
  }
}

// PUT /api/projects/[id] - Update project
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { name, description } = body

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'Project name is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
    })

    return NextResponse.json(project)
  } catch (error) {
    if ((error as any).code === 'P2025') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    console.error('Error updating project:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/projects/[id] - Delete project
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { deleteAllData = false } = body

    // Both options use the same delete (cascading is enabled in schema)
    await prisma.project.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as any).code === 'P2025') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    console.error('Error deleting project:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
