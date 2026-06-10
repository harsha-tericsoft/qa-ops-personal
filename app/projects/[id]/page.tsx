'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAuth } from '@/lib/hooks/useAuth'
import { RoamImportFileForm } from '@/components/forms/RoamImportFileForm'
import { RoamLiveSyncForm } from '@/components/forms/RoamLiveSyncForm'
import { RepositoryMetrics } from '@/components/repository/RepositoryMetrics'
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

        {/* Repository Metrics */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Repository Status</h2>
          <RepositoryMetrics projectId={projectId} />
        </div>

        {/* Roam Integration */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Roam Integration</h2>
          <p className="text-gray-600 mb-8">
            Import test cases from Roam Research. Choose one method below.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Method 1: Import File */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Method 1: Import File</h3>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-green-800">No API key required. Upload a Roam export file.</p>
              </div>
              <RoamImportFileForm projectId={projectId} onSuccess={fetchProject} />
            </div>

            {/* Method 2: Live Sync */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Method 2: Live Sync</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">API key required. Sync automatically with Roam.</p>
              </div>
              <RoamLiveSyncForm projectId={projectId} onSuccess={fetchProject} />
            </div>
          </div>

          {/* Info Boxes */}
          <div className="grid md:grid-cols-2 gap-8 mt-8">
            <div className="bg-cyan-50 rounded-lg border border-cyan-200 p-6">
              <h4 className="font-bold text-cyan-900 mb-2">📤 What Gets Imported</h4>
              <ul className="text-cyan-800 text-sm space-y-1">
                <li>✓ Test case hierarchy and structure</li>
                <li>✓ Test titles and descriptions</li>
                <li>✓ Folder organization and nesting</li>
                <li>✓ Tags from page properties</li>
                <li>✓ Never deletes existing data</li>
              </ul>
            </div>

            <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
              <h4 className="font-bold text-blue-900 mb-2">🔐 Security</h4>
              <ul className="text-blue-800 text-sm space-y-1">
                <li>✓ AES-256-GCM encryption at rest</li>
                <li>✓ HTTPS only connections</li>
                <li>✓ No data retained from Roam</li>
                <li>✓ Audit logging of all syncs</li>
              </ul>
            </div>
          </div>
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
