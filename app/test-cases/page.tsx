'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useState, useEffect } from 'react'

interface TestCase {
  id: string
  title: string
  status: string
  sourceRoamUid: string
}

interface Project {
  id: string
  name: string
}

function TestCasesContent() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProjectId, setCurrentProjectId] = useState('default-project')
  const [testCases, setTestCases] = useState<TestCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchProjects()
  }, [])

  useEffect(() => {
    if (currentProjectId !== 'default-project') {
      fetchTestCases(currentProjectId)
    }
  }, [currentProjectId])

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
    } catch {
      setProjects([])
    }
  }

  const fetchTestCases = async (projectId: string) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/test-cases?projectId=${projectId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch test cases')
      }
      const data = await response.json()
      setTestCases(Array.isArray(data) ? data : data.testCases || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setTestCases([])
    } finally {
      setLoading(false)
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'PASSED': return 'bg-green-100 text-green-800'
      case 'FAILED': return 'bg-red-100 text-red-800'
      case 'BLOCKED': return 'bg-yellow-100 text-yellow-800'
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Test Cases</h1>
            <p className="text-gray-600">View test cases imported from Roam Research</p>
          </div>
        </div>

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

        {error && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading test cases...</p>
          </div>
        ) : testCases.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No test cases imported yet</h2>
            <p className="text-gray-600 mb-6">Import test cases from Roam in the Roam Integration section</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Title</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Roam UID</th>
                </tr>
              </thead>
              <tbody>
                {testCases.map((test) => (
                  <tr key={test.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{test.title}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(test.status)}`}>
                        {test.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-600">{test.sourceRoamUid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-12 grid gap-6">
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
            <h3 className="font-bold text-blue-900 mb-2">📋 Test Case Management</h3>
            <ul className="text-blue-800 text-sm space-y-1">
              <li>• Test cases are created and maintained in Roam Research</li>
              <li>• Imported test cases appear here after syncing</li>
              <li>• View test details and hierarchy from the Repository</li>
              <li>• Use Test Suites to organize tests for execution</li>
              <li>• Execute tests in Execution Cycles</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TestCasesPage() {
  return (
    <ProtectedRoute>
      <TestCasesContent />
    </ProtectedRoute>
  )
}
