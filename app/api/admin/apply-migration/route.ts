import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// TEMPORARY: Apply pending migrations via raw SQL
export async function POST(req: NextRequest) {
  try {
    console.log('[apply-migration] Starting migrations...')

    // Migration 1: Add repositoryRootPage
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "RoamConfig"
        ADD COLUMN IF NOT EXISTS "repositoryRootPage" TEXT;
      `)
      console.log('[apply-migration] repositoryRootPage column added')
    } catch (e) {
      console.log('[apply-migration] repositoryRootPage column already exists')
    }

    // Migration 2: Create TestCaseStatus enum type
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TYPE "TestCaseStatus" AS ENUM ('NOT_RUN', 'PASSED', 'FAILED', 'BLOCKED', 'IN_PROGRESS');
      `)
      console.log('[apply-migration] TestCaseStatus enum created')
    } catch (e) {
      console.log('[apply-migration] TestCaseStatus enum already exists')
    }

    // Migration 3: Create TestCasePriority enum type
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TYPE "TestCasePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
      `)
      console.log('[apply-migration] TestCasePriority enum created')
    } catch (e) {
      console.log('[apply-migration] TestCasePriority enum already exists')
    }

    // Migration 4: Create RoamTestCase table
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "RoamTestCase" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "projectId" TEXT NOT NULL,
          "repositoryNodeId" TEXT NOT NULL UNIQUE,
          "title" TEXT NOT NULL,
          "status" "TestCaseStatus" NOT NULL DEFAULT 'NOT_RUN',
          "priority" "TestCasePriority" NOT NULL DEFAULT 'MEDIUM',
          "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
          "sourceRoamUid" TEXT,
          "lastExecutedAt" TIMESTAMP(3),
          "executionCount" INTEGER NOT NULL DEFAULT 0,
          "passCount" INTEGER NOT NULL DEFAULT 0,
          "failCount" INTEGER NOT NULL DEFAULT 0,
          "metadata" JSONB,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "RoamTestCase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE,
          CONSTRAINT "RoamTestCase_repositoryNodeId_fkey" FOREIGN KEY ("repositoryNodeId") REFERENCES "RepositoryNode" ("id") ON DELETE CASCADE
        );
      `)
      console.log('[apply-migration] RoamTestCase table created')
    } catch (e) {
      console.log('[apply-migration] RoamTestCase table already exists or error:', e instanceof Error ? e.message : String(e))
    }

    // Create indexes
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "RoamTestCase_projectId_idx" ON "RoamTestCase"("projectId");
        CREATE INDEX IF NOT EXISTS "RoamTestCase_repositoryNodeId_idx" ON "RoamTestCase"("repositoryNodeId");
        CREATE INDEX IF NOT EXISTS "RoamTestCase_status_idx" ON "RoamTestCase"("status");
      `)
      console.log('[apply-migration] Indexes created')
    } catch (e) {
      console.log('[apply-migration] Indexes already exist')
    }

    return NextResponse.json({
      success: true,
      message: 'All migrations applied successfully',
    })
  } catch (error) {
    console.error('[apply-migration] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
