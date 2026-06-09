import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/roam/logs
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20', 10)

  const logs = await prisma.syncLog.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json(logs)
}
