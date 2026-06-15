'use client'

import { useState, useEffect } from 'react'

interface Credential {
  id: string
  credentialType: string
  isActive: boolean
  createdAt: string
}

interface CredentialManagerProps {
  repositoryId: string
}

export function CredentialManager({ repositoryId }: CredentialManagerProps) {
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [token, setToken] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchCredentials()
  }, [repositoryId])

  async function fetchCredentials() {
    try {
      setLoading(true)
      const response = await fetch(`/api/codeRepositories/${repositoryId}/credentials`)
      if (!response.ok) throw new Error('Failed to fetch credentials')
      const data = await response.json()
      setCredentials(data.credentials || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      setSubmitting(true)
      const response = await fetch(`/api/codeRepositories/${repositoryId}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubToken: token }),
      })

      if (!response.ok) throw new Error('Failed to store credential')
      setToken('')
      setShowForm(false)
      await fetchCredentials()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="p-4">Loading credentials...</div>

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-red-100 text-red-800 rounded text-sm">{error}</div>}

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Add GitHub Token
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-gray-50 rounded">
          <div>
            <label className="block text-sm font-medium mb-1">GitHub Personal Access Token</label>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded"
              placeholder="ghp_..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Token will be encrypted and not shown again. Needs: repo, read:user scopes.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 text-sm"
            >
              {submitting ? 'Storing...' : 'Store Token'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {credentials.length === 0 ? (
        <p className="text-gray-500 text-sm">No credentials stored</p>
      ) : (
        <div className="space-y-2">
          {credentials.map(cred => (
            <div key={cred.id} className="p-3 border rounded flex justify-between items-center">
              <div>
                <p className="font-medium text-sm">{cred.credentialType}</p>
                <p className="text-xs text-gray-500">Added: {new Date(cred.createdAt).toLocaleDateString()}</p>
              </div>
              <span className={`px-2 py-1 text-xs rounded ${cred.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {cred.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
