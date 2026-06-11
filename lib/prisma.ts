import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

const prismaClientSingleton = () => {
  try {
    console.log('[Prisma] Initializing Prisma Client (v6)')

    const client = new PrismaClient({
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
