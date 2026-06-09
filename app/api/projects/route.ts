import { NextRequest, NextResponse } from 'next/server'
import { getProjects, createProject } from '@/lib/db'

// GET /api/projects
export async function GET(req: NextRequest) {
  try {
    const projects = await getProjects()
    return NextResponse.json(projects)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/projects
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, description } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      )
    }

    const project = await createProject(name, description)
    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
