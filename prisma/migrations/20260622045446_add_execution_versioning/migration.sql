-- CreateEnum ExecutionStatus
CREATE TYPE "ExecutionStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum TestRunStatus (if RunStatus doesn't exist, create it; if it does, we'll keep it)
CREATE TYPE "TestRunStatus" AS ENUM ('NOT_EXECUTED', 'PASS', 'FAIL', 'BLOCKED');

-- CreateTable ExecutionVersion
CREATE TABLE "ExecutionVersion" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "buildVersion" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'DRAFT',
    "releaseNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ExecutionVersion_pkey" PRIMARY KEY ("id")
);

-- AddColumn versionId to TestRun
ALTER TABLE "TestRun" ADD COLUMN "versionId" TEXT;

-- CreateIndex ExecutionVersion
CREATE UNIQUE INDEX "ExecutionVersion_cycleId_versionNumber_key" ON "ExecutionVersion"("cycleId", "versionNumber");
CREATE UNIQUE INDEX "ExecutionVersion_cycleId_buildVersion_key" ON "ExecutionVersion"("cycleId", "buildVersion");
CREATE INDEX "ExecutionVersion_cycleId_idx" ON "ExecutionVersion"("cycleId");
CREATE INDEX "ExecutionVersion_status_idx" ON "ExecutionVersion"("status");

-- AddForeignKey ExecutionVersion
ALTER TABLE "ExecutionVersion" ADD CONSTRAINT "ExecutionVersion_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ExecutionCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey TestRun (versionId) - make it non-nullable after backfill
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ExecutionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex TestRun versionId
CREATE INDEX "TestRun_versionId_idx" ON "TestRun"("versionId");
