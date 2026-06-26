'use client'

import React, { useState, useEffect } from 'react'

interface RepositoryNode {
  id: string
  name: string
  type: string
  parentId: string | null
  depth: number
  children?: RepositoryNode[]
}

interface RepositoryTreeSelectorProps {
  projectId: string
  selectedNodeIds: string[]
  selectedTestCount: number
  onSelectionChange: (nodeIds: string[], testCount: number) => void
}

export function RepositoryTreeSelector({
  projectId,
  selectedNodeIds,
  selectedTestCount,
  onSelectionChange,
}: RepositoryTreeSelectorProps) {
  const [nodes, setNodes] = useState<RepositoryNode[]>([])
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [testCounts, setTestCounts] = useState<Record<string, number>>({})
  const [testCases, setTestCases] = useState<any[]>([])

  useEffect(() => {
    fetchRepositoryHierarchy()
    console.log('[RepositoryTreeSelector] Component loaded for project:', projectId)
  }, [projectId])

  const fetchRepositoryHierarchy = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/repository?projectId=${projectId}`)
      if (response.ok) {
        const data = await response.json()
        const hierarchyNodes = buildHierarchy(data.nodes || [])
        setNodes(hierarchyNodes)

        // Fetch test counts for each node
        const counts = await fetchTestCounts(data.nodes || [])
        setTestCounts(counts)
      }
    } catch (error) {
      console.error('Error fetching repository hierarchy:', error)
    } finally {
      setLoading(false)
    }
  }

  const buildHierarchy = (flatNodes: any[]): RepositoryNode[] => {
    const nodeMap: Record<string, RepositoryNode> = {}
    const rootNodes: RepositoryNode[] = []

    // First pass: create all nodes
    flatNodes.forEach((node: any) => {
      nodeMap[node.id] = {
        id: node.id,
        name: node.name,
        type: node.type,
        parentId: node.parentId,
        depth: node.depth || 0,
        children: [],
      }
    })

    // Second pass: build hierarchy
    flatNodes.forEach((node: any) => {
      if (node.parentId && nodeMap[node.parentId]) {
        nodeMap[node.parentId].children = nodeMap[node.parentId].children || []
        nodeMap[node.parentId].children!.push(nodeMap[node.id])
      } else {
        rootNodes.push(nodeMap[node.id])
      }
    })

    return rootNodes
  }

  const fetchTestCounts = async (nodes: any[]): Promise<Record<string, number>> => {
    const counts: Record<string, number> = {}

    try {
      // Use optimized node-mapping endpoint: only id + repositoryNodeId, no sorting
      // This is 10-20x faster than full test-cases endpoint
      const response = await fetch(`/api/test-cases/node-mapping?projectId=${projectId}`)
      if (response.ok) {
        const data = await response.json()

        // DEBUG: Log the exact API response structure
        console.log('[RepositoryTreeSelector] Raw API response:', data)
        console.log('[RepositoryTreeSelector] typeof data:', typeof data)
        console.log('[RepositoryTreeSelector] Array.isArray(data):', Array.isArray(data))
        console.log('[RepositoryTreeSelector] Object.keys(data):', Object.keys(data))

        const fetchedTestCases = data?.data || []

        console.log('[RepositoryTreeSelector] Extracted fetchedTestCases:', fetchedTestCases)
        console.log('[RepositoryTreeSelector] typeof fetchedTestCases:', typeof fetchedTestCases)
        console.log('[RepositoryTreeSelector] Array.isArray(fetchedTestCases):', Array.isArray(fetchedTestCases))
        console.log('[RepositoryTreeSelector] Fetched', fetchedTestCases.length, 'test case mappings')

        // Store test cases in state for later direct counting
        setTestCases(fetchedTestCases)

        // Count test cases for each node and its descendants
        nodes.forEach((node: any) => {
          counts[node.id] = countTestsForNode(node.id, nodes, fetchedTestCases)
        })
      }
    } catch (error) {
      console.error('Error fetching test counts:', error)
    }

    return counts
  }

  const countTestsForNode = (nodeId: string, allNodes: any[], testCasesParam: any[]): number => {
    // Get all descendant nodes
    const descendants = getNodeAndDescendants(nodeId, allNodes)
    const descendantIds = descendants.map((n: any) => n.id)

    // Defensive: ensure testCasesParam is an array before filtering
    const testCasesArray = Array.isArray(testCasesParam) ? testCasesParam : []
    // Count test cases that have a repositoryNodeId in descendants
    return testCasesArray.filter((tc: any) => descendantIds.includes(tc.repositoryNodeId)).length
  }

  const getNodeAndDescendants = (nodeId: string, allNodes: any[]): any[] => {
    const result = [allNodes.find((n: any) => n.id === nodeId)].filter(Boolean)
    const children = allNodes.filter((n: any) => n.parentId === nodeId)

    children.forEach((child: any) => {
      result.push(...getNodeAndDescendants(child.id, allNodes))
    })

    return result
  }

  const toggleNodeExpansion = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  const toggleNodeSelection = (nodeId: string) => {
    const newSelected = new Set(selectedNodeIds)
    const allNodes = flattenHierarchy(nodes)

    if (newSelected.has(nodeId)) {
      // Deselect node and all descendants
      const descendants = getNodeAndDescendants(nodeId, allNodes)
      descendants.forEach((node: any) => newSelected.delete(node.id))
    } else {
      // Select node and all descendants
      const descendants = getNodeAndDescendants(nodeId, allNodes)
      descendants.forEach((node: any) => newSelected.add(node.id))
    }

    // DIRECT COUNT: Count test cases that match ANY selected node
    // This is more reliable than depending on pre-calculated testCounts
    const selectedNodeSet = new Set(newSelected)

    // DEBUG: Log testCases state before filter
    console.log('[toggleNodeSelection] testCases state:', testCases)
    console.log('[toggleNodeSelection] typeof testCases:', typeof testCases)
    console.log('[toggleNodeSelection] Array.isArray(testCases):', Array.isArray(testCases))
    console.log('[toggleNodeSelection] testCases.length:', Array.isArray(testCases) ? testCases.length : 'N/A')
    if (Array.isArray(testCases) && testCases.length > 0) {
      console.log('[toggleNodeSelection] First testCase:', testCases[0])
    }
    if (testCases && typeof testCases === 'object') {
      console.log('[toggleNodeSelection] Object.keys(testCases):', Object.keys(testCases))
    }

    // Expose to window for Playwright access
    (window as any).__testCasesDebug = {
      detected: true,
      typeof: typeof testCases,
      isArray: Array.isArray(testCases),
      length: Array.isArray(testCases) ? testCases.length : 'N/A',
      keys: testCases && typeof testCases === 'object' ? Object.keys(testCases) : [],
      first: Array.isArray(testCases) && testCases.length > 0 ? testCases[0] : null,
    }

    // Defensive: ensure testCases is an array before filtering
    const testCasesArray = Array.isArray(testCases) ? testCases : []
    const totalCount = testCasesArray.filter((tc: any) =>
      selectedNodeSet.has(tc.repositoryNodeId)
    ).length

    onSelectionChange(Array.from(newSelected), totalCount)
  }

  const flattenHierarchy = (nodes: RepositoryNode[]): RepositoryNode[] => {
    let result: RepositoryNode[] = []
    nodes.forEach((node) => {
      result.push(node)
      if (node.children) {
        result.push(...flattenHierarchy(node.children))
      }
    })
    return result
  }

  const renderNode = (node: RepositoryNode, level: number = 0): React.ReactElement => {
    const isSelected = selectedNodeIds.includes(node.id)
    const hasChildren = node.children && node.children.length > 0

    // DYNAMIC COUNT: Calculate per-node test count by counting descendants
    // This is more reliable than using pre-calculated testCounts
    const allNodesFlat = flattenHierarchy(nodes)
    const descendants = getNodeAndDescendants(node.id, allNodesFlat)
    const descendantIds = descendants.map((n: any) => n.id)

    // Defensive: ensure testCases is an array before filtering
    const testCasesArray = Array.isArray(testCases) ? testCases : []
    const testCount = testCasesArray.filter((tc: any) => descendantIds.includes(tc.repositoryNodeId)).length

    return (
      <div key={node.id}>
        <div className="flex items-center gap-2 py-2 px-2 hover:bg-gray-100 rounded">
          {hasChildren && (
            <button
              onClick={() => toggleNodeExpansion(node.id)}
              className="flex-shrink-0 text-gray-500 hover:text-gray-700 w-4 text-center"
            >
              {expandedNodes.has(node.id) ? '▼' : '▶'}
            </button>
          )}
          {!hasChildren && <div className="w-4" />}

          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleNodeSelection(node.id)}
            className="w-4 h-4 rounded border-gray-300 cursor-pointer"
          />

          <label className="flex-1 cursor-pointer">
            <span className="text-sm text-gray-900">{node.name}</span>
            {testCount > 0 && (
              <span className="ml-2 text-xs text-gray-500">
                ({testCount} test{testCount !== 1 ? 's' : ''})
              </span>
            )}
          </label>
        </div>

        {hasChildren && expandedNodes.has(node.id) && (
          <div className="ml-4 border-l border-gray-200">
            {node.children!.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return <p className="text-gray-500">Loading repository structure...</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium text-gray-900">Select Test Cases</h3>
        <span className="text-sm font-semibold text-blue-600">
          {selectedTestCount} test{selectedTestCount !== 1 ? 's' : ''} selected
        </span>
      </div>

      <div className="border border-gray-300 rounded-lg p-4 max-h-64 overflow-y-auto">
        {nodes.length === 0 ? (
          <p className="text-gray-500">No repository structure available</p>
        ) : (
          <div className="space-y-0">
            {nodes.map((node) => renderNode(node))}
          </div>
        )}
      </div>
    </div>
  )
}
