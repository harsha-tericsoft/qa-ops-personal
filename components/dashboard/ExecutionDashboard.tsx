'use client'

import { useState, useEffect } from 'react'
import { MetricCard } from './MetricCard'
import { MetricGrid } from './MetricGrid'
import { Spinner } from '@/components/ui/Spinner'

interface ExecutionCycle {
  id: string
  name: string
  description?: string
  status: string
}

interface CycleMetrics {
  total: number
  pass: number
  fail: number
  blocked: number
  notExecuted: number
  passRate: number
  executionRate: number
}

interface ExecutionDashboardProps {
  projectId: string
}

export function ExecutionDashboard({ projectId }: ExecutionDashboardProps) {
  const [cycles, setCycles] = useState<ExecutionCycle[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<CycleMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [metricsLoading, setMetricsLoading] = useState(false)

  // Fetch execution cycles
  useEffect(() => {
    fetchCycles()
  }, [projectId])

  // Fetch cycle metrics when cycle is selected
  useEffect(() => {
    if (selectedCycleId) {
      fetchMetrics(selectedCycleId)
    }
  }, [selectedCycleId])

  const fetchCycles = async () => {
    try {
      const response = await fetch(`/api/execution-cycles?projectId=${projectId}`)
      if (response.ok) {
        const data = await response.json()
        setCycles(Array.isArray(data) ? data : [])
        // Auto-select first cycle
        if (data.length > 0 && !selectedCycleId) {
          setSelectedCycleId(data[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch cycles:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMetrics = async (cycleId: string) => {
    setMetricsLoading(true)
    try {
      const response = await fetch(`/api/dashboard/metrics?scope=cycle&cycleId=${cycleId}`)
      if (response.ok) {
        const data = await response.json()
        setMetrics(data)
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error)
    } finally {
      setMetricsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
      </div>
    )
  }

  if (cycles.length === 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-bold text-blue-900 mb-2">📊 Execution Dashboard</h3>
        <p className="text-blue-700 mb-4">No execution cycles yet. Create one to start tracking execution metrics.</p>
        <a href="/cycles" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Go to Execution Cycles
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Execution Cycle Selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-900 mb-2">
          📊 Select Execution Cycle
        </label>
        <select
          value={selectedCycleId || ''}
          onChange={(e) => setSelectedCycleId(e.target.value)}
          className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Choose a cycle...</option>
          {cycles.map((cycle) => (
            <option key={cycle.id} value={cycle.id}>
              {cycle.name} ({cycle.status})
            </option>
          ))}
        </select>
      </div>

      {/* Metrics - only show if cycle selected */}
      {selectedCycleId && (
        <>
          {metricsLoading ? (
            <div className="flex items-center justify-center p-8">
              <Spinner />
            </div>
          ) : metrics ? (
            <>
              {/* Overview Metrics */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-900">Test Execution Results</h3>
                <MetricGrid>
                  <MetricCard
                    label="Total Tests"
                    value={metrics.total}
                    color="blue"
                  />
                  <MetricCard
                    label="Passed"
                    value={metrics.pass}
                    color="green"
                  />
                  <MetricCard
                    label="Failed"
                    value={metrics.fail}
                    color="red"
                  />
                  <MetricCard
                    label="Blocked"
                    value={metrics.blocked}
                    color="orange"
                  />
                  <MetricCard
                    label="Not Executed"
                    value={metrics.notExecuted}
                    color="grey"
                  />
                </MetricGrid>
              </div>

              {/* Key Metrics */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-900">Key Performance Indicators</h3>
                <MetricGrid>
                  <MetricCard
                    label="Pass Rate"
                    value={`${metrics.passRate}%`}
                    color={
                      metrics.passRate >= 90
                        ? 'green'
                        : metrics.passRate >= 75
                          ? 'orange'
                          : 'red'
                    }
                  />
                  <MetricCard
                    label="Execution Rate"
                    value={`${metrics.executionRate}%`}
                    color={
                      metrics.executionRate >= 95
                        ? 'green'
                        : metrics.executionRate >= 80
                          ? 'orange'
                          : 'red'
                    }
                  />
                  <MetricCard
                    label="Remaining"
                    value={metrics.notExecuted}
                    subtitle={`${metrics.total > 0 ? Math.round((metrics.notExecuted / metrics.total) * 100) : 0}% of total`}
                    color={metrics.notExecuted === 0 ? 'green' : 'orange'}
                  />
                </MetricGrid>
              </div>

              {/* Health Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {metrics.fail > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">⚠️</div>
                      <div>
                        <div className="font-bold text-red-900">{metrics.fail} Failed</div>
                        <div className="text-sm text-red-700">Tests failed during execution</div>
                      </div>
                    </div>
                  </div>
                )}
                {metrics.blocked > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">🚫</div>
                      <div>
                        <div className="font-bold text-yellow-900">{metrics.blocked} Blocked</div>
                        <div className="text-sm text-yellow-700">Tests blocked from execution</div>
                      </div>
                    </div>
                  </div>
                )}
                {metrics.notExecuted > 0 && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">⏱️</div>
                      <div>
                        <div className="font-bold text-gray-900">{metrics.notExecuted} Pending</div>
                        <div className="text-sm text-gray-700">Tests not yet executed</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
              <p className="text-gray-600">No metrics available for this cycle</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
