'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CodeRepository, ConnectionStatus } from '@prisma/client'

interface RepositoryListProps {
  projectId: string
}

export function RepositoryList({ projectId }: RepositoryListProps) {
  const [repositories, setRepositories] = useState<CodeRepository[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    const fetchRepositories = async () => {
      try {
        setLoading(true)
        setError(null)
        const params = new URLSearchParams({ projectId })
        if (filterStatus !== 'all') params.append('status', filterStatus)

        const response = await fetch(`/api/codeRepositories?${params}`)
        if (!response.ok) throw new Error('Failed to fetch repositories')

        const data = await response.json()
        setRepositories(data.repositories || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchRepositories()
  }, [projectId, filterStatus])

  if (loading) return <div className="p-4">Loading repositories...</div>
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Repositories</h2>
        <Link
          href={`/projects/${projectId}/repositories/new`}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Add Repository
        </Link>
      </div>

      <div className="space-y-2">
        <label className="block">Filter by Status:</label>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border rounded"
        >
          <option value="all">All</option>
          <option value="connected">Connected</option>
          <option value="disconnected">Disconnected</option>
          <option value="error">Error</option>
          <option value="testing">Testing</option>
        </select>
      </div>

      {repositories.length === 0 ? (
        <p className="text-gray-500">No repositories found</p>
      ) : (
        <div className="grid gap-4">
          {repositories.map(repo => (
            <div key={repo.id} className="border rounded-lg p-4 hover:shadow-md transition">
              <Link href={`/projects/${projectId}/repositories/${repo.id}`}>
                <h3 className="font-semibold text-blue-600 hover:underline">{repo.repositoryName}</h3>
              </Link>
              <p className="text-sm text-gray-600 mt-1">{repo.repositoryUrl}</p>
              <div className="flex gap-4 mt-3 text-sm">
                <span className={`px-2 py-1 rounded ${getStatusColor(repo.connectionStatus)}`}>
                  {repo.connectionStatus || 'unknown'}
                </span>
                <span className="px-2 py-1 bg-gray-100 rounded">{repo.repositoryType}</span>
                {repo.repositoryPurpose && (
                  <span className="px-2 py-1 bg-purple-100 rounded">{repo.repositoryPurpose}</span>
                )}
              </div>
              {repo.description && <p className="text-xs text-gray-500 mt-2">{repo.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function getStatusColor(status: ConnectionStatus | null): string {
  switch (status) {
    case 'connected':
      return 'bg-green-100 text-green-800'
    case 'not_tested':
      return 'bg-yellow-100 text-yellow-800'
    case 'error':
      return 'bg-red-100 text-red-800'
    case 'token_expired':
      return 'bg-orange-100 text-orange-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}
