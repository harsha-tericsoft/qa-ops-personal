-- Migration: Remove deprecated apiEndpoint, replace apiToken with localApiToken

-- Step 1: Add new localApiToken column
ALTER TABLE "RoamConfig"
ADD COLUMN "localApiToken" TEXT;

-- Step 2: If existing apiToken values exist, copy them as a base
-- (in production, users will need to re-enter their local API tokens)
UPDATE "RoamConfig"
SET "localApiToken" = "apiToken"
WHERE "apiToken" IS NOT NULL;

-- Step 3: Make localApiToken required going forward
ALTER TABLE "RoamConfig"
ALTER COLUMN "localApiToken" SET NOT NULL;

-- Step 4: Drop old columns that are no longer needed
ALTER TABLE "RoamConfig"
DROP COLUMN "apiToken";

ALTER TABLE "RoamConfig"
DROP COLUMN "apiEndpoint";
