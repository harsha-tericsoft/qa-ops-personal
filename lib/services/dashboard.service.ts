import { PrismaClient } from '@/app/generated/prisma'

const prisma = new PrismaClient()

export interface DashboardMetrics {
  totalTests: number
  syncedTests: number
  activeCycles: number
  passRate: number // 0-100
  failRate: number // 0-100
  blockedTests: number
  openDefects: number
  readiness: 'READY' | 'AT_RISK' | 'NOT_READY'
  // raw counts for breakdown
  passCount: number
  failCount: number
  totalRunTests: number
}

export async function getProjectDashboardMetrics(
  projectId: string
): Promise<DashboardMetrics> {
  const [totalTests, syncedTests, activeCycles, runStats, openDefects] =
    await Promise.all([
      // 1. Total Tests
      prisma.testCase.count({ where: { projectId } }),

      // 2. Synced Tests (linked to RepositoryNode with roamNodeId)
      prisma.testCase.count({
        where: {
          projectId,
          nodes: { some: { node: { roamNodeId: { not: null } } } },
        },
      }),

      // 3. Active Cycles
      prisma.executionCycle.count({
        where: { projectId, status: 'IN_PROGRESS' },
      }),

      // 4+5+6. Pass/Fail/Blocked — aggregate across active cycle runs
      prisma.testRun.groupBy({
        by: ['status'],
        where: { cycle: { projectId, status: 'IN_PROGRESS' } },
        _count: { status: true },
      }),

      // 7. Open Defects — JiraLinks on FAIL/BLOCKED runs
      prisma.jiraLink.count({
        where: {
          run: {
            status: { in: ['FAIL', 'BLOCKED'] },
            cycle: { projectId },
          },
        },
      }),
    ])

  // Extract counts from runStats groupBy result
  const passCount =
    runStats.find((s) => s.status === 'PASS')?._count.status ?? 0
  const failCount =
    runStats.find((s) => s.status === 'FAIL')?._count.status ?? 0
  const blockedCount =
    runStats.find((s) => s.status === 'BLOCKED')?._count.status ?? 0

  const totalRunTests = passCount + failCount + blockedCount

  // Calculate rates
  const passRate =
    totalRunTests > 0
      ? Math.round((passCount / totalRunTests) * 100 * 10) / 10
      : 0
  const failRate =
    totalRunTests > 0
      ? Math.round((failCount / totalRunTests) * 100 * 10) / 10
      : 0

  // Determine readiness
  let readiness: 'READY' | 'AT_RISK' | 'NOT_READY'

  if (passRate >= 95 && blockedCount === 0 && openDefects === 0) {
    readiness = 'READY'
  } else if (passRate >= 80 && (blockedCount > 0 || openDefects > 0)) {
    readiness = 'AT_RISK'
  } else {
    readiness = 'NOT_READY'
  }

  return {
    totalTests,
    syncedTests,
    activeCycles,
    passRate,
    failRate,
    blockedTests: blockedCount,
    openDefects,
    readiness,
    passCount,
    failCount,
    totalRunTests,
  }
}
