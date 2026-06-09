import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Try to query a simple table
    const result = await prisma.project.count()
    return NextResponse.json({
      status: 'success',
      database: 'accessible',
      message: 'Database connection working',
      projectCount: result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('Database test error:', errorMsg)
    return NextResponse.json(
      {
        status: 'error',
        database: 'failed',
        message: errorMsg,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
