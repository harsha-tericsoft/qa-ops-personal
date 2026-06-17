-- Create enum types for TestCase status and priority
CREATE TYPE "TestCaseStatus" AS ENUM ('NOT_RUN', 'PASSED', 'FAILED', 'BLOCKED', 'IN_PROGRESS');
CREATE TYPE "TestCasePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- Create RoamTestCase table
CREATE TABLE "RoamTestCase" (
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

-- Create indexes
CREATE INDEX "RoamTestCase_projectId_idx" ON "RoamTestCase"("projectId");
CREATE INDEX "RoamTestCase_repositoryNodeId_idx" ON "RoamTestCase"("repositoryNodeId");
CREATE INDEX "RoamTestCase_status_idx" ON "RoamTestCase"("status");

-- Add constraint to Project to ensure RoamTestCase relationship is optional
CREATE INDEX "RoamTestCase_projectId_repositoryNodeId_idx" ON "RoamTestCase"("projectId", "repositoryNodeId");
