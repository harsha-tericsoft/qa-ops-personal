'use client'

import { useEffect, useState } from 'react'

interface SyncStatusWidgetProps {
  projectId: string
  refreshTrigger?: number
}

export function SyncStatusWidget({ projectId, refreshTrigger }: SyncStatusWidgetProps) {
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<{
    lastSyncAt: string | null
    lastSyncStatus: string | null
    lastSyncError: string | null
  } | null>(null)

  useEffect(() => {
    const loadStatus = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/roam/config?projectId=${projectId}`)
        const data = await response.json()

        if (data.success && data.configured && data.config) {
          setSyncStatus({
            lastSyncAt: data.config.lastSyncAt,
            lastSyncStatus: data.config.lastSyncStatus,
            lastSyncError: data.config.lastSyncError,
          })
        }
      } catch (err) {
        console.error('Failed to load sync status:', err)
      } finally {
        setLoading(false)
      }
    }

    loadStatus()
  }, [projectId, refreshTrigger])

  if (loading) {
    return (
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <p className="text-gray-600 text-sm">Loading sync status...</p>
      </div>
    )
  }

  if (!syncStatus) {
    return (
      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
        <p className="text-yellow-800 text-sm">⚠️ No sync data available</p>
      </div>
    )
  }

  const lastSyncDate = syncStatus.lastSyncAt ? new Date(syncStatus.lastSyncAt) : null
  const lastSyncText = lastSyncDate ? lastSyncDate.toLocaleString() : 'Never'

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-900">Sync Status</h4>
        {syncStatus.lastSyncStatus === 'SUCCESS' ? (
          <span className="inline-flex items-center gap-1 text-green-700 text-sm bg-green-100 px-2 py-1 rounded">
            ✅ Success
          </span>
        ) : syncStatus.lastSyncStatus === 'FAILED' ? (
          <span className="inline-flex items-center gap-1 text-red-700 text-sm bg-red-100 px-2 py-1 rounded">
            ❌ Failed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-gray-700 text-sm bg-gray-100 px-2 py-1 rounded">
            ⏳ Not synced
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-600">Last Sync</p>
          <p className="text-gray-900 font-medium">{lastSyncText}</p>
        </div>
        <div>
          <p className="text-gray-600">Status</p>
          <p className="text-gray-900 font-medium">
            {syncStatus.lastSyncStatus || 'Not synced'}
          </p>
        </div>
      </div>

      {syncStatus.lastSyncError && (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <p className="text-red-700 text-xs font-medium">Error</p>
          <p className="text-red-600 text-xs mt-1">{syncStatus.lastSyncError}</p>
        </div>
      )}
    </div>
  )
}
