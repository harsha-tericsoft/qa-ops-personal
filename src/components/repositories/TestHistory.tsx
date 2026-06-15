'use client'

import { useState, useEffect } from 'react'

interface TestRecord {
  id: string
  testType: string
  testStatus: string
  testMessage: string
  responseTimeMs: number
  createdAt: string
}

interface TestHistoryProps {
  repositoryId: string
}

export function TestHistory({ repositoryId }: TestHistoryProps) {
  const [tests, setTests] = useState<TestRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTests = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/codeRepositories/${repositoryId}/test-connection?limit=20`)
        if (!response.ok) throw new Error('Failed to fetch test history')
        const data = await response.json()
        setTests(data.tests || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchTests()
  }, [repositoryId])

  if (loading) return <div className="p-4">Loading test history...</div>
  if (error) return <div className="p-4 text-red-600 text-sm">Error: {error}</div>

  return (
    <div className="space-y-2">
      <h4 className="font-semibold">Test History</h4>
      {tests.length === 0 ? (
        <p className="text-gray-500 text-sm">No tests run yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Message</th>
                <th className="px-3 py-2 text-right">Time (ms)</th>
              </tr>
            </thead>
            <tbody>
              {tests.map(test => (
                <tr key={test.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {new Date(test.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs">{test.testType.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-1 text-xs rounded font-medium ${
                        test.testStatus === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {test.testStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700">{test.testMessage}</td>
                  <td className="px-3 py-2 text-right text-xs font-medium">{test.responseTimeMs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
