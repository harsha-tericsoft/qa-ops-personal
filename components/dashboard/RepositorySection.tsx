import { MetricCard } from './MetricCard'
import { MetricGrid } from './MetricGrid'

interface RepositorySectionProps {
  repositoryTests: number
  tagCount: number
  lastSyncAt: Date | null
  lastSyncStatus: string
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

export function RepositorySection({
  repositoryTests,
  tagCount,
  lastSyncAt,
  lastSyncStatus,
}: RepositorySectionProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3 text-gray-900">Repository</h2>
      <MetricGrid>
        <MetricCard
          label="Repository Tests"
          value={repositoryTests}
          color="blue"
        />
        <MetricCard
          label="Tags"
          value={tagCount}
          color="blue"
        />
        <MetricCard
          label="Last Sync"
          value={formatLastSync(lastSyncAt, lastSyncStatus)}
          color="blue"
        />
      </MetricGrid>
    </div>
  )
}
