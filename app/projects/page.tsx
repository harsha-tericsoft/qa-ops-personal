'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAuth } from '@/lib/hooks/useAuth'
import { ProjectForm } from '@/components/forms/ProjectForm'
import { ProjectList } from '@/components/ProjectList'

function ProjectsContent() {
  const router = useRouter()
  const { user } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)

  const handleProjectCreated = () => {
    setRefreshKey(k => k + 1)
  }

  // Only LEAD role can access this page
  if (user && user.role !== 'LEAD') {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600 font-medium">Access Denied</p>
            <p className="text-red-600 text-sm mt-2">
              Only Lead users can manage projects. Contact your administrator if you need project access.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-4 text-blue-600 hover:underline text-sm"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Projects</h1>
        <p className="text-white mb-8">Manage and organize your testing projects</p>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <h2 className="text-lg font-bold text-white mb-4">Create New Project</h2>
            <ProjectForm onSuccess={handleProjectCreated} />
          </div>

          <div className="md:col-span-2">
            <h2 className="text-lg font-bold text-white mb-4">Your Projects</h2>
            <ProjectList key={refreshKey} />
          </div>
        </div>

        <div className="mt-12 bg-blue-50 rounded-lg border border-blue-200 p-6">
          <h3 className="font-bold text-blue-900 mb-2">💡 About Projects</h3>
          <p className="text-blue-800 text-sm">
            Projects organize all your testing activities. Each project has its own repository,
            test suites, execution cycles, and can be configured with Roam Research for test case import.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  return (
    <ProtectedRoute>
      <ProjectsContent />
    </ProtectedRoute>
  )
}
