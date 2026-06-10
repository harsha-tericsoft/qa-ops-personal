'use client'

import { useState, useEffect } from 'react'

interface Tag {
  id: string
  name: string
  color: string
}

interface RepositoryFiltersProps {
  projectId: string
  onSearchChange: (search: string) => void
  onTagsChange: (tags: string[]) => void
}

export function RepositoryFilters({
  projectId,
  onSearchChange,
  onTagsChange,
}: RepositoryFiltersProps) {
  const [search, setSearch] = useState('')
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [loadingTags, setLoadingTags] = useState(true)

  useEffect(() => {
    fetchTags()
  }, [projectId])

  const fetchTags = async () => {
    try {
      const response = await fetch(`/api/tags?projectId=${projectId}`)
      if (response.ok) {
        const data = await response.json()
        setTags(data)
      }
    } catch {
      setTags([])
    } finally {
      setLoadingTags(false)
    }
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    onSearchChange(value)
  }

  const handleTagToggle = (tagId: string) => {
    const newSelected = new Set(selectedTags)
    if (newSelected.has(tagId)) {
      newSelected.delete(tagId)
    } else {
      newSelected.add(tagId)
    }
    setSelectedTags(newSelected)
    onTagsChange(Array.from(newSelected))
  }

  const handleClearFilters = () => {
    setSearch('')
    setSelectedTags(new Set())
    onSearchChange('')
    onTagsChange([])
  }

  const hasActiveFilters = search || selectedTags.size > 0

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      {/* Search */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-900 mb-2">
          Search Test Cases
        </label>
        <input
          type="text"
          placeholder="Search by name or description..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Tags Filter */}
      {tags.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-3">
            Filter by Tags
          </label>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => handleTagToggle(tag.id)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedTags.has(tag.id)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={handleClearFilters}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  )
}
