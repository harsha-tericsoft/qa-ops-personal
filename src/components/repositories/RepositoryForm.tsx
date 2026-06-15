'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RepositoryType, RepositoryPurpose } from '@prisma/client'

interface RepositoryFormProps {
  projectId: string
  onSuccess?: () => void
}

export function RepositoryForm({ projectId, onSuccess }: RepositoryFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    repositoryName: '',
    repositoryUrl: '',
    repositoryType: 'github' as RepositoryType,
    repositoryPurpose: 'general' as RepositoryPurpose,
    branch: 'main',
    description: '',
    tags: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/codeRepositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          projectId,
          tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
        }),
      })

      if (response.status === 409) {
        setError('Repository with this URL already exists in this project')
        return
      }

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || `HTTP ${response.status}`)
      }

      if (onSuccess) onSuccess()
      router.back()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      {error && <div className="p-3 bg-red-100 text-red-800 rounded">{error}</div>}

      <div>
        <label className="block text-sm font-medium mb-1">Repository Name *</label>
        <input
          type="text"
          required
          value={formData.repositoryName}
          onChange={e => setFormData({ ...formData, repositoryName: e.target.value })}
          className="w-full px-3 py-2 border rounded"
          placeholder="my-awesome-repo"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Repository URL *</label>
        <input
          type="url"
          required
          value={formData.repositoryUrl}
          onChange={e => setFormData({ ...formData, repositoryUrl: e.target.value })}
          className="w-full px-3 py-2 border rounded"
          placeholder="https://github.com/owner/repo"
        />
        <p className="text-xs text-gray-500 mt-1">GitHub HTTPS URLs only</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Repository Type *</label>
        <select
          value={formData.repositoryType}
          onChange={e => setFormData({ ...formData, repositoryType: e.target.value as RepositoryType })}
          className="w-full px-3 py-2 border rounded"
        >
          <option value="github">GitHub</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Purpose</label>
        <select
          value={formData.repositoryPurpose}
          onChange={e => setFormData({ ...formData, repositoryPurpose: e.target.value as RepositoryPurpose })}
          className="w-full px-3 py-2 border rounded"
        >
          <option value="general">General</option>
          <option value="testing">Testing</option>
          <option value="staging">Staging</option>
          <option value="production">Production</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Branch</label>
        <input
          type="text"
          value={formData.branch}
          onChange={e => setFormData({ ...formData, branch: e.target.value })}
          className="w-full px-3 py-2 border rounded"
          placeholder="main"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={formData.description}
          onChange={e => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border rounded"
          placeholder="What is this repository for?"
          rows={3}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Tags</label>
        <input
          type="text"
          value={formData.tags}
          onChange={e => setFormData({ ...formData, tags: e.target.value })}
          className="w-full px-3 py-2 border rounded"
          placeholder="tag1, tag2, tag3"
        />
        <p className="text-xs text-gray-500 mt-1">Comma-separated</p>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Creating...' : 'Create Repository'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
