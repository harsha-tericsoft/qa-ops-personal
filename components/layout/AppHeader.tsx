'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'
import { useState } from 'react'

export function AppHeader() {
  const { user, logout } = useAuth()
  const [showMenu, setShowMenu] = useState(false)

  if (!user) {
    return (
      <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
              QA
            </div>
            <h1 className="text-xl font-bold text-gray-900">QA Ops Platform</h1>
          </Link>
        </div>
      </header>
    )
  }

  const getRoleBadge = (role: string) => {
    if (role === 'LEAD') {
      return <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">👑 Lead</span>
    }
    return <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">🧪 QA Engineer</span>
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
            QA
          </div>
          <h1 className="text-xl font-bold text-gray-900">QA Ops Platform</h1>
        </Link>

        <div className="flex items-center gap-4">
          {getRoleBadge(user.role)}

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-sm font-bold text-gray-700">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-gray-900">{user.name}</span>
              <span className="text-xs text-gray-500">▼</span>
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-200">
                  <p className="text-sm font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>

                <button
                  onClick={() => {
                    logout()
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  🚪 Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
