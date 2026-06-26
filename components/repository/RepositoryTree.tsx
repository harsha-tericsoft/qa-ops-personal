'use client'

import { useState, useEffect } from 'react'

interface TreeNode {
  id: string
  name: string
  type: string
  depth: number
  path: string
  metadata: any
  tags: string[]
  roamPageId: string | null
  children: TreeNode[]
  hasMore?: boolean
  loading?: boolean
}

interface RepositoryTreeProps {
  projectId: string
  parentId?: string | null
  search?: string
  selectedTags?: string[]
  nodeType?: string | null
  isAutomated?: string | null
}

export function RepositoryTree({
  projectId,
  parentId = null,
  search = '',
  selectedTags = [],
  nodeType = null,
  isAutomated = null,
}: RepositoryTreeProps) {
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchNodes(null) // Load root nodes only
  }, [projectId, search, selectedTags, nodeType, isAutomated])

  const fetchNodes = async (parent: string | null = null) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        projectId,
      })

      if (parent) params.append('parentId', parent)
      if (search) params.append('search', search)
      selectedTags.forEach((tag) => params.append('tags', tag))
      if (nodeType) params.append('nodeType', nodeType)
      if (isAutomated) params.append('automated', isAutomated)

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

      if (!Array.isArray(data.nodes)) {
        console.error('[RepositoryTree] API response nodes is not an array:', data)
        setNodes([])
      } else {
        setNodes(data.nodes)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setNodes([])
    } finally {
      setLoading(false)
    }
  }

  const fetchChildren = async (nodeId: string) => {
    try {
      const params = new URLSearchParams({
        projectId,
        parentId: nodeId,
      })

      if (search) params.append('search', search)
      selectedTags.forEach((tag) => params.append('tags', tag))
      if (nodeType) params.append('nodeType', nodeType)
      if (isAutomated) params.append('automated', isAutomated)

      const response = await fetch(`/api/repository/tree?${params}`)
      if (!response.ok) throw new Error('Failed to fetch children')

      const data = await response.json()
      return Array.isArray(data.nodes) ? data.nodes : []
    } catch (err) {
      console.error('[RepositoryTree] Error loading children:', err)
      return []
    }
  }

  const findAndUpdateNode = (nodes: TreeNode[], nodeId: string, update: (n: TreeNode) => TreeNode): TreeNode[] => {
    return nodes.map(n => {
      if (n.id === nodeId) {
        return update(n)
      }
      if (n.children && n.children.length > 0) {
        return { ...n, children: findAndUpdateNode(n.children, nodeId, update) }
      }
      return n
    })
  }

  const toggleExpanded = async (id: string) => {
    const newExpanded = new Set(expanded)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
      setExpanded(newExpanded)
    } else {
      // Mark as loading
      setNodes(prevNodes => findAndUpdateNode(prevNodes, id, n => ({ ...n, loading: true })))

      const children = await fetchChildren(id)
      setNodes(prevNodes => findAndUpdateNode(prevNodes, id, n => ({ ...n, children, loading: false })))

      newExpanded.add(id)
      setExpanded(newExpanded)
    }
  }

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const hasChildren = node.hasMore || (node.children && node.children.length > 0)
    const isExpanded = expanded.has(node.id)
    const isLoading = node.loading
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
              disabled={isLoading}
              className="text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              {isLoading ? '⟳' : isExpanded ? '▼' : '▶'}
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

  if (!Array.isArray(nodes) || nodes.length === 0) {
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
