'use client'

import { useState } from 'react'

interface RoamImportFileFormProps {
  projectId: string
  onSuccess?: () => void | Promise<void>
}

export function RoamImportFileForm({ projectId, onSuccess }: RoamImportFileFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      setError('Please select a file to import')
      return
    }

    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(
        `/api/roam/import?projectId=${projectId}`,
        {
          method: 'POST',
          body: formData,
        }
      )

      if (!response.ok) {
        let errorMessage = 'Import failed'
        try {
          const data = await response.json()
          errorMessage = data.error || errorMessage
        } catch {
          errorMessage = `Server error (${response.status}): ${response.statusText}`
        }
        setError(errorMessage)
        return
      }

      const data = await response.json()
      setSuccess(`✅ Import successful! Added: ${data.added}, Updated: ${data.updated}`)
      setFile(null)
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg border border-gray-200">
      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{error}</div>}
      {success && <div className="text-green-600 text-sm bg-green-50 p-3 rounded">{success}</div>}

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          Select Roam Export File (.json) *
        </label>
        <input
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          Export from Roam: Right-click on database → Export → JSON
        </p>
      </div>

      <button
        type="submit"
        disabled={loading || !file}
        className="w-full bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
      >
        {loading ? 'Importing...' : 'Import File'}
      </button>

      <div className="bg-gray-50 border border-gray-200 rounded p-4">
        <p className="text-xs text-gray-700">
          <strong>How to export from Roam:</strong><br/>
          1. Open your Roam graph<br/>
          2. Click on ... (more options)<br/>
          3. Select "Export all" or "Export database"<br/>
          4. Choose JSON format<br/>
          5. Download and import here
        </p>
      </div>
    </form>
  )
}
