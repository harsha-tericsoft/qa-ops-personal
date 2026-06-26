import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

const prismaClientSingleton = () => {
  console.log('[Prisma] Initializing Prisma Client (v6)')

  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['error', 'warn', 'query']
      : ['error'],
  })

  // Enable query performance logging in development
  if (process.env.NODE_ENV === 'development') {
    client.$on('query', (e) => {
      console.log(`[SQL] ${e.query} (${e.duration}ms)`)
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
