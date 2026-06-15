'use client'

import { useState, useEffect } from 'react'
import { CodeRepository } from '@prisma/client'
import { CredentialManager } from './CredentialManager'
import { ConnectionTester } from './ConnectionTester'
import { TestHistory } from './TestHistory'

interface RepositoryDetailProps {
  repositoryId: string
  projectId: string
}

export function RepositoryDetail({ repositoryId, projectId }: RepositoryDetailProps) {
  const [repository, setRepository] = useState<CodeRepository | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'credentials' | 'testing'>('overview')

  useEffect(() => {
    fetchRepository()
  }, [repositoryId])

  async function fetchRepository() {
    try {
      setLoading(true)
      const response = await fetch(`/api/codeRepositories/${repositoryId}`)
      if (!response.ok) throw new Error('Failed to fetch repository')
      setRepository(await response.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-4">Loading repository...</div>
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>
  if (!repository) return <div className="p-4 text-gray-500">Repository not found</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{repository.repositoryName}</h1>
        <p className="text-gray-600 mt-1">{repository.repositoryUrl}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
        <div>
          <p className="text-sm text-gray-600">Type</p>
          <p className="font-medium">{repository.repositoryType}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Purpose</p>
          <p className="font-medium">{repository.repositoryPurpose || 'N/A'}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Branch</p>
          <p className="font-medium">{repository.branch}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Status</p>
          <p className="font-medium">{repository.connectionStatus || 'unknown'}</p>
        </div>
      </div>

      {repository.description && (
        <div>
          <h3 className="font-semibold mb-2">Description</h3>
          <p className="text-gray-700">{repository.description}</p>
        </div>
      )}

      {repository.tags && repository.tags.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">Tags</h3>
          <div className="flex gap-2 flex-wrap">
            {repository.tags.map(tag => (
              <span key={tag} className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="border-b">
        <div className="flex gap-4">
          {['overview', 'credentials', 'testing'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`px-4 py-2 font-medium border-b-2 transition ${
                activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div>
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded">
              <p className="text-sm text-gray-600">Created: {new Date(repository.createdAt).toLocaleString()}</p>
              {repository.lastAnalyzedAt && (
                <p className="text-sm text-gray-600">Last Analyzed: {new Date(repository.lastAnalyzedAt).toLocaleString()}</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'credentials' && (
          <CredentialManager repositoryId={repositoryId} />
        )}

        {activeTab === 'testing' && (
          <div className="space-y-6">
            <ConnectionTester repositoryId={repositoryId} onTestComplete={fetchRepository} />
            <TestHistory repositoryId={repositoryId} />
          </div>
        )}
      </div>
    </div>
  )
}
