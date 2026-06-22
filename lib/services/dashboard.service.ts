import { getDashboardMetrics } from '@/lib/db'
import { prisma } from '@/lib/prisma'

export interface DashboardMetrics {
  totalTests: number
  repositoryTests: number
  testSuites: number
  tagCount: number
  activeCycles: number
  passRate: number | null
  failRate: number | null
  blockedRate: number | null
  blockedTests: number
  openDefects: number
  readiness: 'READY' | 'AT_RISK' | 'NOT_READY' | 'INSUFFICIENT_DATA'
  passCount: number
  failCount: number
  totalRunTests: number
  hasExecutionData: boolean
  roamConfig: {
    isConfigured: boolean
    lastSyncAt: Date | null
    lastSyncStatus: string
  }
}

// Three-Scope Dashboard Metrics
export interface ProjectMetrics {
  scope: 'project'
  totalTestCases: number
  manualTestCases: number
  automatedTestCases: number
  testSuites: number
  totalCycles: number
  draftCycles: number
  inProgressCycles: number
  completedCycles: number
}

export interface CycleMetrics {
  scope: 'cycle'
  cycleId: string
  cycleName: string
  passed: number
  failed: number
  blocked: number
  notExecuted: number
  total: number
  executionProgressPercent: number
  passRatePercent: number
  defectCount: number
  versionCount: number
}

export interface VersionMetrics {
  scope: 'version'
  versionId: string
  versionNumber: number
  buildVersion: string
  status: string
  passed: number
  failed: number
  blocked: number
  notExecuted: number
  total: number
  executionProgressPercent: number
  passRatePercent: number
}

export async function getProjectDashboardMetrics(
  projectId: string
): Promise<DashboardMetrics> {
  return getDashboardMetrics(projectId)
}

// Project Scope - All project metrics
export async function getProjectMetrics(projectId: string): Promise<ProjectMetrics> {
  const [testCases, testSuites, cycles] = await Promise.all([
    prisma.testCase.findMany({ where: { projectId } }),
    prisma.testSuite.findMany({ where: { projectId } }),
    prisma.executionCycle.findMany({ where: { projectId } }),
  ])

  const draftCycles = cycles.filter(c => c.status === 'PLANNED').length
  const inProgressCycles = cycles.filter(c => c.status === 'IN_PROGRESS').length
  const completedCycles = cycles.filter(c => c.status === 'COMPLETED').length

  const manualCount = testCases.filter(tc =>
    tc.title?.toUpperCase().includes('MANUAL')
  ).length
  const automatedCount = testCases.filter(tc =>
    tc.title?.toUpperCase().includes('AUTOMATED')
  ).length

  return {
    scope: 'project',
    totalTestCases: testCases.length,
    manualTestCases: manualCount,
    automatedTestCases: automatedCount,
    testSuites: testSuites.length,
    totalCycles: cycles.length,
    draftCycles,
    inProgressCycles,
    completedCycles,
  }
}

// Cycle Scope - Execution metrics for a specific cycle
export async function getCycleMetrics(cycleId: string): Promise<CycleMetrics> {
  const cycle = await prisma.executionCycle.findUniqueOrThrow({
    where: { id: cycleId },
    include: {
      testRuns: true,
      versions: true,
    },
  })

  const testRuns = cycle.testRuns
  const total = testRuns.length

  const passed = testRuns.filter(r => r.status === 'PASS').length
  const failed = testRuns.filter(r => r.status === 'FAIL').length
  const blocked = testRuns.filter(r => r.status === 'BLOCKED').length
  const notExecuted = testRuns.filter(r => r.status === 'NOT_EXECUTED').length

  const executedCount = passed + failed + blocked
  const executionProgressPercent = total > 0 ? Math.round((executedCount / total) * 100) : 0
  const passRatePercent = total > 0 ? Math.round((passed / total) * 100) : 0
  const defectCount = failed + blocked

  return {
    scope: 'cycle',
    cycleId: cycle.id,
    cycleName: cycle.name,
    passed,
    failed,
    blocked,
    notExecuted,
    total,
    executionProgressPercent,
    passRatePercent,
    defectCount,
    versionCount: cycle.versions.length,
  }
}

// Version Scope - Execution metrics for a specific version
export async function getVersionMetrics(versionId: string): Promise<VersionMetrics | null> {
  const version = await prisma.executionVersion.findUnique({
    where: { id: versionId },
    include: {
      testRuns: true,
    },
  })

  if (!version) return null

  const testRuns = version.testRuns
  const total = testRuns.length

  const passed = testRuns.filter(r => r.status === 'PASS').length
  const failed = testRuns.filter(r => r.status === 'FAIL').length
  const blocked = testRuns.filter(r => r.status === 'BLOCKED').length
  const notExecuted = testRuns.filter(r => r.status === 'NOT_EXECUTED').length

  const executedCount = passed + failed + blocked
  const executionProgressPercent = total > 0 ? Math.round((executedCount / total) * 100) : 0
  const passRatePercent = total > 0 ? Math.round((passed / total) * 100) : 0

  return {
    scope: 'version',
    versionId: version.id,
    versionNumber: version.versionNumber,
    buildVersion: version.buildVersion,
    status: version.status,
    passed,
    failed,
    blocked,
    notExecuted,
    total,
    executionProgressPercent,
    passRatePercent,
  }
}
