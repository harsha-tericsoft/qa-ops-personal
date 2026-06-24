'use client'

import React from 'react'

interface TestCase {
  id: string
  title: string
  description?: string
  tags?: string[]
  testRuns?: number
  module?: string
  feature?: string
}

interface TestCaseGridProps {
  testCases: TestCase[]
  selectedIds: Set<string>
  onSelectionChange: (id: string, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
  loading?: boolean
  error?: string
  total: number
  page: number
  limit: number
  onPageChange: (page: number) => void
}

export function TestCaseGrid({
  testCases,
  selectedIds,
  onSelectionChange,
  onSelectAll,
  loading = false,
  error,
  total,
  page,
  limit,
  onPageChange,
}: TestCaseGridProps) {
  const totalPages = Math.ceil(total / limit)
  const allSelected = testCases.length > 0 && testCases.every((tc) => selectedIds.has(tc.id))

  const extractModule = (title: string): string => {
    // Extract module from title if present
    const match = title.match(/^([^:]+):/)
    return match ? match[1].trim() : '—'
  }

  const extractFeature = (title: string): string => {
    // Extract feature/when clause
    const match = title.match(/When I (.+?)(?:\.|,|$)/)
    return match ? `When I ${match[1]}` : '—'
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    )
  }

  if (loading && testCases.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500">Loading test cases...</p>
      </div>
    )
  }

  if (testCases.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No test cases found. Try adjusting your filters.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select tests'}
              </span>
            </div>
          </div>
        </div>

        {/* Grid Header */}
        <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-700 uppercase tracking-wide">
          <div className="col-span-1 flex items-center">
            <span className="sr-only">Select</span>
          </div>
          <div className="col-span-5">Test Statement</div>
          <div className="col-span-2">Module</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Tags</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-200">
          {testCases.map((testCase) => {
            const isSelected = selectedIds.has(testCase.id)
            const module = testCase.module || extractModule(testCase.title)

            return (
              <div
                key={testCase.id}
                className={`px-6 py-4 hover:bg-blue-50 transition-colors ${
                  isSelected ? 'bg-blue-100' : ''
                }`}
              >
                {/* Mobile view */}
                <div className="lg:hidden space-y-2">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => onSelectionChange(testCase.id, e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 mt-1"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 break-words">{testCase.title}</p>
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        <p>
                          <span className="font-medium">Module:</span> {module}
                        </p>
                        <p>
                          <span className="font-medium">Type:</span>{' '}
                          {testCase.tags?.includes('Manual')
                            ? 'Manual'
                            : testCase.tags?.includes('Automated')
                              ? 'Automated'
                              : '—'}
                        </p>
                        {testCase.tags && testCase.tags.length > 0 && (
                          <p>
                            <span className="font-medium">Tags:</span>{' '}
                            {testCase.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-block bg-gray-200 text-gray-800 text-xs rounded-full px-2 py-0.5 mr-1"
                              >
                                {tag}
                              </span>
                            ))}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desktop view */}
                <div className="hidden lg:grid grid-cols-12 gap-4 items-start">
                  <div className="col-span-1 flex items-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => onSelectionChange(testCase.id, e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                  </div>
                  <div className="col-span-5">
                    <p className="font-medium text-gray-900 break-words">{testCase.title}</p>
                  </div>
                  <div className="col-span-2 text-sm text-gray-600">{module}</div>
                  <div className="col-span-2 text-sm text-gray-600">
                    {testCase.tags?.includes('Manual')
                      ? 'Manual'
                      : testCase.tags?.includes('Automated')
                        ? 'Automated'
                        : '—'}
                  </div>
                  <div className="col-span-2 text-sm">
                    {testCase.tags && testCase.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {testCase.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-block bg-gray-200 text-gray-800 text-xs rounded-full px-2 py-0.5"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1 || loading}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages || loading}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="text-sm text-gray-600 mt-4">
        Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} test cases
      </div>
    </div>
  )
}
