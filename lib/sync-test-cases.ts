import { prisma } from '@/lib/prisma'

/**
 * Synchronize RoamTestCase records with TestCase records and tags.
 * 1. For every RoamTestCase that doesn't have a corresponding TestCase, create one
 * 2. Sync tags from RoamTestCase to TestCase via Tag/TagTestCase relationship
 * Uses batching to avoid database connection exhaustion
 */
export async function syncTestCases(projectId?: string) {
  const startTime = Date.now()
  let totalCreated = 0
  let tagsCreated = 0
  let tagLinksCreated = 0
  const batchSize = 500

  try {
    // Phase 1: Sync TestCase records
    // Count roam test cases first
    const totalRoam = await prisma.roamTestCase.count({
      where: projectId ? { projectId } : undefined,
    })

    console.log(`[sync-test-cases] Found ${totalRoam} RoamTestCase records`)

    // Process in batches
    let skip = 0
    let processedBatches = 0
    while (skip < totalRoam) {
      const batch = await prisma.roamTestCase.findMany({
        where: projectId ? { projectId } : undefined,
        select: {
          id: true,
          title: true,
          sourceRoamUid: true,
          projectId: true,
          tags: true,
        },
        skip,
        take: batchSize,
      })

      if (batch.length === 0) break

      // Get existing test cases for quick lookup
      const existingTestCases = await prisma.testCase.findMany({
        where: {
          ...(projectId ? { projectId } : {}),
          title: { in: batch.map(rtc => rtc.title) },
        },
        select: {
          title: true,
          projectId: true,
        },
      })

      const existingSet = new Set(
        existingTestCases.map(tc => `${tc.projectId}::${tc.title}`)
      )

      // Prepare batch create data
      const toCreate = batch
        .filter(rtc => !existingSet.has(`${rtc.projectId}::${rtc.title}`))
        .map(rtc => ({
          projectId: rtc.projectId,
          title: rtc.title,
          description: rtc.sourceRoamUid ? `Extracted from: ${rtc.sourceRoamUid}` : undefined,
        }))

      if (toCreate.length > 0) {
        const result = await prisma.testCase.createMany({
          data: toCreate,
          skipDuplicates: true,
        })
        totalCreated += result.count
      }

      processedBatches++
      skip += batchSize
      if (processedBatches % 5 === 0) {
        console.log(`[sync-test-cases] Processed ${skip} RoamTestCases...`)
      }
    }

    console.log(`[sync-test-cases] Phase 1 complete: Created ${totalCreated} TestCase records`)

    // Phase 2: Collect all unique tags and create them
    console.log('[sync-test-cases] Phase 2: Creating tags...')

    // Collect unique tags by project
    const tagsByProject = new Map<string, Set<string>>()

    const allRoamCount = await prisma.roamTestCase.count({
      where: projectId ? { projectId } : undefined,
    })

    skip = 0
    processedBatches = 0
    while (skip < allRoamCount) {
      const batch = await prisma.roamTestCase.findMany({
        where: projectId ? { projectId } : undefined,
        select: {
          projectId: true,
          tags: true,
        },
        skip,
        take: batchSize,
      })

      if (batch.length === 0) break

      for (const roam of batch) {
        if (!tagsByProject.has(roam.projectId)) {
          tagsByProject.set(roam.projectId, new Set())
        }
        const projectTags = tagsByProject.get(roam.projectId)!
        roam.tags.forEach(tag => projectTags.add(tag))
      }

      skip += batchSize
    }

    // Create tags
    let tagsTotal = 0
    for (const [projectId_key, tags] of tagsByProject) {
      for (const tagName of tags) {
        tagsTotal++
        try {
          await prisma.tag.upsert({
            where: {
              projectId_name: {
                projectId: projectId_key,
                name: tagName,
              },
            },
            update: {},
            create: {
              projectId: projectId_key,
              name: tagName,
            },
          })
          tagsCreated++
        } catch (err) {
          // Tag already exists, skip
        }
      }
    }

    console.log(`[sync-test-cases] Phase 2 complete: Created/verified ${tagsCreated}/${tagsTotal} Tag records`)

    // Phase 3: Link TestCases to their tags in batches
    console.log('[sync-test-cases] Phase 3: Linking TestCases to tags...')

    skip = 0
    processedBatches = 0
    while (skip < allRoamCount) {
      const batch = await prisma.roamTestCase.findMany({
        where: projectId ? { projectId } : undefined,
        select: {
          title: true,
          projectId: true,
          tags: true,
        },
        skip,
        take: batchSize,
      })

      if (batch.length === 0) break

      // Get all test cases for this batch
      const testCases = await prisma.testCase.findMany({
        where: {
          OR: batch.map(b => ({
            projectId: b.projectId,
            title: b.title,
          })),
        },
        select: {
          id: true,
          title: true,
          projectId: true,
        },
      })

      const tcMap = new Map<string, string>()
      testCases.forEach(tc => {
        tcMap.set(`${tc.projectId}::${tc.title}`, tc.id)
      })

      // For each roam test case, link its TestCase to tags
      for (const roam of batch) {
        const tcId = tcMap.get(`${roam.projectId}::${roam.title}`)
        if (tcId && roam.tags.length > 0) {
          // Get tag IDs
          const tags = await prisma.tag.findMany({
            where: {
              projectId: roam.projectId,
              name: { in: roam.tags },
            },
            select: { id: true },
          })

          // Create links
          for (const tag of tags) {
            try {
              await prisma.tagTestCase.upsert({
                where: {
                  tagId_testCaseId: {
                    tagId: tag.id,
                    testCaseId: tcId,
                  },
                },
                update: {},
                create: {
                  tagId: tag.id,
                  testCaseId: tcId,
                },
              })
              tagLinksCreated++
            } catch (err) {
              // Link already exists, skip
            }
          }
        }
      }

      skip += batchSize
      processedBatches++
      if (processedBatches % 5 === 0) {
        console.log(`[sync-test-cases] Tagged ${skip} test cases...`)
      }
    }

    console.log(`[sync-test-cases] Phase 3 complete: Created ${tagLinksCreated} TagTestCase links`)

    const duration = Date.now() - startTime
    console.log(`[sync-test-cases] Sync completed in ${duration}ms`)

    return {
      success: true,
      roamTestCasesProcessed: allRoamCount,
      newTestCasesCreated: totalCreated,
      tagsCreated,
      tagLinksCreated,
      durationMs: duration,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[sync-test-cases] Error:', msg)
    return {
      success: false,
      error: msg,
    }
  }
}
