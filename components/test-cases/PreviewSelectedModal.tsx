'use client'

import React from 'react'

interface TestCase {
  id: string
  title: string
  tags?: string[]
  module?: string
  feature?: string
}

interface PreviewSelectedModalProps {
  isOpen: boolean
  onClose: () => void
  selectedCount: number
  testCases: TestCase[]
}

export function PreviewSelectedModal({
  isOpen,
  onClose,
  selectedCount,
  testCases,
}: PreviewSelectedModalProps) {
  if (!isOpen) return null

  // Group test cases by module for hierarchy display
  const byModule = new Map<string, TestCase[]>()
  testCases.forEach(tc => {
    const module = tc.module || 'Ungrouped'
    if (!byModule.has(module)) {
      byModule.set(module, [])
    }
    byModule.get(module)!.push(tc)
  })

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-96 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Preview Selected Tests</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-700 p-1 rounded"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-blue-600">{selectedCount}</div>
              <div className="text-sm text-blue-700">Total Selected</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-purple-600">{byModule.size}</div>
              <div className="text-sm text-purple-700">Modules</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-600">{testCases.length}</div>
              <div className="text-sm text-green-700">In Preview</div>
            </div>
          </div>

          {/* Hierarchy */}
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900">Hierarchy</h3>
            {Array.from(byModule.entries()).map(([module, tests]) => (
              <div key={module} className="border border-gray-200 rounded-lg">
                <div className="bg-gray-50 px-4 py-2 font-semibold text-gray-900">
                  📦 {module} ({tests.length})
                </div>
                <div className="space-y-1 p-4">
                  {tests.map(tc => (
                    <div key={tc.id} className="flex items-start gap-2 text-sm">
                      <span className="text-blue-600 mt-0.5">✓</span>
                      <div>
                        <div className="text-gray-900 font-medium">{tc.title}</div>
                        {tc.tags && tc.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {tc.tags.map(tag => (
                              <span key={tag} className="inline-block bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Create Suite with Selected ({selectedCount})
          </button>
        </div>
      </div>
    </div>
  )
}
