import { getDashboardMetrics } from '@/lib/db'

export interface DashboardMetrics {
  totalTests: number
  syncedTests: number
  activeCycles: number
  passRate: number
  failRate: number
  blockedTests: number
  openDefects: number
  readiness: 'READY' | 'AT_RISK' | 'NOT_READY'
  passCount: number
  failCount: number
  totalRunTests: number
}

export async function getProjectDashboardMetrics(
  projectId: string
): Promise<DashboardMetrics> {
  return getDashboardMetrics(projectId)
}
