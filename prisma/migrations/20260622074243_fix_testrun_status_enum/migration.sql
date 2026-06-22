-- Migrate TestRun.status column from RunStatus to TestRunStatus

-- First, create a temporary column with the new type
ALTER TABLE "TestRun" ADD COLUMN "status_new" "TestRunStatus";

-- Copy data from old column to new column
UPDATE "TestRun" SET "status_new" = "status"::text::"TestRunStatus";

-- Drop the old column (this will cascade)
ALTER TABLE "TestRun" DROP COLUMN "status";

-- Rename the new column to the original name
ALTER TABLE "TestRun" RENAME COLUMN "status_new" TO "status";

-- Set default value
ALTER TABLE "TestRun" ALTER COLUMN "status" SET DEFAULT 'NOT_EXECUTED'::text::"TestRunStatus";

-- Drop the old RunStatus enum if it's no longer used
DROP TYPE IF EXISTS "RunStatus";
