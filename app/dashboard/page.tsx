'use client'

import { useEffect, useState } from 'react'

interface Project {
  id: string
  name: string
}

interface RepositoryMetrics {
  totalTests: number
  manualTests: number
  automatedTests: number
  coverage: number
  draftCycles: number
  activeCycles: number
  completedCycles: number
  tags: string[]
  lastSync: { time: string; status: string } | null
}

interface ExecutionCycle {
  id: string
  name: string
  status: string
}

interface ExecutionVersion {
  id: string
  buildVersion: string
  versionNumber: number
  status: string
}

interface ExecutionMetrics {
  totalTests: number
  passedTests: number
  failedTests: number
  blockedTests: number
  notExecutedTests: number
  executionRate: number
  passRate: number
}

export default function DashboardPage() {
  const [isReady, setIsReady] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [metrics, setMetrics] = useState<RepositoryMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)

  const [cycles, setCycles] = useState<ExecutionCycle[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState('')
  const [versions, setVersions] = useState<ExecutionVersion[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [executionMetrics, setExecutionMetrics] = useState<ExecutionMetrics | null>(null)
  const [executionLoading, setExecutionLoading] = useState(false)

  const [error, setError] = useState('')

  // Load projects and auto-select first one
  useEffect(() => {
    const initialize = async () => {
      try {
        const res = await fetch('/api/projects')
        if (!res.ok) throw new Error(`API error: ${res.status}`)
        const data = await res.json()
        setProjects(data || [])
        // Auto-select first project
        if (data && data.length > 0) {
          const firstProjectId = data[0].id
          setSelectedProjectId(firstProjectId)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load projects')
      } finally {
        setIsReady(true)
      }
    }
    initialize()
  }, [])

  // Load repository metrics when project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setMetrics(null)
      return
    }

    const loadMetrics = async () => {
      setMetricsLoading(true)
      try {
        const res = await fetch(`/api/dashboard/repository-metrics?projectId=${selectedProjectId}`)
        if (!res.ok) throw new Error(`Metrics error: ${res.status}`)
        const data = await res.json()
        setMetrics(data)
      } catch (err) {
        // Silently handle fetch errors (network issues, CORS, etc.)
        setMetrics(null)
      } finally {
        setMetricsLoading(false)
      }
    }

    loadMetrics()
  }, [selectedProjectId])

  // Load execution cycles when project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setCycles([])
      setSelectedCycleId('')
      return
    }

    const loadCycles = async () => {
      try {
        const res = await fetch(`/api/execution-cycles?projectId=${selectedProjectId}`)
        if (res.ok) {
          const data = await res.json()
          setCycles(data || [])
        }
      } catch (err) {
        // Silently handle fetch errors
      }
    }

    loadCycles()
  }, [selectedProjectId])

  // Load versions when cycle changes
  useEffect(() => {
    if (!selectedCycleId) {
      setVersions([])
      setSelectedVersionId('')
      return
    }

    const loadVersions = async () => {
      try {
        const res = await fetch(`/api/execution-cycles/${selectedCycleId}/versions`)
        if (res.ok) {
          const data = await res.json()
          setVersions(data || [])
        }
      } catch (err) {
        // Silently handle fetch errors
      }
    }

    loadVersions()
  }, [selectedCycleId])

  // Load execution metrics when version is selected
  useEffect(() => {
    if (!selectedVersionId || !selectedCycleId) {
      setExecutionMetrics(null)
      return
    }

    const loadMetrics = async () => {
      setExecutionLoading(true)
      try {
        const res = await fetch(`/api/dashboard/execution-metrics?projectId=${selectedProjectId}&cycleId=${selectedCycleId}&versionId=${selectedVersionId}`)
        if (res.ok) {
          const data = await res.json()
          setExecutionMetrics(data)
        }
      } catch (err) {
        // Silently handle fetch errors
      } finally {
        setExecutionLoading(false)
      }
    }

    loadMetrics()
  }, [selectedVersionId, selectedCycleId, selectedProjectId])

  if (!isReady) {
    return (
      <main className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
          <span className="text-gray-600">Loading dashboard...</span>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Error: {error}
        </div>
      </main>
    )
  }

  return (
    <main className="p-6 space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-gray-900">QA Execution Dashboard</h1>
        <p className="text-gray-600 mt-1">Enterprise test execution and analytics</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Project & Execution Selection</h2>

        <div className="grid grid-cols-3 gap-4">
          {/* Project Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Choose Project --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Cycle Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Execution Cycle</label>
            <select
              value={selectedCycleId}
              onChange={(e) => setSelectedCycleId(e.target.value)}
              disabled={!selectedProjectId}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            >
              <option value="">-- Choose Cycle --</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.status})
                </option>
              ))}
            </select>
          </div>

          {/* Version Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Version</label>
            <select
              value={selectedVersionId}
              onChange={(e) => setSelectedVersionId(e.target.value)}
              disabled={!selectedCycleId}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            >
              <option value="">-- Choose Version --</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionNumber} ({v.buildVersion})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedProjectId && metrics && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Repository Metrics</h2>

          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <div className="text-sm font-medium text-gray-600">Total Tests</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{metrics.totalTests}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <div className="text-sm font-medium text-gray-600">Manual Tests</div>
              <div className="text-3xl font-bold text-purple-600 mt-2">{metrics.manualTests}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <div className="text-sm font-medium text-gray-600">Automated Tests</div>
              <div className="text-3xl font-bold text-green-600 mt-2">{metrics.automatedTests}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <div className="text-sm font-medium text-gray-600">Automation Coverage</div>
              <div className="text-3xl font-bold text-orange-600 mt-2">{metrics.coverage.toFixed(1)}%</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <div className="text-sm font-medium text-gray-600">Draft Cycles</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{metrics.draftCycles}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <div className="text-sm font-medium text-gray-600">Active Cycles</div>
              <div className="text-3xl font-bold text-blue-600 mt-2">{metrics.activeCycles}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <div className="text-sm font-medium text-gray-600">Completed Cycles</div>
              <div className="text-3xl font-bold text-green-600 mt-2">{metrics.completedCycles}</div>
            </div>
          </div>

          {metrics.tags.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Tags</h3>
              <div className="flex flex-wrap gap-3">
                {metrics.tags.map((tag) => (
                  <div
                    key={tag}
                    className="inline-block bg-blue-50 border border-blue-200 rounded-lg px-6 py-3 cursor-pointer hover:bg-blue-100 transition-colors"
                  >
                    <div className="text-sm font-medium text-blue-900">{tag}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {metrics.lastSync && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm text-blue-900">
                <strong>Last Sync:</strong> {new Date(metrics.lastSync.time).toLocaleString()} ({metrics.lastSync.status})
              </div>
            </div>
          )}
        </div>
      )}

      {selectedProjectId && metricsLoading && (
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
          <span className="text-gray-600">Loading metrics...</span>
        </div>
      )}

      {/* Phase 3: Execution Metrics */}
      {selectedVersionId && executionMetrics && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Execution Metrics</h2>

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="text-sm font-medium text-gray-600">Total Tests</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{executionMetrics.totalTests}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="text-sm font-medium text-gray-600">Passed</div>
              <div className="text-3xl font-bold text-green-600 mt-2">{executionMetrics.passedTests}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="text-sm font-medium text-gray-600">Failed</div>
              <div className="text-3xl font-bold text-red-600 mt-2">{executionMetrics.failedTests}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="text-sm font-medium text-gray-600">Blocked</div>
              <div className="text-3xl font-bold text-orange-600 mt-2">{executionMetrics.blockedTests}</div>
            </div>
          </div>

          {/* Progress Bars */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Execution Progress</h3>

            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Execution Rate</span>
                  <span className="text-lg font-bold text-blue-600">{executionMetrics.executionRate.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600"
                    style={{ width: `${Math.min(executionMetrics.executionRate, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Pass Rate</span>
                  <span className="text-lg font-bold text-green-600">{executionMetrics.passRate.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600"
                    style={{ width: `${Math.min(executionMetrics.passRate, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Execution loading state */}
      {selectedVersionId && executionLoading && (
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
          <span className="text-gray-600">Loading execution metrics...</span>
        </div>
      )}

      {!selectedProjectId && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <div className="text-4xl mb-3">📊</div>
          <h3 className="text-lg font-semibold text-blue-900">Select a project to continue</h3>
          <p className="text-blue-700 mt-2">Choose a project to view repository metrics and execution cycles</p>
        </div>
      )}

      {selectedProjectId && !selectedVersionId && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center">
          <div className="text-4xl mb-3">⚙️</div>
          <h3 className="text-lg font-semibold text-amber-900">Select a Version</h3>
          <p className="text-amber-700 mt-2">Choose an execution cycle and version to view execution metrics</p>
        </div>
      )}
    </main>
  )
}
