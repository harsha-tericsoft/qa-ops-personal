-- Fix roamNodeId unique constraint scope
-- Change from global unique to scoped to repositoryId
-- This allows the same Roam node UID to exist in different repositories

-- Drop the existing global unique constraint on roamNodeId
ALTER TABLE "RepositoryNode" DROP CONSTRAINT "RepositoryNode_roamNodeId_key";

-- Add composite unique constraint scoped to repositoryId
ALTER TABLE "RepositoryNode" ADD CONSTRAINT "RepositoryNode_repositoryId_roamNodeId_key" UNIQUE("repositoryId", "roamNodeId");
