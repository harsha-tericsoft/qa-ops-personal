'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'

interface TestSuite {
  id: string
  projectId: string
  name: string
  description?: string
  category: string
  testCases: any[]
  createdAt: string
}

interface Project {
  id: string
  name: string
}

function TestSuitesContent() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProjectId, setCurrentProjectId] = useState('default-project')
  const [suites, setSuites] = useState<TestSuite[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newSuiteName, setNewSuiteName] = useState('')
  const [newSuiteDesc, setNewSuiteDesc] = useState('')
  const [selectedTestCases, setSelectedTestCases] = useState<string[]>([])
  const [availableTests, setAvailableTests] = useState<any[]>([])
  const [loadingTests, setLoadingTests] = useState(false)

  // Fetch projects
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

  // Fetch suites for current project
  useEffect(() => {
    if (currentProjectId && currentProjectId !== 'default-project') {
      fetchSuites()
      fetchAvailableTests()
    } else if (projects.length > 0) {
      // If projects loaded but projectId still default, use first project
      const firstProjectId = projects[0].id
      setCurrentProjectId(firstProjectId)
    }
  }, [currentProjectId, projects])

  const fetchSuites = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/test-suites?projectId=${currentProjectId}`)
      if (response.ok) {
        const data = await response.json()
        setSuites(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching suites:', error)
      setSuites([])
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableTests = async () => {
    setLoadingTests(true)
    try {
      const response = await fetch(`/api/test-cases?projectId=${currentProjectId}`)
      if (response.ok) {
        const data = await response.json()
        setAvailableTests(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching tests:', error)
      setAvailableTests([])
    } finally {
      setLoadingTests(false)
    }
  }

  const handleCreateSuite = async () => {
    if (!newSuiteName.trim()) return

    try {
      const response = await fetch(`/api/test-suites?projectId=${currentProjectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSuiteName,
          description: newSuiteDesc,
          category: 'CUSTOM',
        }),
      })

      if (response.ok) {
        const newSuite = await response.json()

        // If test cases selected, add them
        if (selectedTestCases.length > 0) {
          await fetch(`/api/test-suites/${newSuite.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              testCaseIds: selectedTestCases,
            }),
          })
        }

        // Reset and refresh
        setNewSuiteName('')
        setNewSuiteDesc('')
        setSelectedTestCases([])
        setShowCreateModal(false)
        fetchSuites()
      }
    } catch (error) {
      console.error('Error creating suite:', error)
    }
  }

  const handleDeleteSuite = async (suiteId: string) => {
    if (!confirm('Delete this suite?')) return

    try {
      const response = await fetch(`/api/test-suites/${suiteId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchSuites()
      }
    } catch (error) {
      console.error('Error deleting suite:', error)
    }
  }

  const toggleTestCase = (testId: string) => {
    setSelectedTestCases((prev) =>
      prev.includes(testId) ? prev.filter((id) => id !== testId) : [...prev, testId]
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Test Suites</h1>
            <p className="text-gray-600">Organize test cases into reusable collections</p>
          </div>
          {user?.role === 'LEAD' && projects.length > 0 && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Test Suite
            </button>
          )}
        </div>

        {/* Project Selector */}
        {user?.role === 'LEAD' && projects.length > 0 && (
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Select Project
            </label>
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

        {/* Suites List */}
        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-600">Loading test suites...</p>
          </div>
        ) : suites.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <div className="text-4xl mb-4">📦</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No test suites yet</h2>
            <p className="text-gray-600 mb-6">Create a suite to organize related tests</p>
            {user?.role === 'LEAD' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Test Suite
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {suites.map((suite) => (
              <div key={suite.id} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{suite.name}</h3>
                    {suite.description && (
                      <p className="text-sm text-gray-600 mt-1">{suite.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-3">
                      <span className="text-sm text-gray-500">
                        {suite.testCases?.length || 0} test cases
                      </span>
                      <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                        {suite.category}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteSuite(suite.id)}
                    className="text-red-600 hover:text-red-800 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-96 overflow-y-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Test Suite</h2>

              {/* Suite Details */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Suite Name
                  </label>
                  <input
                    type="text"
                    value={newSuiteName}
                    onChange={(e) => setNewSuiteName(e.target.value)}
                    placeholder="e.g., Smoke Suite"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={newSuiteDesc}
                    onChange={(e) => setNewSuiteDesc(e.target.value)}
                    placeholder="Suite description"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Test Case Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Add Test Cases ({selectedTestCases.length} selected)
                </label>
                <div className="border border-gray-300 rounded-lg p-4 max-h-40 overflow-y-auto">
                  {loadingTests ? (
                    <p className="text-gray-500">Loading test cases...</p>
                  ) : availableTests.length === 0 ? (
                    <p className="text-gray-500">No test cases available</p>
                  ) : (
                    <div className="space-y-2">
                      {availableTests.map((test) => (
                        <label key={test.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedTestCases.includes(test.id)}
                            onChange={() => toggleTestCase(test.id)}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700">{test.title}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewSuiteName('')
                    setNewSuiteDesc('')
                    setSelectedTestCases([])
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSuite}
                  disabled={!newSuiteName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                >
                  Create Suite
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 grid gap-6">
          <div className="bg-pink-50 rounded-lg border border-pink-200 p-6">
            <h3 className="font-bold text-pink-900 mb-2">📦 Suite Categories</h3>
            <div className="text-pink-800 text-sm space-y-2">
              <div><strong>Smoke:</strong> Quick sanity tests</div>
              <div><strong>Regression:</strong> Full feature coverage</div>
              <div><strong>Sprint:</strong> Current sprint tests</div>
              <div><strong>Release:</strong> Pre-release validation</div>
              <div><strong>Custom:</strong> User-defined categories</div>
            </div>
          </div>

          <div className="bg-pink-50 rounded-lg border border-pink-200 p-6">
            <h3 className="font-bold text-pink-900 mb-2">🎯 Selection Methods</h3>
            <ul className="text-pink-800 text-sm space-y-1">
              <li>• <strong>Repository Tree:</strong> Select by folder/hierarchy</li>
              <li>• <strong>Tags:</strong> Filter by tags (AND/OR logic)</li>
              <li>• <strong>Search:</strong> Full-text search across test cases</li>
              <li>• <strong>Manual:</strong> Hand-pick specific tests</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TestSuitesPage() {
  return (
    <ProtectedRoute>
      <TestSuitesContent />
    </ProtectedRoute>
  )
}
