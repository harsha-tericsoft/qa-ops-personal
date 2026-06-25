'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Project {
  id: string
  name: string
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

interface DashboardMetrics {
  totalTests: number
  passedTests: number
  failedTests: number
  blockedTests: number
  skippedTests: number
  notExecutedTests: number
  executionRate: number
  passRate: number
}

export default function DashboardPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [cycles, setCycles] = useState<ExecutionCycle[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState('')
  const [versions, setVersions] = useState<ExecutionVersion[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/projects')
        if (res.status === 401) {
          router.push('/login')
          return
        }
        setIsAuthenticated(true)
      } catch (err) {
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    checkAuth()
  }, [router])

  // Load projects
  useEffect(() => {
    if (!isAuthenticated) return

    const loadProjects = async () => {
      try {
        const res = await fetch('/api/projects')
        if (res.ok) {
          const data = await res.json()
          setProjects(data)
          if (data.length > 0 && !selectedProjectId) {
            setSelectedProjectId(data[0].id)
          }
        }
      } catch (err) {
        console.error('Failed to load projects:', err)
      }
    }
    loadProjects()
  }, [isAuthenticated, selectedProjectId])

  // Load cycles when project changes
  useEffect(() => {
    if (!selectedProjectId) return

    const loadCycles = async () => {
      try {
        const res = await fetch(`/api/execution-cycles?projectId=${selectedProjectId}`)
        if (res.ok) {
          const data = await res.json()
          setCycles(data)
          setSelectedCycleId('') // Reset cycle selection
          setSelectedVersionId('') // Reset version selection
        }
      } catch (err) {
        console.error('Failed to load cycles:', err)
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
          setVersions(data)
          setSelectedVersionId('') // Reset version selection
        }
      } catch (err) {
        console.error('Failed to load versions:', err)
      }
    }
    loadVersions()
  }, [selectedCycleId])

  // Load metrics when both cycle and version are selected
  useEffect(() => {
    if (!selectedCycleId || !selectedVersionId) {
      setMetrics(null)
      return
    }

    const loadMetrics = async () => {
      setMetricsLoading(true)
      try {
        const res = await fetch(
          `/api/dashboard/execution-metrics?projectId=${selectedProjectId}&cycleId=${selectedCycleId}&versionId=${selectedVersionId}`
        )
        if (res.ok) {
          const data = await res.json()
          setMetrics(data)
        }
      } catch (err) {
        console.error('Failed to load metrics:', err)
      } finally {
        setMetricsLoading(false)
      }
    }
    loadMetrics()
  }, [selectedCycleId, selectedVersionId, selectedProjectId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  const executionRate = metrics ? metrics.executionRate : 0
  const passRate = metrics ? metrics.passRate : 0

  return (
    <main className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900">Execution Dashboard</h1>
        <p className="text-gray-600 mt-2">Enterprise QA Metrics & Analytics</p>
      </div>

      {/* Selection Controls */}
      <div className="grid grid-cols-3 gap-4 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        {/* Project Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select Project...</option>
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
            <option value="">Select Cycle...</option>
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
            <option value="">Select Version...</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.buildVersion} (v{v.versionNumber})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Empty State */}
      {!metrics && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <div className="text-4xl mb-3">📊</div>
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Select Project, Cycle & Version</h3>
          <p className="text-blue-700">Choose a project, execution cycle, and version to view execution metrics.</p>
        </div>
      )}

      {/* Execution Metrics */}
      {metrics && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="text-sm font-medium text-gray-600">Total Tests</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{metrics.totalTests}</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="text-sm font-medium text-gray-600">Passed</div>
              <div className="text-3xl font-bold text-green-600 mt-2">{metrics.passedTests}</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="text-sm font-medium text-gray-600">Failed</div>
              <div className="text-3xl font-bold text-red-600 mt-2">{metrics.failedTests}</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="text-sm font-medium text-gray-600">Blocked</div>
              <div className="text-3xl font-bold text-orange-600 mt-2">{metrics.blockedTests}</div>
            </div>
          </div>

          {/* Execution Progress */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Execution Progress</h3>

            <div className="grid grid-cols-2 gap-8">
              {/* Execution Rate */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Execution Rate</span>
                  <span className="text-lg font-bold text-blue-600">{executionRate.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${Math.min(executionRate, 100)}%` }}
                  />
                </div>
              </div>

              {/* Pass Rate */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Pass Rate</span>
                  <span className="text-lg font-bold text-green-600">{passRate.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600 transition-all duration-300"
                    style={{ width: `${Math.min(passRate, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
