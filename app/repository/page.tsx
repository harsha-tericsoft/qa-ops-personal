'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { RepositoryTree } from '@/components/repository/RepositoryTree'
import { RepositoryMetrics } from '@/components/repository/RepositoryMetrics'

interface Project {
  id: string
  name: string
}

function RepositoryContent() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProjectId, setCurrentProjectId] = useState('default-project')
  const [loadingProjects, setLoadingProjects] = useState(true)

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
      setLoadingProjects(false)
    }
  }

  const handleProjectChange = (projectId: string) => {
    setCurrentProjectId(projectId)
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Repository</h1>
            <p className="text-white">View test cases imported from Roam Research</p>
          </div>
        </div>

        {/* Project Selector - for LEAD role */}
        {user?.role === 'LEAD' && projects.length > 0 && (
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Select Project
            </label>
            <select
              value={currentProjectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Metrics */}
        <RepositoryMetrics projectId={currentProjectId} />

        {/* Tree View */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Test Hierarchy</h2>
          <RepositoryTree projectId={currentProjectId} />
        </div>

        {/* Help Section */}
        <div className="mt-12 grid gap-6">
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
            <h3 className="font-bold text-blue-900 mb-2">📋 About the Repository</h3>
            <ul className="text-blue-800 text-sm space-y-1">
              <li>• View test cases organized in a hierarchy (as imported from Roam)</li>
              <li>• Test cases are read-only (managed in Roam Research)</li>
              <li>• Explore the full test structure by expanding folders</li>
              <li>• Use the Test Cases module for advanced filtering and suite creation</li>
            </ul>
          </div>

          <div className="bg-cyan-50 rounded-lg border border-cyan-200 p-6">
            <h3 className="font-bold text-cyan-900 mb-2">🔄 To Import Test Cases</h3>
            <ol className="text-cyan-800 text-sm space-y-2">
              <li>1. Go to <span className="font-semibold">Roam Integration</span></li>
              <li>2. Choose <span className="font-semibold">Import File</span> (no API key needed) or <span className="font-semibold">Live Sync</span> (with API key)</li>
              <li>3. Complete the import process</li>
              <li>4. Return here to view your test hierarchy</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RepositoryPage() {
  return (
    <ProtectedRoute>
      <RepositoryContent />
    </ProtectedRoute>
  )
}
