import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

const prismaClientSingleton = () => {
  console.log('[Prisma] Initializing Prisma Client (v6)')

  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    // Configure connection pool: increase max connections for Node.js (not serverless)
    // For PgBouncer: recommend 4-8 connections per Prisma instance
  })

  // Log connection events for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log('[Prisma] Connection pool debugging enabled')
  }

  // Set query timeout to fail fast instead of hanging indefinitely
  client.$use(async (params, next) => {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Query timeout (30s): ${params.model}.${params.action}`)),
        30000 // 30 second timeout per query
      )
    )

    return Promise.race([next(params), timeoutPromise])
  })

  console.log('[Prisma] Client initialized successfully with 30s query timeout')
  return client
}

type PrismaClientType = PrismaClient & { _activePromise?: Promise<void> }

let prismaInstance: PrismaClientType = (global.prisma || prismaClientSingleton()) as PrismaClientType

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prismaInstance
}

export const prisma = prismaInstance
