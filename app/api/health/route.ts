import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Try a simple database query
    await prisma.project.findFirst({ take: 1 })
    return NextResponse.json({ status: 'healthy', database: 'connected' })
  } catch (err) {
    console.error('[health] Database error:', err)
    return NextResponse.json(
      { 
        status: 'unhealthy', 
        database: 'disconnected',
        error: err instanceof Error ? err.message : 'Unknown error'
      },
      { status: 503 }
    )
  }
}
