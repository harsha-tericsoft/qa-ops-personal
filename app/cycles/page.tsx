'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'

interface Project {
  id: string
  name: string
}

interface TestSuite {
  id: string
  name: string
  testCases: any[]
}

interface TestRun {
  id: string
  testCaseId: string
  testCase: { id: string; name: string }
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_EXECUTED'
  executedAt?: string
}

interface ExecutionCycle {
  id: string
  name: string
  description?: string
  status: string
  sourceSuiteId?: string
  sourceSuite?: TestSuite
  testRuns: TestRun[]
  metrics?: {
    total: number
    pass: number
    fail: number
    blocked: number
    notExecuted: number
  }
}

function ExecutionCyclesContent() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProjectId, setCurrentProjectId] = useState('default-project')
  const [cycles, setCycles] = useState<ExecutionCycle[]>([])
  const [suites, setSuites] = useState<TestSuite[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null)
  const [newCycleName, setNewCycleName] = useState('')
  const [newCycleDesc, setNewCycleDesc] = useState('')
  const [selectedSuiteId, setSelectedSuiteId] = useState('')

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch('/api/projects')
        if (response.ok) {
          const data = await response.json()
          setProjects(data)
          if (data.length > 0) {
            setCurrentProjectId(data[0].id)
          }
        }
      } catch (error) {
        console.error('Error fetching projects:', error)
      }
    }
    fetchProjects()
  }, [])

  useEffect(() => {
    if (currentProjectId && currentProjectId !== 'default-project') {
      fetchCycles()
      fetchSuites()
    }
  }, [currentProjectId])

  const fetchCycles = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/execution-cycles?projectId=${currentProjectId}`)
      if (response.ok) {
        const data = await response.json()
        setCycles(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching cycles:', error)
      setCycles([])
    } finally {
      setLoading(false)
    }
  }

  const fetchSuites = async () => {
    try {
      const response = await fetch(`/api/test-suites?projectId=${currentProjectId}`)
      if (response.ok) {
        const data = await response.json()
        setSuites(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching suites:', error)
      setSuites([])
    }
  }

  const handleCreateCycle = async () => {
    if (!newCycleName.trim() || !selectedSuiteId) return

    const selectedSuite = suites.find((s) => s.id === selectedSuiteId)
    if (!selectedSuite) return

    try {
      const response = await fetch(`/api/execution-cycles?projectId=${currentProjectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCycleName,
          description: newCycleDesc,
          testCaseIds: selectedSuite.testCases.map((tc) => tc.testCaseId || tc.id),
        }),
      })

      if (response.ok) {
        const newCycle = await response.json()
        setNewCycleName('')
        setNewCycleDesc('')
        setSelectedSuiteId('')
        setShowCreateModal(false)
        await fetchCycles()
        setSelectedCycleId(newCycle.id)
      }
    } catch (error) {
      console.error('Error creating cycle:', error)
    }
  }

  const handleRunStatusChange = async (runId: string, status: string) => {
    try {
      const response = await fetch(`/api/test-runs/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (response.ok) {
        await fetchCycles()
      }
    } catch (error) {
      console.error('Error updating run status:', error)
    }
  }

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId)

  if (selectedCycle) {
    const passCount = selectedCycle.testRuns.filter((r) => r.status === 'PASS').length
    const failCount = selectedCycle.testRuns.filter((r) => r.status === 'FAIL').length
    const blockedCount = selectedCycle.testRuns.filter((r) => r.status === 'BLOCKED').length
    const notExecutedCount = selectedCycle.testRuns.filter((r) => r.status === 'NOT_EXECUTED').length

    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => setSelectedCycleId(null)}
            className="text-blue-600 hover:text-blue-800 mb-6"
          >
            ← Back to Cycles
          </button>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">{selectedCycle.name}</h1>
          {selectedCycle.description && <p className="text-gray-600 mb-6">{selectedCycle.description}</p>}

          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{passCount}</div>
              <div className="text-sm text-green-700">Passed</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600">{failCount}</div>
              <div className="text-sm text-red-700">Failed</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-600">{blockedCount}</div>
              <div className="text-sm text-yellow-700">Blocked</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-600">{notExecutedCount}</div>
              <div className="text-sm text-gray-700">Not Executed</div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-6 font-semibold">Test Case</th>
                  <th className="text-left py-3 px-6 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {selectedCycle.testRuns.map((run) => (
                  <tr key={run.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-6">{run.testCase?.title || 'Unknown'}</td>
                    <td className="py-4 px-6">
                      <select
                        value={run.status}
                        onChange={(e) => handleRunStatusChange(run.id, e.target.value)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium border ${
                          run.status === 'PASS'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : run.status === 'FAIL'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : run.status === 'BLOCKED'
                                ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                      >
                        <option value="NOT_EXECUTED">Not Executed</option>
                        <option value="PASS">Pass</option>
                        <option value="FAIL">Fail</option>
                        <option value="BLOCKED">Blocked</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Execution Cycles</h1>
            <p className="text-gray-600">Track and manage test execution runs</p>
          </div>
          {user?.role === 'LEAD' && projects.length > 0 && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Execution Cycle
            </button>
          )}
        </div>

        {user?.role === 'LEAD' && projects.length > 0 && (
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-900 mb-2">Select Project</label>
            <select
              value={currentProjectId}
              onChange={(e) => setCurrentProjectId(e.target.value)}
              className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="default-project">Choose a project...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-600">Loading execution cycles...</p>
          </div>
        ) : cycles.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <div className="text-4xl mb-4">🔄</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No cycles yet</h2>
            <p className="text-gray-600 mb-6">Create an execution cycle to start testing</p>
            {user?.role === 'LEAD' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Execution Cycle
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {cycles.map((cycle) => (
              <button
                key={cycle.id}
                onClick={() => setSelectedCycleId(cycle.id)}
                className="bg-white rounded-lg border border-gray-200 p-6 text-left hover:border-blue-400 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{cycle.name}</h3>
                    {cycle.description && <p className="text-sm text-gray-600 mt-1">{cycle.description}</p>}
                    <div className="flex gap-4 mt-3">
                      <span className="text-sm text-gray-500">
                        {(cycle.testRuns ?? []).length} total tests
                      </span>
                      <span className="text-sm text-green-600">
                        {(cycle.testRuns ?? []).filter((r) => r.status === 'PASS').length} pass
                      </span>
                      <span className="text-sm text-red-600">
                        {(cycle.testRuns ?? []).filter((r) => r.status === 'FAIL').length} fail
                      </span>
                      <span className="text-sm text-yellow-600">
                        {(cycle.testRuns ?? []).filter((r) => r.status === 'BLOCKED').length} blocked
                      </span>
                    </div>
                  </div>
                  <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                    {cycle.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Execution Cycle</h2>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Cycle Name</label>
                  <input
                    type="text"
                    value={newCycleName}
                    onChange={(e) => setNewCycleName(e.target.value)}
                    placeholder="e.g., Smoke Test Run"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={newCycleDesc}
                    onChange={(e) => setNewCycleDesc(e.target.value)}
                    placeholder="Cycle description"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Test Suite</label>
                  <select
                    value={selectedSuiteId}
                    onChange={(e) => setSelectedSuiteId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a suite...</option>
                    {suites.map((suite) => (
                      <option key={suite.id} value={suite.id}>
                        {suite.name} ({suite.testCases?.length || 0} tests)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewCycleName('')
                    setNewCycleDesc('')
                    setSelectedSuiteId('')
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCycle}
                  disabled={!newCycleName.trim() || !selectedSuiteId}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Create Cycle
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ExecutionCyclesPage() {
  return (
    <ProtectedRoute>
      <ExecutionCyclesContent />
    </ProtectedRoute>
  )
}
