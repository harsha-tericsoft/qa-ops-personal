'use client'

import React from 'react'

interface TestCaseSummaryCardsProps {
  total: number
  byTag?: Record<string, number>
  byType?: Record<string, number>
  loading?: boolean
}

export function TestCaseSummaryCards({
  total,
  byTag = {},
  byType = {},
  loading = false,
}: TestCaseSummaryCardsProps) {
  const cards = [
    {
      label: 'Total Tests',
      value: total,
      color: 'bg-blue-50 border-blue-200',
      textColor: 'text-blue-900',
      valueColor: 'text-blue-600',
    },
    {
      label: 'Manual Tests',
      value: byTag['Manual'] || 0,
      color: 'bg-purple-50 border-purple-200',
      textColor: 'text-purple-900',
      valueColor: 'text-purple-600',
    },
    {
      label: 'Automated Tests',
      value: byTag['Automated'] || 0,
      color: 'bg-green-50 border-green-200',
      textColor: 'text-green-900',
      valueColor: 'text-green-600',
    },
    {
      label: 'Happy Path Tests',
      value: byTag['HappyPath'] || 0,
      color: 'bg-yellow-50 border-yellow-200',
      textColor: 'text-yellow-900',
      valueColor: 'text-yellow-600',
    },
    {
      label: 'Smoke Tests',
      value: byTag['Smoke'] || 0,
      color: 'bg-red-50 border-red-200',
      textColor: 'text-red-900',
      valueColor: 'text-red-600',
    },
    {
      label: 'Regression Tests',
      value: byTag['Regression'] || 0,
      color: 'bg-indigo-50 border-indigo-200',
      textColor: 'text-indigo-900',
      valueColor: 'text-indigo-600',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-lg border p-4 ${card.color}`}
        >
          <p className={`text-sm font-medium ${card.textColor}`}>{card.label}</p>
          <p className={`text-3xl font-bold mt-2 ${card.valueColor}`}>
            {loading ? '...' : card.value}
          </p>
        </div>
      ))}
    </div>
  )
}
