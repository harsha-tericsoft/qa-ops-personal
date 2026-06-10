'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'

export default function LoginPage() {
  const router = useRouter()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    // If user is already logged in, redirect to dashboard
    if (!authLoading && isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, authLoading, router])

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // If user is logged in, don't show login form (will redirect)
  if (isAuthenticated) {
    return null
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        let errorMessage = 'Login failed'
        try {
          const data = await response.json()
          errorMessage = data.error || errorMessage
        } catch {
          errorMessage = `Server error (${response.status}): ${response.statusText}`
        }
        setError(errorMessage)
        return
      }

      const data = await response.json()

      // Store token
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))

      // Redirect to dashboard
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-block w-12 h-12 bg-white rounded-lg flex items-center justify-center mb-4">
            <span className="text-2xl font-bold text-blue-600">QA</span>
          </div>
          <h1 className="text-3xl font-bold text-white">QA Ops Platform</h1>
          <p className="text-blue-100 mt-2">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="bg-white rounded-lg shadow-xl p-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-semibold"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Test Credentials */}
        <div className="mt-8 bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6 text-white">
          <h3 className="font-semibold mb-3 text-lg">🧪 Test Credentials</h3>

          <div className="mb-4 pb-4 border-b border-white border-opacity-20">
            <p className="text-sm font-medium mb-1">Lead Account:</p>
            <p className="text-xs opacity-90">Email: lead@test.com</p>
            <p className="text-xs opacity-90">Password: hashedpassword123</p>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">QA Engineer Account:</p>
            <p className="text-xs opacity-90">Email: engineer@test.com</p>
            <p className="text-xs opacity-90">Password: hashedpassword456</p>
          </div>
        </div>

        {/* Forgot Password */}
        <div className="text-center mt-6">
          <Link href="/forgot-password" className="text-blue-100 hover:text-white text-sm">
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  )
}
