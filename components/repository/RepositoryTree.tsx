'use client'

import { useState, useEffect } from 'react'

interface TreeNode {
  id: string
  name: string
  description: string | null
  type: string
  depth: number
  children: TreeNode[]
}

interface RepositoryTreeProps {
  projectId: string
  parentId?: string | null
  search?: string
  selectedTags?: string[]
}

export function RepositoryTree({
  projectId,
  parentId = null,
  search = '',
  selectedTags = [],
}: RepositoryTreeProps) {
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchNodes()
  }, [projectId, parentId, search, selectedTags])

  const fetchNodes = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        projectId,
      })

      if (parentId) params.append('parentId', parentId)
      if (search) params.append('search', search)
      selectedTags.forEach((tag) => params.append('tags', tag))

      const response = await fetch(`/api/repository/tree?${params}`)

      if (!response.ok) {
        let errorMessage = 'Failed to fetch nodes'
        try {
          const data = await response.json()
          errorMessage = data.error || errorMessage
        } catch {
          errorMessage = `Server error (${response.status}): ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      setNodes(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setNodes([])
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expanded)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpanded(newExpanded)
  }

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0
    const isExpanded = expanded.has(node.id)
    const paddingLeft = `${depth * 20}px`

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-2 py-2 px-3 hover:bg-gray-50 rounded cursor-pointer group"
          style={{ paddingLeft }}
        >
          {hasChildren && (
            <button
              onClick={() => toggleExpanded(node.id)}
              className="text-gray-600 hover:text-gray-900"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}

          {!hasChildren && <span className="w-4" />}

          <span className="text-lg">
            {node.type === 'FOLDER' ? '📁' : '✅'}
          </span>

          <div className="flex-1">
            <div className="font-medium text-sm text-gray-900">
              {node.name}
            </div>
            {node.description && (
              <div className="text-xs text-gray-500 truncate">
                {node.description}
              </div>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) =>
              renderNode(child, depth + 1)
            )}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Loading repository...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">
          {search ? 'No test cases found matching your search' : 'No test cases imported yet'}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg divide-y">
      {nodes.map((node) => renderNode(node))}
    </div>
  )
}
