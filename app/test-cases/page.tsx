'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { HierarchicalTestCaseTree } from '@/components/test-cases/HierarchicalTestCaseTree'
import { useState, useEffect } from 'react'

interface Project {
  id: string
  name: string
}

function TestCasesContent() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProjectId, setCurrentProjectId] = useState('default-project')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchProjects()
  }, [])

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
    } finally {
      setLoading(false)
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

        {currentProjectId !== 'default-project' && (
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <input
                type="text"
                placeholder="Search test cases..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Clear
                </button>
              )}
            </div>
            <HierarchicalTestCaseTree projectId={currentProjectId} search={search} />
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
