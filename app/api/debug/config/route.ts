import { NextResponse } from 'next/server'

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || 'NOT SET'

  // Mask the password in the URL for security
  const maskedUrl = dbUrl
    .replace(/(:\/\/[^:]+:)[^@]+(@)/, '$1***PASSWORD***$2')

  return NextResponse.json({
    database_url: maskedUrl,
    has_database_url: !!process.env.DATABASE_URL,
    node_env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
}
