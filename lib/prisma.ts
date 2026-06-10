import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

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
    const dbUrl = getDatabaseUrl()
    console.log('[Prisma] Initializing client with DATABASE_URL:', dbUrl.substring(0, 50) + '...')

    // Create Prisma client with PrismaPg adapter for direct PostgreSQL connection
    const adapter = new PrismaPg({
      url: dbUrl,
      connectionConfig: {
        connectTimeoutSeconds: 5,
      },
    })

    const client = new PrismaClient({
      adapter,
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
  // Re-throw the error instead of silently failing
  throw error
}

export const prisma = prismaInstance

if (process.env.NODE_ENV !== 'production' && typeof global !== 'undefined') {
  global.prisma = prisma
}
