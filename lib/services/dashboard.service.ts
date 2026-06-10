import { getDashboardMetrics } from '@/lib/db'

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

export async function getProjectDashboardMetrics(
  projectId: string
): Promise<DashboardMetrics> {
  return getDashboardMetrics(projectId)
}
