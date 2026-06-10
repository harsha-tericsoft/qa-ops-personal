'use client'

import { useState } from 'react'

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
  const [graphUrl, setGraphUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [syncDirection, setSyncDirection] = useState('IMPORT_ONLY')

  const handleTestConnection = async () => {
    if (!graphName || !apiKey) {
      setError('Graph name and API key are required')
      return
    }

    setTesting(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(
        `/api/roam/test-connection?projectId=${projectId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            graphName,
            graphUrl,
            apiKey,
          }),
        }
      )

      if (!response.ok) {
        let errorMessage = 'Connection failed'
        try {
          const data = await response.json()
          errorMessage = data.error || errorMessage
        } catch {
          errorMessage = `Server error (${response.status}): ${response.statusText}`
        }
        setError(errorMessage)
        return
      }

      const data = await response.json()
      setSuccess(`✅ Connection successful! Found ${data.pagesCount} pages`)
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
      const response = await fetch(
        `/api/roam/config?projectId=${projectId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            graphName,
            graphUrl,
            apiKey,
            syncDirection,
            syncEnabled: true,
          }),
        }
      )

      if (!response.ok) {
        let errorMessage = 'Failed to save configuration'
        try {
          const data = await response.json()
          errorMessage = data.error || errorMessage
        } catch {
          errorMessage = `Server error (${response.status}): ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      setSuccess('✅ Roam configuration saved!')
      setGraphName('')
      setGraphUrl('')
      setApiKey('')
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg border border-gray-200">
      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{error}</div>}
      {success && <div className="text-green-600 text-sm bg-green-50 p-3 rounded">{success}</div>}

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Roam Graph Name *
        </label>
        <input
          type="text"
          value={graphName}
          onChange={(e) => setGraphName(e.target.value)}
          required
          placeholder="e.g., my-qa-graph"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">Your Roam graph name (from URL)</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Roam Graph URL
        </label>
        <input
          type="url"
          value={graphUrl}
          onChange={(e) => setGraphUrl(e.target.value)}
          placeholder="https://roamresearch.com/#/app/your-graph"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Roam API Key *
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          required
          placeholder="Your Roam API key (encrypted)"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">🔐 Encrypted with AES-256-GCM</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Sync Direction
        </label>
        <select
          value={syncDirection}
          onChange={(e) => setSyncDirection(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="IMPORT_ONLY">Import Only (Roam → QA Ops)</option>
          <option value="EXPORT_ONLY">Export Only (QA Ops → Roam)</option>
          <option value="BIDIRECTIONAL">Bidirectional (both ways)</option>
        </select>
      </div>

      <button
        type="button"
        onClick={handleTestConnection}
        disabled={testing || !graphName || !apiKey}
        className="w-full bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition-colors font-medium"
      >
        {testing ? 'Testing...' : 'Test Connection'}
      </button>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
      >
        {loading ? 'Saving...' : 'Save Configuration'}
      </button>

      <div className="bg-cyan-50 border border-cyan-200 rounded p-4">
        <p className="text-xs text-cyan-900">
          <strong>How to get your API key:</strong><br/>
          1. Visit your Roam account settings<br/>
          2. Go to "Integrations" → "API"<br/>
          3. Create a new API key and copy it here
        </p>
      </div>
    </form>
  )
}
