'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useEffect, useState } from 'react'
import { formatPercent } from '@/lib/utils/formatters'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { ReadinessBadge } from '@/components/dashboard/ReadinessBadge'
import { MetricGrid } from '@/components/dashboard/MetricGrid'

interface DashboardMetrics {
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

function DashboardContent() {
  const { user } = useAuth()
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const pid = 'default-project'
        const response = await fetch(`/api/dashboard?projectId=${pid}`)
        if (response.ok) {
          const data = await response.json()
          setMetrics(data)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load metrics')
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [])

  if (loading) {
    return <div className="p-8">Loading dashboard...</div>
  }

  if (error || !metrics) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="font-bold text-red-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  const syncedPercent =
    metrics.totalTests > 0
      ? Math.round((metrics.syncedTests / metrics.totalTests) * 100)
      : 0

  return (
    <main className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome, {user?.name}! 👋</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Default Project</p>
          <p className="font-semibold text-gray-900">Banking App Testing</p>
        </div>
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

      {/* User Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <p className="text-sm text-blue-900">
          <strong>👤 Account:</strong> {user?.name} ({user?.role === 'LEAD' ? '👑 Lead' : '🧪 QA Engineer'})
        </p>
      </div>
    </main>
  )
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  )
}
