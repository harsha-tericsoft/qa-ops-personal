import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/app/generated/prisma'
import { importFromFile } from '@/lib/roam/sync'

const prisma = new PrismaClient()

// POST /api/roam/import
export async function POST(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'file required' }, { status: 400 })
    }

    const text = await file.text()
    const json = JSON.parse(text)

    // Get the primary repository
    const repository = await prisma.repository.findFirst({
      where: { projectId },
    })

    if (!repository) {
      return NextResponse.json({ error: 'No repository found' }, { status: 404 })
    }

    // Import the file
    const result = await importFromFile(json, repository.id, projectId)

    return NextResponse.json({
      added: result.added,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMsg }, { status: 400 })
  }
}
