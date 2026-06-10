'use client'

import { useEffect, useState } from 'react'

interface Activity {
  id: string
  type: 'SYNC' | 'SUITE' | 'CYCLE' | 'DEFECT'
  message: string
  timestamp: Date
  icon: string
}

interface RecentActivityProps {
  projectId: string
}

async function fetchRecentActivity(projectId: string): Promise<Activity[]> {
  try {
    const logs = await fetch(`/api/roam/logs?projectId=${projectId}&limit=5`)
    if (!logs.ok) return []

    const syncLogs = await logs.json()
    if (!Array.isArray(syncLogs) || syncLogs.length === 0) {
      return []
    }

    return syncLogs.map((log: any, index: number) => ({
      id: log.id || `log-${index}`,
      type: 'SYNC',
      message: `Roam sync ${log.status === 'SUCCESS' ? 'completed' : 'failed'}`,
      timestamp: new Date(log.createdAt),
      icon: log.status === 'SUCCESS' ? '✅' : '❌',
    }))
  } catch (error) {
    return []
  }
}

export function RecentActivity({ projectId }: RecentActivityProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadActivities = async () => {
      const data = await fetchRecentActivity(projectId)
      setActivities(data)
      setLoading(false)
    }

    loadActivities()
  }, [projectId])

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3 text-gray-900">Recent Activity</h2>

      {loading ? (
        <div className="text-center py-4 text-gray-500">Loading...</div>
      ) : activities.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
          No activity yet
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
          {activities.map((activity) => (
            <div key={activity.id} className="p-4 flex items-start gap-3">
              <span className="text-xl mt-0.5">{activity.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Intl.DateTimeFormat('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(activity.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
