import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

// Instrumentation for connection pool diagnostics
let activeRequestCount = 0
const requestLog: { id: string; endpoint: string; start: number; queries: Array<{ query: string; duration: number }> }[] = []

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
    console.error('[Prisma Connection Error]', e)
    console.error(`[Pool Status] Active requests: ${activeRequestCount}`)
  })

  console.log('[Prisma] Client initialized successfully')
  return client
}

export function incrementActiveRequests() {
  activeRequestCount++
  if (activeRequestCount > 5) {
    console.warn(`[Pool Warning] ${activeRequestCount} active requests (pool has ~10-20 connections)`)
  }
}

export function decrementActiveRequests() {
  activeRequestCount--
}

export function getPoolStatus() {
  return { activeRequests: activeRequestCount }
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
