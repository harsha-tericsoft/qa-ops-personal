'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAuth } from '@/lib/hooks/useAuth'

interface Project {
  id: string
  name: string
  description?: string
}

function EditProjectContent() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

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
      setName(data.name)
      setDescription(data.description || '')
    } catch (err) {
      console.error('Error fetching project:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSaving(true)

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      })

      if (!response.ok) {
        let errorMessage = 'Failed to update project'
        try {
          const data = await response.json()
          errorMessage = data.error || errorMessage
        } catch {
          errorMessage = `Server error (${response.status}): ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      setSuccess(true)
      setTimeout(() => {
        router.push(`/projects/${projectId}`)
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  if (!user || user.role !== 'LEAD') {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto">
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
        <div className="max-w-2xl mx-auto text-center py-12">
          <p className="text-gray-500">Loading project...</p>
        </div>
      </div>
    )
  }

  if (error && !project) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto">
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

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="text-blue-600 hover:underline text-sm mb-4"
          >
            ← Back to Project
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Edit Project</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-8">
          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-600 text-sm">✓ Project updated successfully. Redirecting...</p>
            </div>
          )}

          {/* Project Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Project Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g., Kinergy, Patient Portal, Mobile App"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose of this project..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/projects/${projectId}`)}
              disabled={saving}
              className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function EditProjectPage() {
  return (
    <ProtectedRoute>
      <EditProjectContent />
    </ProtectedRoute>
  )
}
