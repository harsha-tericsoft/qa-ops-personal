-- REQUIRED: Execute this SQL on the Supabase/PostgreSQL database to add repositoryRootPage column to RoamConfig table
-- This resolves the error: "The column `RoamConfig.repositoryRootPage` does not exist in the current database."

-- Add the column
ALTER TABLE "RoamConfig"
ADD COLUMN IF NOT EXISTS "repositoryRootPage" TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_roamconfig_repository_root_page ON "RoamConfig"("repositoryRootPage");

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'RoamConfig'
AND column_name = 'repositoryRootPage';
