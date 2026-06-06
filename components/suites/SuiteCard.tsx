'use client'

import Link from 'next/link'
import { TestSuite } from '@/app/generated/prisma'
import { SuiteCategoryBadge } from './SuiteCategoryBadge'
import { formatDate } from '@/lib/utils/formatters'

interface SuiteCardProps {
  suite: TestSuite & {
    testCases: { testCase: { id: string } }[]
    usedInCycles: { createdAt: Date }[]
  }
}

export function SuiteCard({ suite }: SuiteCardProps) {
  const testCount = suite.testCases.length
  const lastUsed = suite.usedInCycles[0]?.createdAt

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-lg">{suite.name}</h3>
          <p className="text-sm text-gray-600">{suite.description}</p>
        </div>
        <SuiteCategoryBadge category={suite.category} />
      </div>

      <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
        <span className="bg-gray-100 px-2 py-1 rounded">{testCount} tests</span>
        {lastUsed && (
          <span>Last used: {formatDate(lastUsed)}</span>
        )}
      </div>

      <div className="flex gap-2">
        <Link
          href={`/suites/${suite.id}`}
          className="flex-1 px-3 py-2 text-center text-sm bg-gray-100 rounded hover:bg-gray-200"
        >
          View
        </Link>
        <Link
          href={`/suites/${suite.id}/edit`}
          className="flex-1 px-3 py-2 text-center text-sm bg-gray-100 rounded hover:bg-gray-200"
        >
          Edit
        </Link>
        <button className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
          Run
        </button>
      </div>
    </div>
  )
}
