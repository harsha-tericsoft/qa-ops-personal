import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/projects
export async function GET(req: NextRequest) {
  try {
    const projects = await prisma.project.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error('Error fetching projects:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/projects
export async function POST(req: NextRequest) {
  try {
    console.log('[POST /api/projects] Request started')

    const body = await req.json()
    console.log('[POST /api/projects] Request body:', JSON.stringify(body, null, 2))

    const { name, description } = body
    console.log('[POST /api/projects] Extracted fields:', { name, description })

    if (!name || typeof name !== 'string' || name.trim() === '') {
      console.log('[POST /api/projects] Validation failed: invalid name')
      return NextResponse.json(
        { error: 'Project name is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    const payload = {
      name: String(name).trim(),
      description: description ? String(description).trim() : null,
    }
    console.log('[POST /api/projects] Prisma payload:', JSON.stringify(payload, null, 2))
    console.log('[POST /api/projects] Payload types:', {
      name: typeof payload.name,
      description: typeof payload.description,
    })

    console.log('[POST /api/projects] Calling prisma.project.create()')
    const project = await prisma.project.create({
      data: payload,
    })
    console.log('[POST /api/projects] Project created successfully:', project.id)

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('[POST /api/projects] ERROR CAUGHT')
    console.error('[POST /api/projects] Error type:', error?.constructor?.name)
    console.error('[POST /api/projects] Error message:', error instanceof Error ? error.message : String(error))
    if (error instanceof Error) {
      console.error('[POST /api/projects] Error stack:', error.stack)
    }
    console.error('[POST /api/projects] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))

    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
