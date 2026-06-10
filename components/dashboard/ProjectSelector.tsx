'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'

interface Project {
  id: string
  name: string
}

interface ProjectSelectorProps {
  currentProjectId: string
  onProjectChange: (projectId: string) => void
}

export function ProjectSelector({
  currentProjectId,
  onProjectChange,
}: ProjectSelectorProps) {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch('/api/projects')
        if (response.ok) {
          const data = await response.json()
          setProjects(data)
        }
      } catch (error) {
        console.error('Failed to fetch projects:', error)
      } finally {
        setLoading(false)
      }
    }

    // Only fetch if user is LEAD
    if (user?.role === 'LEAD') {
      fetchProjects()
    } else {
      setLoading(false)
    }
  }, [user])

  // Don't show selector for non-LEAD users
  if (user?.role !== 'LEAD') {
    return null
  }

  const currentProject = projects.find((p) => p.id === currentProjectId)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium text-gray-900"
      >
        <span>📁 {loading ? 'Loading...' : currentProject?.name || 'Select Project'}</span>
        <span className="text-xs">▼</span>
      </button>

      {open && !loading && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          {projects.length === 0 ? (
            <div className="px-4 py-2 text-sm text-gray-500">No projects available</div>
          ) : (
            projects.map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  onProjectChange(project.id)
                  setOpen(false)
                }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  project.id === currentProjectId
                    ? 'bg-blue-50 text-blue-900 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {project.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
