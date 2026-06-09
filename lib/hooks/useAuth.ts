'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export interface User {
  id: string
  email: string
  name: string
  role: 'LEAD' | 'QA_ENGINEER'
}

export function useAuth() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')

    if (token && userStr) {
      try {
        const userData = JSON.parse(userStr) as User
        setUser(userData)
        setIsAuthenticated(true)
      } catch (error) {
        logout()
      }
    }

    setLoading(false)
  }, [])

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    setIsAuthenticated(false)
    router.push('/login')
  }

  const login = (newUser: User, token: string) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(newUser))
    setUser(newUser)
    setIsAuthenticated(true)
  }

  return {
    user,
    loading,
    isAuthenticated,
    logout,
    login,
  }
}
