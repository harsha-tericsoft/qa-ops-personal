-- Phase 1A: Roam Local API Integration Migration

-- 1. Update RoamConfig table for Local API support
ALTER TABLE "RoamConfig"
  DROP COLUMN IF EXISTS "graphUrl",
  ADD COLUMN IF NOT EXISTS "apiEndpoint" VARCHAR DEFAULT 'http://localhost:8000',
  ADD COLUMN IF NOT EXISTS "lastSyncError" TEXT;

-- 2. Update Repository table with sync tracking
ALTER TABLE "Repository"
  ADD COLUMN "lastSyncAt" TIMESTAMP,
  ADD COLUMN "lastSyncStatus" VARCHAR,
  ADD COLUMN "lastSyncError" TEXT,
  ADD COLUMN "totalTestCount" INTEGER DEFAULT 0;

-- 3. Update RepositoryNode table for metadata storage
ALTER TABLE "RepositoryNode"
  ADD COLUMN "tags" TEXT[] DEFAULT '{}';

-- 4. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_roamconfig_projectid ON "RoamConfig"("projectId");
CREATE INDEX IF NOT EXISTS idx_repository_projectid ON "Repository"("projectId");
CREATE INDEX IF NOT EXISTS idx_repositorynode_isautomated ON "RepositoryNode" USING gin("tags");

-- 5. Update RepositoryNode metadata field to store flexible Roam data
-- (metadata column already exists as Json, no changes needed)

-- 6. Add index on lastSyncStatus for quick filtering
CREATE INDEX IF NOT EXISTS idx_repository_lastsyncstatus ON "Repository"("lastSyncStatus");
