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

  console.log('[Prisma] Client initialized successfully')
  return client
}

type PrismaClientType = PrismaClient & { _activePromise?: Promise<void> }

let prismaInstance: PrismaClientType = (global.prisma || prismaClientSingleton()) as PrismaClientType

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prismaInstance
}

export const prisma = prismaInstance
