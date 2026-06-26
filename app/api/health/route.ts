import { NextRequest, NextResponse } from 'next/server'
import { checkDatabaseConnection } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    console.log('[Health Check] Starting database connection test')

    // Test database connection with timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database connection timeout')), 5000)
    )

    const connectionPromise = checkDatabaseConnection()

    const isConnected = await Promise.race([connectionPromise, timeoutPromise]) as boolean

    if (isConnected) {
      console.log('[Health Check] Database connection successful')
      return NextResponse.json({
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString(),
      })
    } else {
      console.log('[Health Check] Database connection failed')
      return NextResponse.json({
        status: 'unhealthy',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      }, { status: 503 })
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[Health Check] Error:', errorMsg)

    return NextResponse.json({
      status: 'unhealthy',
      database: 'error',
      error: errorMsg,
      timestamp: new Date().toISOString(),
    }, { status: 503 })
  }
}
