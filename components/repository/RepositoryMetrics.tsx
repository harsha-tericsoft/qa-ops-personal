'use client'

import { useState, useEffect } from 'react'

interface RepositoryMetricsProps {
  projectId: string
}

export function RepositoryMetrics({ projectId }: RepositoryMetricsProps) {
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMetrics()
  }, [projectId])

  const fetchMetrics = async () => {
    try {
      const response = await fetch(
        `/api/repository/metrics?projectId=${projectId}`
      )
      if (response.ok) {
        const data = await response.json()
        setMetrics(data)
      }
    } catch {
      setMetrics(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 border border-gray-200 text-center">
        <p className="text-gray-500 text-sm">Loading metrics...</p>
      </div>
    )
  }

  if (!metrics) {
    return null
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Total Test Cases */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600 text-sm font-medium">Total Tests</p>
            <p className="text-3xl font-bold text-gray-900">
              {metrics.totalTestCases}
            </p>
          </div>
          <span className="text-4xl">✅</span>
        </div>
      </div>

      {/* Total Tags */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600 text-sm font-medium">Tags</p>
            <p className="text-3xl font-bold text-gray-900">
              {metrics.totalTags}
            </p>
          </div>
          <span className="text-4xl">🏷️</span>
        </div>
      </div>

      {/* Last Sync */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600 text-sm font-medium">Last Sync</p>
            <p className="text-lg font-bold text-gray-900">
              {metrics.lastSyncAt
                ? new Date(metrics.lastSyncAt).toLocaleDateString()
                : 'Never'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {metrics.lastSyncStatus || 'Not configured'}
            </p>
          </div>
          <span className="text-4xl">🔄</span>
        </div>
      </div>
    </div>
  )
}
