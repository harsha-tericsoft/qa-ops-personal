'use client'

import { useState } from 'react'

interface RepositorySyncButtonProps {
  projectId: string
  syncType: 'initial' | 'refresh'
  onSyncComplete?: () => void
  label?: string
}

export function RepositorySyncButton({
  projectId,
  syncType,
  onSyncComplete,
  label,
}: RepositorySyncButtonProps) {
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{
    nodesAdded: number
    nodesUpdated: number
    message: string
  } | null>(null)

  const handleSync = async () => {
    setSyncing(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/roam/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          syncType,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Sync failed')
        return
      }

      setResult({
        nodesAdded: data.nodesAdded || 0,
        nodesUpdated: data.nodesUpdated || 0,
        message: data.message,
      })

      onSyncComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const buttonLabel = label || (syncType === 'initial' ? 'Initial Sync' : 'Refresh Sync')
  const buttonColor = syncType === 'initial' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'

  return (
    <div className="space-y-3">
      <button
        onClick={handleSync}
        disabled={syncing}
        className={`w-full ${buttonColor} text-white px-6 py-3 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium`}
      >
        {syncing ? (
          <>
            <span className="inline-block animate-spin mr-2">⏳</span>
            {syncType === 'initial' ? 'Importing...' : 'Refreshing...'}
          </>
        ) : (
          <>
            {syncType === 'initial' ? '📥' : '🔄'} {buttonLabel}
          </>
        )}
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 font-medium text-sm">❌ Error</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
          <p className="text-green-700 font-medium text-sm">✅ {result.message}</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {result.nodesAdded > 0 && (
              <div className="text-green-700">
                <span className="font-semibold">Added:</span> {result.nodesAdded}
              </div>
            )}
            {result.nodesUpdated > 0 && (
              <div className="text-green-700">
                <span className="font-semibold">Updated:</span> {result.nodesUpdated}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
