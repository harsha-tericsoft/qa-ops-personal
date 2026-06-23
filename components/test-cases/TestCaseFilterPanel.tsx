'use client'

import React, { useState } from 'react'

interface FilterOption {
  name: string
  count: number
}

interface TestCaseFilterPanelProps {
  tags?: FilterOption[]
  modules?: FilterOption[]
  types?: FilterOption[]
  selectedTags: string[]
  selectedModule?: string
  selectedType?: string
  searchQuery: string
  onTagToggle: (tag: string) => void
  onModuleChange: (module: string) => void
  onTypeChange: (type: string) => void
  onSearchChange: (query: string) => void
  onClearFilters: () => void
  loading?: boolean
}

export function TestCaseFilterPanel({
  tags = [],
  modules = [],
  types = [],
  selectedTags,
  selectedModule,
  selectedType,
  searchQuery,
  onTagToggle,
  onModuleChange,
  onTypeChange,
  onSearchChange,
  onClearFilters,
  loading = false,
}: TestCaseFilterPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    search: true,
    tags: true,
    module: true,
    type: true,
  })

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const hasActiveFilters = selectedTags.length > 0 || selectedModule || selectedType || searchQuery

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">Filters</h2>
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="font-medium text-gray-900">Search</label>
          <button
            onClick={() => toggleSection('search')}
            className="text-gray-500 hover:text-gray-700"
          >
            {expandedSections.search ? '▼' : '▶'}
          </button>
        </div>
        {expandedSections.search && (
          <input
            type="text"
            placeholder="Search test statements..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          />
        )}
      </div>

      {/* Tags */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="font-medium text-gray-900">Tags</label>
          <button
            onClick={() => toggleSection('tags')}
            className="text-gray-500 hover:text-gray-700"
          >
            {expandedSections.tags ? '▼' : '▶'}
          </button>
        </div>
        {expandedSections.tags && (
          <div className="space-y-2">
            {tags.length === 0 ? (
              <p className="text-sm text-gray-500">No tags available</p>
            ) : (
              tags.map((tag) => (
                <label key={tag.name} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(tag.name)}
                    onChange={() => onTagToggle(tag.name)}
                    disabled={loading}
                    className="w-4 h-4 rounded border-gray-300 disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700">
                    {tag.name} <span className="text-gray-500">({tag.count})</span>
                  </span>
                </label>
              ))
            )}
          </div>
        )}
      </div>

      {/* Module */}
      {modules.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="font-medium text-gray-900">Module</label>
            <button
              onClick={() => toggleSection('module')}
              className="text-gray-500 hover:text-gray-700"
            >
              {expandedSections.module ? '▼' : '▶'}
            </button>
          </div>
          {expandedSections.module && (
            <select
              value={selectedModule || ''}
              onChange={(e) => onModuleChange(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="">All Modules</option>
              {modules.map((module) => (
                <option key={module.name} value={module.name}>
                  {module.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Type */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="font-medium text-gray-900">Type</label>
          <button
            onClick={() => toggleSection('type')}
            className="text-gray-500 hover:text-gray-700"
          >
            {expandedSections.type ? '▼' : '▶'}
          </button>
        </div>
        {expandedSections.type && (
          <select
            value={selectedType || ''}
            onChange={(e) => onTypeChange(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          >
            <option value="">All Types</option>
            <option value="Manual">Manual</option>
            <option value="Automated">Automated</option>
          </select>
        )}
      </div>
    </div>
  )
}
