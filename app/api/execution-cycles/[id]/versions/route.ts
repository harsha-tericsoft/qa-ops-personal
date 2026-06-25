import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cycleId } = await params

    const versions = await prisma.executionVersion.findMany({
      where: { cycleId },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        buildVersion: true,
        versionNumber: true,
        status: true,
      },
    })

    return NextResponse.json(versions)
  } catch (error) {
    console.error('[execution-cycles/versions] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
