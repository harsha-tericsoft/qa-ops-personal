import { prisma } from '@/lib/prisma'

/**
 * Synchronize RoamTestCase records with TestCase records.
 * For every RoamTestCase that doesn't have a corresponding TestCase,
 * create one. This ensures counts are consistent.
 */
export async function syncTestCases(projectId?: string) {
  const startTime = Date.now()
  let totalCreated = 0

  try {
    // Get all roam test cases (optionally filtered by project)
    const roamTestCases = await prisma.roamTestCase.findMany({
      where: projectId ? { projectId } : undefined,
      select: {
        id: true,
        title: true,
        sourceRoamUid: true,
        projectId: true,
      },
    })

    console.log(`[sync-test-cases] Found ${roamTestCases.length} RoamTestCase records`)

    // Get existing test cases for quick lookup
    const existingTestCases = await prisma.testCase.findMany({
      where: projectId ? { projectId } : undefined,
      select: {
        title: true,
        projectId: true,
      },
    })

    const existingSet = new Set(
      existingTestCases.map(tc => `${tc.projectId}::${tc.title}`)
    )

    console.log(`[sync-test-cases] Found ${existingTestCases.length} existing TestCase records`)

    // Prepare batch create data
    const toCreate = roamTestCases
      .filter(rtc => !existingSet.has(`${rtc.projectId}::${rtc.title}`))
      .map(rtc => ({
        projectId: rtc.projectId,
        title: rtc.title,
        description: rtc.sourceRoamUid ? `Extracted from: ${rtc.sourceRoamUid}` : undefined,
      }))

    console.log(`[sync-test-cases] Will create ${toCreate.length} new TestCase records`)

    if (toCreate.length > 0) {
      const result = await prisma.testCase.createMany({
        data: toCreate,
        skipDuplicates: true,
      })
      totalCreated = result.count
      console.log(`[sync-test-cases] Created ${totalCreated} TestCase records`)
    }

    const duration = Date.now() - startTime
    console.log(`[sync-test-cases] Sync completed in ${duration}ms`)

    return {
      success: true,
      roamTestCasesFound: roamTestCases.length,
      existingTestCases: existingTestCases.length,
      newTestCasesCreated: totalCreated,
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
