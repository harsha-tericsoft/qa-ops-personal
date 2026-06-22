'use client'

import { useState, useEffect } from 'react'

interface TreeNode {
  id: string
  name: string
  type: string
  depth: number
  hasChildren: boolean
  children?: TreeNode[]
  testCaseCount?: number
  tests?: Array<{ id: string; title: string; status: string }>
  isLoadingChildren?: boolean
  isLoadingTests?: boolean
}

interface ExpandedState {
  [nodeId: string]: boolean
}

function getLevelLabel(depth: number): string {
  if (depth <= 1) return 'Module'
  if (depth <= 3) return 'Feature'
  if (depth <= 4) return 'Screen'
  return 'Item'
}

function getNodeIcon(depth: number): string {
  if (depth <= 1) return '📦'
  if (depth <= 3) return '✨'
  if (depth <= 4) return '🎨'
  return '📄'
}

function getNodeColor(depth: number): string {
  if (depth <= 1) return 'text-purple-700'
  if (depth <= 3) return 'text-blue-700'
  if (depth <= 4) return 'text-indigo-700'
  return 'text-green-700'
}

function TreeNodeComponent({
  node,
  expanded,
  onToggle,
  onLoadChildren,
  level = 0,
}: {
  node: TreeNode
  expanded: ExpandedState
  onToggle: (nodeId: string) => void
  onLoadChildren: (nodeId: string) => Promise<void>
  level?: number
}) {
  const isExpanded = expanded[node.id] ?? false
  const children = node.children || []

  const handleToggle = async () => {
    if (!isExpanded && node.hasChildren && children.length === 0) {
      await onLoadChildren(node.id)
    }
    onToggle(node.id)
  }

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2 px-2 hover:bg-gray-50 rounded cursor-pointer group"
        style={{ marginLeft: `${level * 1.5}rem` }}
      >
        {node.hasChildren && (
          <button
            onClick={handleToggle}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-900"
          >
            {node.isLoadingChildren ? (
              <span className="animate-spin">⏳</span>
            ) : isExpanded ? (
              '▼'
            ) : (
              '▶'
            )}
          </button>
        )}
        {!node.hasChildren && <div className="w-5" />}

        <span className="text-lg">{getNodeIcon(node.depth)}</span>

        <span className={`font-medium ${getNodeColor(node.depth)} flex-1 truncate`}>
          {node.name}
        </span>

        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
            {getLevelLabel(node.depth)}
          </span>
          {node.tests && node.tests.length > 0 && (
            <span className="text-xs bg-green-100 px-2 py-1 rounded text-green-700 font-medium">
              {node.tests.length} test{node.tests.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {isExpanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              expanded={expanded}
              onToggle={onToggle}
              onLoadChildren={onLoadChildren}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function HierarchicalTestCaseTree({
  projectId,
  search,
}: {
  projectId: string
  search?: string
}) {
  const [hierarchy, setHierarchy] = useState<TreeNode[]>([])
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchHierarchy()
  }, [projectId])

  const fetchHierarchy = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/test-cases/hierarchy?projectId=${projectId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch hierarchy')
      }
      const data = await response.json()
      setHierarchy(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setHierarchy([])
    } finally {
      setLoading(false)
    }
  }

  const loadChildren = async (parentId: string) => {
    try {
      // Mark as loading
      setHierarchy((prev) =>
        prev.map((n) =>
          n.id === parentId ? { ...n, isLoadingChildren: true } : n
        )
      )

      const response = await fetch(
        `/api/test-cases/hierarchy?projectId=${projectId}&parentId=${parentId}`
      )
      if (!response.ok) throw new Error('Failed to load children')

      const children = await response.json()

      // Update the node with children
      setHierarchy((prev) => updateNodeWithChildren(prev, parentId, children))
    } catch (err) {
      console.error('Error loading children:', err)
    }
  }

  const updateNodeWithChildren = (
    nodes: TreeNode[],
    parentId: string,
    children: TreeNode[]
  ): TreeNode[] => {
    return nodes.map((n) => {
      if (n.id === parentId) {
        return { ...n, children, isLoadingChildren: false }
      }
      if (n.children) {
        return {
          ...n,
          children: updateNodeWithChildren(n.children, parentId, children),
        }
      }
      return n
    })
  }

  const toggleNode = (nodeId: string) => {
    setExpanded((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }))
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-200 border-t-blue-600"></div>
        </div>
        <p className="text-gray-600 mt-4">Loading test case hierarchy...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    )
  }

  if (hierarchy.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">No test cases found</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="text-sm text-blue-700">
          <span className="font-semibold">{hierarchy.length}</span> modules available
          <span className="text-blue-600 ml-4">• Expand to view features and screens</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-1">
        {hierarchy.map((node) => (
          <TreeNodeComponent
            key={node.id}
            node={node}
            expanded={expanded}
            onToggle={toggleNode}
            onLoadChildren={loadChildren}
            level={0}
          />
        ))}
      </div>
    </div>
  )
}
