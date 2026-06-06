import { getProjectDashboardMetrics } from '@/lib/services/dashboard.service'
import { formatPercent } from '@/lib/utils/formatters'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { ReadinessBadge } from '@/components/dashboard/ReadinessBadge'
import { MetricGrid } from '@/components/dashboard/MetricGrid'

interface PageProps {
  searchParams: Promise<{ projectId?: string }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { projectId } = await searchParams

  // For now, use a default project ID if not provided
  // In a real app, you'd fetch user's projects or show a selector
  const pid = projectId || 'default-project'

  const metrics = await getProjectDashboardMetrics(pid)

  const syncedPercent =
    metrics.totalTests > 0
      ? Math.round((metrics.syncedTests / metrics.totalTests) * 100)
      : 0

  return (
    <main className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">QA Ops Dashboard</h1>
        <div className="text-sm text-gray-600">Project: {pid}</div>
      </div>

      {/* Top Row: Count Metrics */}
      <MetricGrid>
        <MetricCard
          label="Total Tests"
          value={metrics.totalTests}
          color="blue"
        />
        <MetricCard
          label="Synced Tests"
          value={metrics.syncedTests}
          subtitle={`${syncedPercent}% synced`}
          color="blue"
        />
        <MetricCard
          label="Active Cycles"
          value={metrics.activeCycles}
          color="blue"
        />
        <MetricCard
          label="Total Runs"
          value={metrics.totalRunTests}
          subtitle={`${metrics.passCount} pass, ${metrics.failCount} fail`}
          color="blue"
        />
      </MetricGrid>

      {/* Middle Row: Rate Metrics */}
      <MetricGrid>
        <MetricCard
          label="Pass Rate"
          value={formatPercent(metrics.passRate)}
          color={metrics.passRate >= 95 ? 'green' : 'orange'}
        />
        <MetricCard
          label="Fail Rate"
          value={formatPercent(metrics.failRate)}
          color={metrics.failRate <= 2 ? 'green' : 'red'}
        />
        <MetricCard
          label="Blocked Tests"
          value={metrics.blockedTests}
          color={metrics.blockedTests === 0 ? 'green' : 'orange'}
        />
        <MetricCard
          label="Open Defects"
          value={metrics.openDefects}
          color={metrics.openDefects === 0 ? 'green' : 'red'}
        />
      </MetricGrid>

      {/* Release Readiness */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Release Readiness</h2>
        <ReadinessBadge
          status={metrics.readiness}
          passRate={metrics.passRate}
          blockedTests={metrics.blockedTests}
          openDefects={metrics.openDefects}
        />
      </div>
    </main>
  )
}
