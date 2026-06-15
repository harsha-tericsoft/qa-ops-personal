'use client'

import { useState } from 'react'

interface TestResult {
  testType: string
  testStatus: 'success' | 'failed'
  testMessage: string
  responseTimeMs: number
}

interface ConnectionTesterProps {
  repositoryId: string
  onTestComplete?: () => void
}

export function ConnectionTester({ repositoryId, onTestComplete }: ConnectionTesterProps) {
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<TestResult[]>([])
  const [testTypes, setTestTypes] = useState({
    basic_connectivity: true,
    github_api: true,
    branch_verification: true,
  })

  async function handleTest() {
    try {
      setTesting(true)
      setError(null)
      setResults([])

      const selectedTests = Object.entries(testTypes)
        .filter(([, checked]) => checked)
        .map(([type]) => type)

      if (selectedTests.length === 0) {
        setError('Select at least one test type')
        return
      }

      const response = await fetch(`/api/codeRepositories/${repositoryId}/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testTypes: selectedTests }),
      })

      if (!response.ok) throw new Error('Test failed')
      const data = await response.json()
      setResults(data.results || [])

      if (onTestComplete) onTestComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded">
      <div>
        <p className="font-semibold mb-3">Test Connection</p>
        <div className="space-y-2 mb-4">
          {Object.entries(testTypes).map(([type, checked]) => (
            <label key={type} className="flex items-center">
              <input
                type="checkbox"
                checked={checked}
                onChange={e => setTestTypes({ ...testTypes, [type]: e.target.checked })}
                disabled={testing}
                className="mr-2"
              />
              <span className="text-sm">{type.replace(/_/g, ' ').toUpperCase()}</span>
            </label>
          ))}
        </div>
      </div>

      {error && <div className="p-3 bg-red-100 text-red-800 rounded text-sm">{error}</div>}

      <button
        onClick={handleTest}
        disabled={testing}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {testing ? 'Testing...' : 'Run Tests'}
      </button>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((result, idx) => (
            <div
              key={idx}
              className={`p-3 rounded border-l-4 ${
                result.testStatus === 'success' ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'
              }`}
            >
              <p className="font-medium text-sm">{result.testType.replace(/_/g, ' ').toUpperCase()}</p>
              <p className={`text-sm ${result.testStatus === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                {result.testMessage}
              </p>
              <p className="text-xs text-gray-500 mt-1">{result.responseTimeMs}ms</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
