'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ProjectDeleteDialogProps {
  projectId: string
  projectName: string
  onClose: () => void
  onConfirm: () => void
}

export function ProjectDeleteDialog({
  projectId,
  projectName,
  onClose,
  onConfirm,
}: ProjectDeleteDialogProps) {
  const router = useRouter()
  const [selectedOption, setSelectedOption] = useState<'project-only' | 'all-data'>('project-only')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const handleDelete = async () => {
    if (!confirmed) {
      setError('Please confirm deletion')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deleteAllData: selectedOption === 'all-data',
        }),
      })

      if (!response.ok) {
        let errorMessage = 'Failed to delete project'
        try {
          const data = await response.json()
          errorMessage = data.error || errorMessage
        } catch {
          errorMessage = `Server error (${response.status}): ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      onConfirm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Modal Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="bg-red-50 border-b border-red-200 px-6 py-4">
            <h2 className="text-xl font-bold text-red-900">Delete Project</h2>
            <p className="text-sm text-red-700 mt-1">
              Are you sure you want to delete <strong>{projectName}</strong>?
            </p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            <p className="text-gray-600">
              Choose what happens to your data:
            </p>

            {/* Option 1 */}
            <div
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                selectedOption === 'project-only'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onClick={() => setSelectedOption('project-only')}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="delete-option"
                  value="project-only"
                  checked={selectedOption === 'project-only'}
                  onChange={(e) => setSelectedOption(e.target.value as 'project-only')}
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold text-gray-900">Option 1: Delete Project Only</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Delete the project record. Keep:
                  </p>
                  <ul className="text-sm text-gray-600 mt-2 ml-4 space-y-1 list-disc">
                    <li>Repository data</li>
                    <li>Test suites</li>
                    <li>Execution history</li>
                    <li>Reports</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Option 2 */}
            <div
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                selectedOption === 'all-data'
                  ? 'border-red-600 bg-red-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onClick={() => setSelectedOption('all-data')}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="delete-option"
                  value="all-data"
                  checked={selectedOption === 'all-data'}
                  onChange={(e) => setSelectedOption(e.target.value as 'all-data')}
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold text-gray-900">Option 2: Delete Project And All Data</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Delete the project and permanently remove:
                  </p>
                  <ul className="text-sm text-gray-600 mt-2 ml-4 space-y-1 list-disc">
                    <li>Repository and test cases</li>
                    <li>Test suites</li>
                    <li>Execution cycles and results</li>
                    <li>Reports and attachments</li>
                  </ul>
                  <p className="text-sm text-red-600 font-semibold mt-2">⚠️ This cannot be undone</p>
                </div>
              </div>
            </div>

            {/* Confirmation Checkbox */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-red-900">
                  I understand this action cannot be undone
                </span>
              </label>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={loading || !confirmed}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:opacity-50"
            >
              {loading ? 'Deleting...' : 'Delete Project'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
