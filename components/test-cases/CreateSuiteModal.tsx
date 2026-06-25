'use client'

import React, { useState } from 'react'
import { showToast } from '@/lib/toast'

interface CreateSuiteModalProps {
  isOpen: boolean
  onClose: () => void
  selectedIds: Set<string>
  projectId: string
  onSuiteCreated?: () => void
}

export function CreateSuiteModal({
  isOpen,
  onClose,
  selectedIds,
  projectId,
  onSuiteCreated,
}: CreateSuiteModalProps) {
  const [suiteName, setSuiteName] = useState('')
  const [suiteDesc, setSuiteDesc] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    if (!suiteName.trim()) {
      showToast('Suite name is required', 'error')
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch(`/api/test-suites?projectId=${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: suiteName,
          description: suiteDesc,
          category: 'CUSTOM',
          selectionMethod: 'MANUAL',
          roamTestCaseIds: Array.from(selectedIds),
        }),
      })

      if (response.ok) {
        showToast(`Suite "${suiteName}" created successfully with ${selectedIds.size} test cases`, 'success')
        setSuiteName('')
        setSuiteDesc('')
        onClose()
        // Clear selection
        sessionStorage.removeItem('test-cases-selection')
        // Notify parent to refresh
        onSuiteCreated?.()
      } else {
        const error = await response.json()
        showToast(`Failed to create suite: ${error.error || 'Unknown error'}`, 'error')
      }
    } catch (error) {
      showToast(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    } finally {
      setIsCreating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Create Test Suite</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
          <p className="text-blue-900 font-medium">
            Creating suite with <strong>{selectedIds.size}</strong> selected test{selectedIds.size !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Suite Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={suiteName}
              onChange={(e) => setSuiteName(e.target.value)}
              placeholder="e.g., Smoke Tests, Critical Path, Release Tests"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isCreating}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Description
            </label>
            <textarea
              value={suiteDesc}
              onChange={(e) => setSuiteDesc(e.target.value)}
              placeholder="Optional: Describe the purpose of this test suite"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isCreating}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end pt-4 border-t">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !suiteName.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {isCreating ? 'Creating...' : 'Create Suite'}
          </button>
        </div>
      </div>
    </div>
  )
}
