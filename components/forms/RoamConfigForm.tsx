'use client'

import { useState, useEffect } from 'react'

interface RoamConfigFormProps {
  projectId: string
  onSuccess?: () => void
}

export function RoamConfigForm({ projectId, onSuccess }: RoamConfigFormProps) {
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [graphName, setGraphName] = useState('')
  const [localApiToken, setLocalApiToken] = useState('')

  // Load existing config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch(`/api/roam/config?projectId=${projectId}`)
        const data = await response.json()

        if (data.success && data.configured && data.config) {
          setGraphName(data.config.graphName)
          // Don't show token for security
        }
      } catch (err) {
        console.error('Failed to load config:', err)
      }
    }

    loadConfig()
  }, [projectId])

  const handleTestConnection = async () => {
    if (!graphName || !localApiToken) {
      setError('Graph Name and Local API Token are required')
      return
    }

    setTesting(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/roam/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Connection test failed')
        return
      }

      setSuccess(`✅ ${data.message}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection test failed')
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await fetch('/api/roam/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          graphName,
          localApiToken,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || data.details || 'Failed to save configuration')
        return
      }

      setSuccess('✅ Roam configuration saved successfully!')
      setLocalApiToken('') // Clear token after saving
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Roam Desktop Local API Configuration</h3>

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded border border-red-200">{error}</div>}
      {success && <div className="text-green-600 text-sm bg-green-50 p-3 rounded border border-green-200">{success}</div>}

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Graph Name <span className="text-red-600">*</span>
        </label>
        <input
          type="text"
          value={graphName}
          onChange={(e) => setGraphName(e.target.value)}
          required
          placeholder="e.g., Project_Kinergy"
          className="w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">The name of your Roam graph in Roam Desktop</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Local API Token <span className="text-red-600">*</span>
        </label>
        <input
          type="password"
          value={localApiToken}
          onChange={(e) => setLocalApiToken(e.target.value)}
          placeholder="roam-graph-local-token-..."
          className="w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">🔐 Stored securely (encrypted with AES-256-GCM). Must start with: roam-graph-local-token-</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={testing || !graphName || !localApiToken}
          className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
        >
          {testing ? '⏳ Testing...' : '🧪 Test Connection'}
        </button>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
        >
          {loading ? '⏳ Saving...' : '💾 Save Configuration'}
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded p-4 space-y-2">
        <p className="text-xs font-semibold text-blue-900">📚 How to get your API Token:</p>
        <ol className="text-xs text-blue-800 list-decimal list-inside space-y-1">
          <li>Open Roam Desktop</li>
          <li>Go to Settings → API or Settings → Integrations</li>
          <li>Find or create a Local API token</li>
          <li>Copy and paste it above</li>
        </ol>
      </div>
    </form>
  )
}
