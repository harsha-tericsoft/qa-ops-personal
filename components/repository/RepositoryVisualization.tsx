'use client'

import { useEffect, useState } from 'react'
import { prisma } from '@/lib/prisma'

interface RepositoryNode {
  id: string
  name: string
  type: string
  depth: number
  children?: RepositoryNode[]
  metadata?: Record<string, unknown>
}

interface RepositoryVisualizationProps {
  projectId: string
  refreshTrigger?: number
}

export function RepositoryVisualization({
  projectId,
  refreshTrigger,
}: RepositoryVisualizationProps) {
  const [loading, setLoading] = useState(true)
  const [nodes, setNodes] = useState<RepositoryNode[]>([])
  const [stats, setStats] = useState<{
    totalNodes: number
    folders: number
    files: number
  } | null>(null)
  const [error, setError] = useState('')
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  useEffect(() => {
    const loadRepository = async () => {
      try {
        setLoading(true)
        setError('')

        // Get repository status
        const statusResponse = await fetch(
          `/api/repository/status?projectId=${projectId}`
        )
        const statusData = await statusResponse.json()

        if (!statusData.exists) {
          setNodes([])
          setStats(null)
          return
        }

        setStats(statusData.repository.stats)

        // Get repository nodes
        const nodesResponse = await fetch(
          `/api/repository/tree?projectId=${projectId}`
        )

        if (!nodesResponse.ok) {
          setError('Failed to load repository')
          return
        }

        const nodesData = await nodesResponse.json()
        setNodes(nodesData.nodes || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load repository')
      } finally {
        setLoading(false)
      }
    }

    loadRepository()
  }, [projectId, refreshTrigger])

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  const TreeNode = ({ node, depth = 0 }: { node: RepositoryNode; depth?: number }) => {
    const isFolder = node.type === 'FOLDER'
    const isExpanded = expandedNodes.has(node.id)
    const hasChildren = (node.children?.length || 0) > 0

    return (
      <div key={node.id} style={{ marginLeft: `${depth * 1.5}rem` }} className="py-1">
        <div className="flex items-center gap-2 hover:bg-gray-50 p-1 rounded cursor-pointer">
          {hasChildren ? (
            <button
              onClick={() => toggleNode(node.id)}
              className="w-5 h-5 flex items-center justify-center text-gray-600"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          ) : (
            <div className="w-5" />
          )}

          <span className="text-lg">
            {isFolder ? (isExpanded ? '📂' : '📁') : '📄'}
          </span>

          <span className="text-gray-900 font-medium text-sm">{node.name}</span>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children?.map((child) => (
              <TreeNode key={child.id} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
        <p className="text-gray-600">Loading repository...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-700 font-medium">❌ Error</p>
        <p className="text-red-600 text-sm mt-2">{error}</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <p className="text-yellow-800">⚠️ No repository data. Run initial sync first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-sm font-medium">Total Items</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalNodes}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-sm font-medium">Folders</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{stats.folders}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-sm font-medium">Pages</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{stats.files}</p>
        </div>
      </div>

      {/* Tree View */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
        <h4 className="font-semibold text-gray-900 mb-3">Repository Structure</h4>

        {nodes.length === 0 ? (
          <p className="text-gray-600 text-sm">No items to display</p>
        ) : (
          <div className="space-y-0">
            {nodes.map((node) => (
              <TreeNode key={node.id} node={node} depth={0} />
            ))}
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-900 text-xs font-medium">📋 Repository Information</p>
        <p className="text-blue-800 text-xs mt-1">
          • Click folder icons to expand/collapse sections
          <br />
          • Supports unlimited nesting depth
          <br />• Selected items (folders) can be used for test suite creation
        </p>
      </div>
    </div>
  )
}
