-- Phase 1: Tag Synchronization Migration
-- Purpose: Populate Tag and TagTestCase tables from RoamTestCase.tags
-- Safety: Additive only - no modifications to existing tables

-- Step 1: Extract unique tags from all RoamTestCase records and create Tag records
-- This query finds all unique tag values across RoamTestCase.tags and creates Tag records
INSERT INTO "Tag" (id, "projectId", name, color)
SELECT
  gen_random_uuid()::text,
  rtc."projectId",
  tag_name,
  '#6366f1'
FROM (
  SELECT DISTINCT
    rtc."projectId",
    UNNEST(rtc.tags) as tag_name
  FROM "RoamTestCase" rtc
  WHERE rtc.tags IS NOT NULL AND array_length(rtc.tags, 1) > 0
) t
WHERE NOT EXISTS (
  SELECT 1 FROM "Tag" tg
  WHERE tg.name = t.tag_name AND tg."projectId" = t."projectId"
)
ON CONFLICT (projectId, name) DO NOTHING;

-- Step 2: Create TagTestCase relationships
-- Link each tag to its test cases based on RoamTestCase tags
INSERT INTO "TagTestCase" ("tagId", "testCaseId")
SELECT
  t.id,
  tc.id
FROM "RoamTestCase" rtc
CROSS JOIN LATERAL UNNEST(rtc.tags) WITH ORDINALITY AS tag_name
JOIN "Tag" t ON t.name = tag_name AND t."projectId" = rtc."projectId"
JOIN "TestCase" tc ON tc.id = rtc.id
WHERE rtc.tags IS NOT NULL AND array_length(rtc.tags, 1) > 0
ON CONFLICT ("tagId", "testCaseId") DO NOTHING;

-- Note: RoamTestCase.tags remains unchanged as a backup source
-- Both sources can be used for filtering (redundancy for safety)
