import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requestQueue } from '@/lib/request-queue'

// GET /api/projects
export async function GET(req: NextRequest) {
  try {
    console.log('[GET /api/projects] Request received')
    const projects = await requestQueue.execute(async () => {
      return await prisma.project.findMany({
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
    })

    console.log(`[GET /api/projects] Successfully fetched ${projects.length} projects`)
    return NextResponse.json(projects)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[GET /api/projects] Error:', errorMsg)

    // Check if it's a connection error
    if (errorMsg.includes('Can\'t reach database') || errorMsg.includes('ECONNREFUSED') || errorMsg.includes('connection')) {
      return NextResponse.json({
        error: 'Database connection failed. Please ensure Supabase is accessible and try again.',
        details: 'Unable to connect to the database server. This might be a temporary issue.',
        code: 'DB_CONNECTION_ERROR'
      }, { status: 503 })
    }

    return NextResponse.json({
      error: 'Failed to fetch projects',
      details: errorMsg,
      code: 'UNKNOWN_ERROR'
    }, { status: 500 })
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
