import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

const getDatabaseUrl = () => {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  // Basic URL validation
  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection string')
  }

  return url
}

const prismaClientSingleton = () => {
  try {
    // Validate DATABASE_URL before creating client
    let dbUrlString = getDatabaseUrl()
    console.log('[Prisma] Initializing client with DATABASE_URL:', dbUrlString.substring(0, 50) + '...')

    // Set connection timeout to 5 seconds to prevent hanging
    const dbUrl = new URL(dbUrlString)
    if (!dbUrl.searchParams.has('connect_timeout')) {
      dbUrl.searchParams.set('connect_timeout', '5')
    }
    dbUrlString = dbUrl.toString()

    const client = new PrismaClient({
      datasources: {
        db: {
          url: dbUrlString,
        },
      },
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })

    console.log('[Prisma] Client initialized successfully')
    return client
  } catch (error) {
    console.error('[Prisma] Failed to initialize Prisma Client:', error)
    throw error
  }
}

let prismaInstance: PrismaClient | undefined

try {
  prismaInstance = global.prisma ?? prismaClientSingleton()
} catch (error) {
  console.error('[Prisma] Error during initialization:', error)
  // Create a fallback client that will error on use
  prismaInstance = new PrismaClient({
    log: ['error'],
  })
}

export const prisma = prismaInstance

if (process.env.NODE_ENV !== 'production' && typeof global !== 'undefined') {
  global.prisma = prisma
}
