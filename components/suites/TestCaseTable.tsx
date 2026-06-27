'use client'

import { TestCase } from '@prisma/client'

interface TestCaseTableProps {
  testCases: { testCase: TestCase; order: number }[]
  onRemove?: (testCaseId: string) => void
}

export function TestCaseTable({ testCases, onRemove }: TestCaseTableProps) {
  if (testCases.length === 0) {
    return <p className="text-center text-gray-500 py-8">No test cases selected</p>
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-gray-600">#</th>
            <th className="px-4 py-2 text-left font-medium text-gray-600">Test Case</th>
            {onRemove && <th className="px-4 py-2 text-right font-medium text-gray-600">Action</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {testCases.map(({ testCase, order }, index) => (
            <tr key={testCase.id} className="hover:bg-gray-50">
              <td className="px-4 py-2 text-gray-600">{index + 1}</td>
              <td className="px-4 py-2">
                <div className="font-medium">{testCase.title}</div>
                {testCase.description && (
                  <div className="text-xs text-gray-500">{testCase.description}</div>
                )}
              </td>
              {onRemove && (
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => onRemove(testCase.id)}
                    className="text-red-600 hover:text-red-800 text-xs"
                  >
                    Remove
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
