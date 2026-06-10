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
    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
  } catch (error) {
    console.error('Failed to initialize Prisma Client:', error)
    throw error
  }
}

export const prisma = global.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

// Graceful shutdown
if (typeof global !== 'undefined') {
  if (process.env.NODE_ENV !== 'production') {
    global.prisma = prisma
  }
}
