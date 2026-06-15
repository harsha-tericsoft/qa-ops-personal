'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAuth } from '@/lib/hooks/useAuth'
import { RoamConfigForm } from '@/components/forms/RoamConfigForm'
import { SyncStatusWidget } from '@/components/roam/SyncStatusWidget'
import { RepositorySyncButton } from '@/components/roam/RepositorySyncButton'
import { RepositoryVisualization } from '@/components/repository/RepositoryVisualization'
import { ProjectDeleteDialog } from '@/components/projects/ProjectDeleteDialog'

interface Project {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}

function ProjectDetailsContent() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [syncRefresh, setSyncRefresh] = useState(0)

  useEffect(() => {
    if (projectId) {
      fetchProject()
    }
  }, [projectId])

  const fetchProject = async () => {
    if (!projectId) {
      setError('Project ID not available')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}`)

      if (response.status === 404) {
        setError('Project not found')
        return
      }

      if (!response.ok) {
        let errorMessage = 'Failed to fetch project'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = `Server error (${response.status}): ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      setProject(data)
    } catch (err) {
      console.error('Error fetching project:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setShowDeleteDialog(false)
    router.push('/projects')
  }

  if (!user || user.role !== 'LEAD') {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600">Access denied. Only Lead users can manage projects.</p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto text-center py-12">
          <p className="text-gray-500">Loading project...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => router.push('/projects')}
              className="mt-4 text-blue-600 hover:underline"
            >
              Back to Projects
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!project) {
    return null
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              onClick={() => router.push('/projects')}
              className="text-blue-600 hover:underline text-sm mb-2"
            >
              ← Back to Projects
            </button>
            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
            {project.description && (
              <p className="text-gray-600 mt-2">{project.description}</p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/projects/${projectId}/edit`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Edit
            </button>
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Roam Configuration & Sync - Phase 1A */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Roam Integration</h2>
          <p className="text-gray-600 mb-6">Connect to Roam Desktop and synchronize your test repository</p>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Configuration */}
            <div className="md:col-span-2">
              <RoamConfigForm
                projectId={projectId}
                onSuccess={() => setSyncRefresh(r => r + 1)}
              />
            </div>

            {/* Sync Status */}
            <div>
              <SyncStatusWidget
                projectId={projectId}
                refreshTrigger={syncRefresh}
              />
            </div>
          </div>
        </div>

        {/* Repository Sync */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Repository Synchronization</h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Initial Sync */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Initial Sync</h3>
              <p className="text-gray-600 text-sm mb-4">
                Import all test cases from Roam for the first time. Creates the repository structure.
              </p>
              <RepositorySyncButton
                projectId={projectId}
                syncType="initial"
                onSyncComplete={() => setSyncRefresh(r => r + 1)}
              />
            </div>

            {/* Refresh Sync */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Refresh Sync</h3>
              <p className="text-gray-600 text-sm mb-4">
                Update the repository with any new or changed test cases from Roam.
              </p>
              <RepositorySyncButton
                projectId={projectId}
                syncType="refresh"
                onSyncComplete={() => setSyncRefresh(r => r + 1)}
              />
            </div>
          </div>
        </div>

        {/* Repository Visualization */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Repository Structure</h2>
          <RepositoryVisualization
            projectId={projectId}
            refreshTrigger={syncRefresh}
          />
        </div>

        {/* Project Info */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
          <h3 className="font-bold text-gray-900 mb-4">Project Information</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Project ID</p>
              <p className="font-mono text-sm text-gray-900 break-all">{project.id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Created</p>
              <p className="text-gray-900">
                {new Date(project.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Last Updated</p>
              <p className="text-gray-900">
                {new Date(project.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Dialog */}
      {showDeleteDialog && (
        <ProjectDeleteDialog
          projectId={projectId}
          projectName={project.name}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

export default function ProjectDetailsPage() {
  return (
    <ProtectedRoute>
      <ProjectDetailsContent />
    </ProtectedRoute>
  )
}
