import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

declare global {
  var prisma: PrismaClient | undefined
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is required')
}

// Extract connection info from URL to check if it's pgbouncer or regular
const isPgBouncer = connectionString.includes('pooler.supabase.com')

// For pgbouncer, we don't need to create our own pool - use directUrl
const adapter = new PrismaPg({
  pool: new Pool({
    connectionString,
    max: 5,
    min: 1,
  }),
})

export const prisma =
  global.prisma ||
  new PrismaClient({
    adapter,
  })

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}
