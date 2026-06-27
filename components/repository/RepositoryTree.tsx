'use client'

import { useState, useEffect } from 'react'

interface TreeNode {
  id: string
  name: string
  type: string
  depth: number
  parentId: string | null
  children: TreeNode[]
}

interface RepositoryTreeProps {
  projectId: string
}

export function RepositoryTree({ projectId }: RepositoryTreeProps) {
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [allNodesMap, setAllNodesMap] = useState<Record<string, TreeNode>>({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAllNodes()
  }, [projectId])

  const loadAllNodes = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch all nodes at once (no lazy loading)
      const response = await fetch(`/api/repository?projectId=${projectId}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch repository: ${response.status}`)
      }

      const data = await response.json()
      const allNodes = data.nodes || []

      if (!Array.isArray(allNodes)) {
        console.error('[RepositoryTree] API response nodes is not an array:', data)
        setNodes([])
        setAllNodesMap({})
        return
      }

      // Build map of all nodes for quick lookup
      const nodeMap: Record<string, TreeNode> = {}
      allNodes.forEach((node: any) => {
        nodeMap[node.id] = {
          id: node.id,
          name: node.name,
          type: node.type,
          depth: node.depth || 0,
          parentId: node.parentId || null,
          children: [],
        }
      })

      // Build hierarchy
      const rootNodes: TreeNode[] = []
      allNodes.forEach((node: any) => {
        if (node.parentId && nodeMap[node.parentId]) {
          nodeMap[node.parentId].children.push(nodeMap[node.id])
        } else {
          rootNodes.push(nodeMap[node.id])
        }
      })

      setAllNodesMap(nodeMap)
      setNodes(rootNodes)
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
          No test cases imported yet
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
