import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

const prismaClientSingleton = () => {
  console.log('[Prisma] Initializing Prisma Client (v6)')

  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['error', 'warn']
      : ['error'],
    // Add connection management settings
    errorFormat: 'pretty',
  })

  // Handle connection errors
  client.$on('error', (e) => {
    console.error('[Prisma Error]', e)
  })

  // Enable query performance logging in development (less verbose)
  if (process.env.NODE_ENV === 'development') {
    client.$on('query', (e) => {
      if (e.duration > 1000) {
        console.warn(`[Slow SQL] ${e.query.substring(0, 80)}... (${e.duration}ms)`)
      }
    })
  }

  console.log('[Prisma] Client initialized successfully')
  return client
}

type PrismaClientType = PrismaClient & { _activePromise?: Promise<void> }

let prismaInstance: PrismaClientType = (global.prisma || prismaClientSingleton()) as PrismaClientType

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prismaInstance
}

export const prisma = prismaInstance

// Health check function
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    console.log('[Database] Connection successful')
    return true
  } catch (error) {
    console.error('[Database] Connection failed:', error instanceof Error ? error.message : String(error))
    return false
  }
}
