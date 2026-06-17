-- Add repositoryRootPage column to RoamConfig
-- This column stores the root page title in Roam from which to import the repository subtree
-- Example values: "Project_Kinergy", "TestSuite : Kinergy", "QA Repository"

ALTER TABLE "RoamConfig"
ADD COLUMN "repositoryRootPage" TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_roamconfig_repository_root_page ON "RoamConfig"("repositoryRootPage");
