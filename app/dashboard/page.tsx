'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useEffect, useState, useCallback } from 'react'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { ReadinessBadge } from '@/components/dashboard/ReadinessBadge'
import { MetricGrid } from '@/components/dashboard/MetricGrid'
import { ProjectSelector } from '@/components/dashboard/ProjectSelector'
import { RepositorySection } from '@/components/dashboard/RepositorySection'
import { RoamIntegrationStatus } from '@/components/dashboard/RoamIntegrationStatus'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { ExecutionDashboard } from '@/components/dashboard/ExecutionDashboard'

interface DashboardMetrics {
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
  executionCycles?: {
    total: number
    pass: number
    fail: number
    blocked: number
    notExecuted: number
    passRate: number
    executionRate: number
  }
}

function formatMetric(value: number | null): string {
  if (value === null) return '-'
  return `${value.toFixed(1)}%`
}

function DashboardContent() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<any[]>([])
  const [currentProjectId, setCurrentProjectId] = useState<string>('')
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Load projects on mount
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const res = await fetch('/api/projects')
        if (res.ok) {
          const data = await res.json()
          setProjects(data)
          // Auto-select first project
          if (data.length > 0 && !currentProjectId) {
            setCurrentProjectId(data[0].id)
          }
        }
      } catch (err) {
        console.error('Failed to load projects:', err)
      }
    }
    loadProjects()
  }, [])

  const fetchMetrics = useCallback(async (projectId: string) => {
    setLoading(true)
    setError('')
    try {
      // Try new metrics API first
      const response = await fetch(`/api/dashboard/summary?projectId=${projectId}`)
      if (response.ok) {
        const summaryData = await response.json()
        // Transform to legacy format - now using actual API values
        const data: DashboardMetrics = {
          totalTests: summaryData.totalTests,
          repositoryTests: summaryData.totalTests,
          testSuites: summaryData.testSuites || 0,
          tagCount: summaryData.tagCount || 0,
          activeCycles: summaryData.activeCycles || 0,
          passRate: summaryData.totalTests > 0 ? summaryData.passRate : null,
          failRate: summaryData.totalTests > 0 ? ((summaryData.failed / summaryData.totalTests) * 100) : null,
          blockedRate: summaryData.totalTests > 0 ? ((summaryData.blocked / summaryData.totalTests) * 100) : null,
          blockedTests: summaryData.blocked,
          openDefects: 0,
          readiness: 'READY',
          passCount: summaryData.passed,
          failCount: summaryData.failed,
          totalRunTests: summaryData.passed + summaryData.failed + summaryData.blocked + summaryData.inProgress,
          hasExecutionData: (summaryData.passed + summaryData.failed) > 0,
          roamConfig: {
            isConfigured: true,
            lastSyncAt: new Date(summaryData.timestamp),
            lastSyncStatus: 'SUCCESS',
          },
          executionCycles: summaryData.executionCycles,
        }
        setMetrics(data)
      } else {
        setError('Failed to load dashboard metrics')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMetrics(currentProjectId)
  }, [currentProjectId, fetchMetrics])

  const handleProjectChange = (projectId: string) => {
    setCurrentProjectId(projectId)
  }

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

  return (
    <main className="p-6 space-y-6">
      {/* Header with Project Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-700 mt-1">Welcome, {user?.name}! 👋</p>
        </div>
        {user?.role === 'LEAD' && (
          <ProjectSelector
            currentProjectId={currentProjectId}
            onProjectChange={handleProjectChange}
          />
        )}
      </div>

      {/* Execution Dashboard: Cycle-focused QA metrics */}
      <ExecutionDashboard projectId={currentProjectId} />

      {/* Repository Section */}
      <RepositorySection
        repositoryTests={metrics.repositoryTests}
        tagCount={metrics.tagCount}
        lastSyncAt={metrics.roamConfig.lastSyncAt}
        lastSyncStatus={metrics.roamConfig.lastSyncStatus}
      />

      {/* Execution Cycle Metrics */}
      {metrics.executionCycles && metrics.executionCycles.total > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 text-gray-900">Execution Cycle Results</h2>
          <MetricGrid>
            <MetricCard
              label="Total Tests"
              value={metrics.executionCycles.total}
              color="blue"
            />
            <MetricCard
              label="Passed"
              value={metrics.executionCycles.pass}
              color="green"
            />
            <MetricCard
              label="Failed"
              value={metrics.executionCycles.fail}
              color="red"
            />
            <MetricCard
              label="Blocked"
              value={metrics.executionCycles.blocked}
              color="orange"
            />
            <MetricCard
              label="Not Executed"
              value={metrics.executionCycles.notExecuted}
              color="grey"
            />
            <MetricCard
              label="Pass Rate"
              value={formatMetric(metrics.executionCycles.passRate)}
              color={
                metrics.executionCycles.passRate >= 75
                  ? 'green'
                  : metrics.executionCycles.passRate >= 50
                    ? 'orange'
                    : 'red'
              }
            />
          </MetricGrid>
        </div>
      )}

      {/* Quality Metrics */}
      {metrics.hasExecutionData && (
        <div>
          <h2 className="text-lg font-semibold mb-3 text-gray-900">Quality Metrics</h2>
          <MetricGrid>
            <MetricCard
              label="Pass Rate"
              value={formatMetric(metrics.passRate)}
              color={
                metrics.passRate !== null && metrics.passRate >= 95
                  ? 'green'
                  : 'orange'
              }
            />
            <MetricCard
              label="Fail Rate"
              value={formatMetric(metrics.failRate)}
              color={
                metrics.failRate !== null && metrics.failRate <= 2
                  ? 'green'
                  : 'red'
              }
            />
            <MetricCard
              label="Blocked Rate"
              value={formatMetric(metrics.blockedRate)}
              color={
                metrics.blockedRate !== null && metrics.blockedRate === 0
                  ? 'green'
                  : 'orange'
              }
            />
          </MetricGrid>
        </div>
      )}

      {/* Release Readiness */}
      <div>
        <h2 className="text-lg font-semibold mb-3 text-gray-900">Release Readiness</h2>
        <ReadinessBadge
          status={metrics.readiness}
          passRate={metrics.passRate}
          blockedTests={metrics.blockedTests}
          openDefects={metrics.openDefects}
        />
      </div>

      {/* Roam Integration Status */}
      <RoamIntegrationStatus
        isConfigured={metrics.roamConfig.isConfigured}
        lastSyncAt={metrics.roamConfig.lastSyncAt}
        lastSyncStatus={metrics.roamConfig.lastSyncStatus}
        repositoryTests={metrics.repositoryTests}
      />

      {/* Recent Activity */}
      <RecentActivity projectId={currentProjectId} />
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
