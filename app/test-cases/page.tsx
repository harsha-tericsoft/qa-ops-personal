'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { TestCaseSummaryCards } from '@/components/test-cases/TestCaseSummaryCards'
import { TestCaseFilterPanel } from '@/components/test-cases/TestCaseFilterPanel'
import { TestCaseGrid } from '@/components/test-cases/TestCaseGrid'
import { PreviewSelectedModal } from '@/components/test-cases/PreviewSelectedModal'
import { CreateSuiteModal } from '@/components/test-cases/CreateSuiteModal'
import { useState, useEffect } from 'react'

interface Project {
  id: string
  name: string
}

interface TestCase {
  id: string
  title: string
  description?: string
  tags?: string[]
  testRuns?: number
}

interface FilterOptions {
  tags: Array<{ name: string; count: number }>
  types: Array<{ name: string; count: number }>
  modules: Array<{ name: string; count: number }>
}

interface TestCaseSummary {
  total: number
  byTag?: Record<string, number>
  byType?: Record<string, number>
  byModule?: Record<string, number>
}

function TestCasesContent() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProjectId, setCurrentProjectId] = useState('')
  const [loading, setLoading] = useState(true)
  const [testCases, setTestCases] = useState<TestCase[]>([])
  const [summary, setSummary] = useState<TestCaseSummary>({ total: 0 })
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    tags: [],
    types: [],
    modules: [],
  })

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedModule, setSelectedModule] = useState<string>()
  const [selectedType, setSelectedType] = useState<string>()

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalTests, setTotalTests] = useState(0)
  const itemsPerPage = 10

  // GLOBAL SELECTION: Persist across pagination, filtering, sorting
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    // Load from sessionStorage on init
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('test-cases-selection')
      if (stored) {
        try {
          return new Set(JSON.parse(stored))
        } catch {
          return new Set()
        }
      }
    }
    return new Set()
  })

  // Preview modal
  const [showPreview, setShowPreview] = useState(false)

  // Create suite modal
  const [showCreateSuite, setShowCreateSuite] = useState(false)

  useEffect(() => {
    fetchProjects()
  }, [])

  useEffect(() => {
    if (currentProjectId) {
      fetchFilterOptions()
      fetchSummary()
      fetchTestCases()
    }
  }, [
    currentProjectId,
    searchQuery,
    selectedTags,
    selectedModule,
    selectedType,
    currentPage,
  ])

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      if (response.ok) {
        const data = await response.json()
        setProjects(data)
        if (data.length > 0) {
          setCurrentProjectId(data[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch(
        `/api/test-cases/filter-options?projectId=${currentProjectId}`
      )
      if (response.ok) {
        const data = await response.json()
        setFilterOptions(data)
      }
    } catch (err) {
      console.error('Failed to fetch filter options:', err)
    }
  }

  const fetchSummary = async () => {
    try {
      const response = await fetch(
        `/api/test-cases/summary?projectId=${currentProjectId}`
      )
      if (response.ok) {
        const data = await response.json()
        setSummary(data)
      }
    } catch (err) {
      console.error('Failed to fetch summary:', err)
    }
  }

  const fetchTestCases = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        projectId: currentProjectId,
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        ...(searchQuery && { search: searchQuery }),
        ...(selectedTags.length > 0 && { tags: selectedTags.join(',') }),
        ...(selectedModule && { modules: selectedModule }),
        ...(selectedType && { types: selectedType }),
      })

      const response = await fetch(`/api/test-cases/search?${params}`)
      if (response.ok) {
        const data = await response.json()
        setTestCases(data.testCases || [])
        setTotalTests(data.total || 0)
      }
    } catch (err) {
      console.error('Failed to fetch test cases:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
    setCurrentPage(1)
  }

  const handleModuleChange = (module: string) => {
    setSelectedModule(module || undefined)
    setCurrentPage(1)
  }

  const handleTypeChange = (type: string) => {
    setSelectedType(type || undefined)
    setCurrentPage(1)
  }

  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
    setCurrentPage(1)
  }

  const handleClearFilters = () => {
    setSearchQuery('')
    setSelectedTags([])
    setSelectedModule(undefined)
    setSelectedType(undefined)
    setCurrentPage(1)
  }

  const handleSelectionChange = (id: string, selected: boolean) => {
    const newSelected = new Set(selectedIds)
    if (selected) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedIds(newSelected)
    // Persist to sessionStorage
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('test-cases-selection', JSON.stringify(Array.from(newSelected)))
      console.log('[Selection] Updated:', { id, selected, totalSelected: newSelected.size })
    }
  }

  const handleSelectAll = (selected: boolean) => {
    console.log('[handleSelectAll] Called with selected:', selected)
    if (selected) {
      // Immediately select all visible tests on current page
      const newSelected = new Set([...selectedIds, ...testCases.map((tc) => tc.id)])
      console.log('[handleSelectAll] Selected current page tests, new count:', newSelected.size)
      setSelectedIds(newSelected)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('test-cases-selection', JSON.stringify(Array.from(newSelected)))
        console.log('[SelectAll] Updated sessionStorage with', newSelected.size, 'IDs')
      }

      // In the background, fetch and select ALL filtered test case IDs
      const fetchAllIds = async () => {
        try {
          const params = new URLSearchParams({
            projectId: currentProjectId,
            ...(searchQuery && { search: searchQuery }),
            ...(selectedTags.length > 0 && { tags: selectedTags.join(',') }),
            ...(selectedModule && { modules: selectedModule }),
            ...(selectedType && { types: selectedType }),
          })
          const url = `/api/test-cases/all-filtered-ids?${params}`
          console.log('[handleSelectAll] Background fetch of all IDs...')
          const response = await fetch(url)
          if (response.ok) {
            const data = await response.json()
            console.log('[handleSelectAll] Got all IDs:', data.ids.length)
            // Update with all IDs (not just current page)
            const allSelected = new Set([...selectedIds, ...data.ids])
            setSelectedIds(allSelected)
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('test-cases-selection', JSON.stringify(Array.from(allSelected)))
              console.log('[SelectAll] Updated with all', allSelected.size, 'IDs')
            }
          }
        } catch (err) {
          console.error('[handleSelectAll] Background fetch failed:', err)
        }
      }
      fetchAllIds()
    } else {
      // Clear all selections
      console.log('[handleSelectAll] Clearing all selections')
      setSelectedIds(new Set())
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('test-cases-selection')
        console.log('[DeselectAll] Cleared all selections')
      }
    }
  }

  const handleClearSelection = () => {
    setSelectedIds(new Set())
    sessionStorage.removeItem('test-cases-selection')
  }

  if (!currentProjectId) {
    return (
      <div className="p-8">
        <p className="text-gray-600">Loading projects...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Test Cases</h1>
            <p className="text-gray-600">
              Search and filter test cases imported from Roam Research
            </p>
          </div>

          {/* Project Selection */}
          {user?.role === 'LEAD' && projects.length > 0 && (
            <div className="mb-8 bg-white rounded-lg border border-gray-200 p-4">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Select Project
              </label>
              <select
                value={currentProjectId}
                onChange={(e) => {
                  setCurrentProjectId(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Summary Cards */}
          <TestCaseSummaryCards
            total={summary.total}
            byTag={summary.byTag}
            loading={loading}
          />

          {/* Layout: Filters + Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Filter Panel */}
            <div className="lg:col-span-1">
              <TestCaseFilterPanel
                tags={filterOptions.tags}
                modules={filterOptions.modules}
                types={filterOptions.types}
                selectedTags={selectedTags}
                selectedModule={selectedModule}
                selectedType={selectedType}
                searchQuery={searchQuery}
                onTagToggle={handleTagToggle}
                onModuleChange={handleModuleChange}
                onTypeChange={handleTypeChange}
                onSearchChange={handleSearchChange}
                onClearFilters={handleClearFilters}
                loading={loading}
              />
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3 space-y-6">
              {/* Selection Bar */}
              {selectedIds.size > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-900">
                      {selectedIds.size} test{selectedIds.size !== 1 ? 's' : ''} selected
                    </span>
                    <div className="space-x-3">
                      <button
                        onClick={handleClearSelection}
                        className="px-4 py-2 text-sm border border-blue-300 text-blue-700 hover:bg-blue-100 rounded-lg"
                      >
                        Clear Selection
                      </button>
                      <button
                        onClick={() => setShowPreview(true)}
                        className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
                      >
                        Preview Selected ({selectedIds.size})
                      </button>
                      <button
                        onClick={() => setShowCreateSuite(true)}
                        className="px-4 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg"
                      >
                        Create Suite ({selectedIds.size})
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Test Cases Grid */}
              <TestCaseGrid
                testCases={testCases}
                selectedIds={selectedIds}
                onSelectionChange={handleSelectionChange}
                onSelectAll={handleSelectAll}
                loading={loading}
                total={totalTests}
                page={currentPage}
                limit={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-12">
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
              <h3 className="font-bold text-blue-900 mb-2">💡 Test Cases Working View</h3>
              <ul className="text-blue-800 text-sm space-y-1">
                <li>✓ Search and filter tests by tags, module, and type</li>
                <li>✓ Select individual tests or filtered results</li>
                <li>✓ Preview tests before creating a suite</li>
                <li>✓ Create test suites from selected tests</li>
                <li>✓ Existing Repository hierarchy method still available</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <PreviewSelectedModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        selectedCount={selectedIds.size}
        testCases={testCases.filter(tc => selectedIds.has(tc.id))}
      />

      {/* Create Suite Modal */}
      <CreateSuiteModal
        isOpen={showCreateSuite}
        onClose={() => setShowCreateSuite(false)}
        selectedIds={selectedIds}
        projectId={currentProjectId}
        onSuiteCreated={() => {
          // Refresh might be needed here, but for now just close and clear
          setShowCreateSuite(false)
          setSelectedIds(new Set())
        }}
      />
    </div>
  )
}

export default function TestCasesPage() {
  return (
    <ProtectedRoute>
      <TestCasesContent />
    </ProtectedRoute>
  )
}
