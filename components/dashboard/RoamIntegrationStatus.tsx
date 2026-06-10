'use client'

import Link from 'next/link'

interface RoamIntegrationStatusProps {
  isConfigured: boolean
  lastSyncAt: Date | null
  lastSyncStatus: string
  repositoryTests: number
}

function formatLastSync(date: Date | null, status: string): string {
  if (status === 'NEVER' || !date) {
    return 'Never'
  }
  if (!date) return 'Never'

  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

function getStatusBadge(isConfigured: boolean, status: string) {
  if (!isConfigured) {
    return (
      <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
        Not Configured
      </span>
    )
  }

  const statusMap: Record<string, { bg: string; text: string; label: string }> = {
    SUCCESS: { bg: 'bg-green-100', text: 'text-green-800', label: 'Connected' },
    FAILED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Failed' },
    IN_PROGRESS: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Syncing' },
    NEVER: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Never Synced' },
  }

  const config = statusMap[status] || statusMap.NEVER

  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}

export function RoamIntegrationStatus({
  isConfigured,
  lastSyncAt,
  lastSyncStatus,
  repositoryTests,
}: RoamIntegrationStatusProps) {
  return (
    <div className="bg-cyan-50 rounded-lg border border-cyan-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">🔗 Roam Integration</h2>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700">Status:</span>
          {getStatusBadge(isConfigured, lastSyncStatus)}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700">Last Sync:</span>
          <span className="text-sm font-medium text-gray-900">
            {formatLastSync(lastSyncAt, lastSyncStatus)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700">Repository Tests:</span>
          <span className="text-sm font-medium text-gray-900">{repositoryTests}</span>
        </div>
      </div>

      {!isConfigured && (
        <Link
          href="/roam"
          className="mt-4 block w-full bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700 transition-colors text-center font-medium text-sm"
        >
          Configure Integration
        </Link>
      )}
    </div>
  )
}
