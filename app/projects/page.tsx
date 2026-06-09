'use client'

import { useState } from 'react'
import { ProjectForm } from '@/components/forms/ProjectForm'
import { ProjectList } from '@/components/ProjectList'

export default function ProjectsPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  const handleProjectCreated = () => {
    setRefreshKey(k => k + 1)
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Projects</h1>
        <p className="text-gray-600 mb-8">Manage and organize your testing projects</p>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Create New Project</h2>
            <ProjectForm onSuccess={handleProjectCreated} />
          </div>

          <div className="md:col-span-2">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Your Projects</h2>
            <ProjectList key={refreshKey} />
          </div>
        </div>

        <div className="mt-12 bg-blue-50 rounded-lg border border-blue-200 p-6">
          <h3 className="font-bold text-blue-900 mb-2">💡 About Projects</h3>
          <p className="text-blue-800 text-sm">
            Projects organize all your testing activities. Each project has its own test cases,
            execution cycles, and can be configured with a Roam Research workspace for hierarchy sync.
          </p>
        </div>
      </div>
    </div>
  )
}
