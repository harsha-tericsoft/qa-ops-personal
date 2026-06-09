'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Project {
  id: string
  name: string
  description?: string
  createdAt: string
}

export function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

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

    fetchProjects()
  }, [])

  if (loading) {
    return <div className="text-center py-8">Loading projects...</div>
  }

  if (projects.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Project Name
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Description
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Created
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">
                  {project.name}
                </td>
                <td className="px-6 py-4 text-gray-600 text-sm">
                  {project.description || '-'}
                </td>
                <td className="px-6 py-4 text-gray-600 text-sm">
                  {new Date(project.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm">
                  <Link
                    href={`/projects/${project.id}/dashboard`}
                    className="text-blue-600 hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
