import { prisma } from '@/lib/prisma'

interface VerificationResult {
  test: string
  status: 'PASS' | 'FAIL'
  expected: string
  actual: string
}

const results: VerificationResult[] = []

async function verify() {
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('EXECUTION VERSIONING - DATABASE VERIFICATION')
  console.log('═══════════════════════════════════════════════════════════\n')

  try {
    // 1. ExecutionVersion row count
    const versionCount = await prisma.executionVersion.count()
    results.push({
      test: 'ExecutionVersion table exists and has rows',
      status: versionCount > 0 ? 'PASS' : 'FAIL',
      expected: '> 0',
      actual: String(versionCount),
    })

    // 2. TestRun row count
    const runCount = await prisma.testRun.count()
    results.push({
      test: 'TestRun table has rows',
      status: runCount > 0 ? 'PASS' : 'FAIL',
      expected: '> 0',
      actual: String(runCount),
    })

    // 3. TestRuns with versionId (should be all after migration)
    const runsWithVersion = await prisma.testRun.count({
      where: {
        versionId: {
          not: null,
        },
      },
    })
    results.push({
      test: 'All TestRuns have versionId (not null)',
      status: runsWithVersion === runCount ? 'PASS' : 'FAIL',
      expected: String(runCount),
      actual: String(runsWithVersion),
    })

    // 4. TestRuns with null versionId (should be 0)
    const runsWithNullVersion = await prisma.testRun.count({
      where: {
        versionId: null,
      },
    })
    results.push({
      test: 'No TestRuns have null versionId',
      status: runsWithNullVersion === 0 ? 'PASS' : 'FAIL',
      expected: '0',
      actual: String(runsWithNullVersion),
    })

    // 5. Execution cycles still linked correctly
    const cycles = await prisma.executionCycle.findMany({
      include: {
        versions: true,
        testRuns: true,
      },
      take: 1,
    })

    const cycleLinked = cycles.length > 0 && cycles[0].versions.length > 0
    results.push({
      test: 'ExecutionCycle still linked to ExecutionVersion',
      status: cycleLinked ? 'PASS' : 'FAIL',
      expected: 'Cycle has versions',
      actual: cycleLinked ? `Cycle has ${cycles[0]?.versions.length || 0} versions` : 'No cycles',
    })

    // 6. Versions linked to test runs
    if (versionCount > 0) {
      const version = await prisma.executionVersion.findFirst({
        include: { testRuns: true },
      })
      const hasTestRuns = (version?.testRuns.length || 0) > 0
      results.push({
        test: 'ExecutionVersion linked to TestRuns',
        status: hasTestRuns ? 'PASS' : 'FAIL',
        expected: '> 0 test runs',
        actual: String(version?.testRuns.length || 0),
      })
    }

    // 7. Unique constraint check - try duplicate build version
    if (versionCount > 0) {
      const version = await prisma.executionVersion.findFirst()
      if (version) {
        try {
          await prisma.executionVersion.create({
            data: {
              cycleId: version.cycleId,
              versionNumber: 999,
              buildVersion: version.buildVersion,
              status: 'DRAFT',
            },
          })
          results.push({
            test: 'Unique constraint (cycleId, buildVersion) enforced',
            status: 'FAIL',
            expected: 'Constraint violation',
            actual: 'No error (constraint failed)',
          })
        } catch (error) {
          results.push({
            test: 'Unique constraint (cycleId, buildVersion) enforced',
            status: 'PASS',
            expected: 'Constraint violation',
            actual: 'Constraint properly enforced',
          })
        }
      }
    }

    // 8. Version status enum values
    const versions = await prisma.executionVersion.findMany({
      select: { status: true },
    })
    const validStatuses = versions.every((v) =>
      ['DRAFT', 'IN_PROGRESS', 'COMPLETED'].includes(v.status)
    )
    results.push({
      test: 'ExecutionVersion status enum has valid values',
      status: validStatuses ? 'PASS' : 'FAIL',
      expected: 'All statuses in [DRAFT, IN_PROGRESS, COMPLETED]',
      actual: validStatuses ? 'All valid' : 'Invalid status found',
    })

    // 9. TestRun status enum values
    const runs = await prisma.testRun.findMany({
      select: { status: true },
      take: 10,
    })
    const validRunStatuses = runs.every((r) =>
      ['NOT_EXECUTED', 'PASS', 'FAIL', 'BLOCKED'].includes(r.status)
    )
    results.push({
      test: 'TestRun status enum has valid values',
      status: validRunStatuses ? 'PASS' : 'FAIL',
      expected: 'All statuses in [NOT_EXECUTED, PASS, FAIL, BLOCKED]',
      actual: validRunStatuses ? 'All valid' : 'Invalid status found',
    })

    // 10. Version numbers are sequential per cycle
    const cyclicVersions = await prisma.executionVersion.findMany({
      orderBy: { cycleId: 'asc' },
    })
    const cycleMap = new Map<string, number[]>()
    cyclicVersions.forEach((v) => {
      if (!cycleMap.has(v.cycleId)) cycleMap.set(v.cycleId, [])
      cycleMap.get(v.cycleId)!.push(v.versionNumber)
    })

    let versionsSequential = true
    cycleMap.forEach((nums) => {
      const sorted = [...nums].sort((a, b) => a - b)
      if (JSON.stringify(nums) !== JSON.stringify(sorted)) {
        versionsSequential = false
      }
    })

    results.push({
      test: 'Version numbers are sequential per cycle',
      status: versionsSequential ? 'PASS' : 'FAIL',
      expected: 'Sequential numbering',
      actual: versionsSequential ? 'All sequential' : 'Non-sequential found',
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    results.push({
      test: 'Database connection',
      status: 'FAIL',
      expected: 'Connected',
      actual: msg,
    })
  }

  // Print results table
  console.log('┌────────────────────────────────────────┬────────┬──────────────────────┬──────────────────────┐')
  console.log('│ Test                                   │ Status │ Expected             │ Actual               │')
  console.log('├────────────────────────────────────────┼────────┼──────────────────────┼──────────────────────┤')

  results.forEach((r) => {
    const statusColor = r.status === 'PASS' ? '✓' : '✗'
    const testPad = r.test.padEnd(38)
    const statusPad = (statusColor + ' ' + r.status).padEnd(6)
    const expPad = r.expected.substring(0, 20).padEnd(20)
    const actPad = r.actual.substring(0, 20).padEnd(20)

    console.log(`│ ${testPad} │ ${statusPad} │ ${expPad} │ ${actPad} │`)
  })

  console.log('└────────────────────────────────────────┴────────┴──────────────────────┴──────────────────────┘')

  const passed = results.filter((r) => r.status === 'PASS').length
  const total = results.length
  console.log(`\nResult: ${passed}/${total} PASSED`)
  console.log(`Status: ${passed === total ? 'PASS' : 'FAIL'}\n`)

  process.exit(passed === total ? 0 : 1)
}

verify().catch((error) => {
  console.error('Verification failed:', error)
  process.exit(1)
})
