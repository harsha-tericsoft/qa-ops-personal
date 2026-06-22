'use client'

import { useState, useEffect } from 'react'
import { setToastListener, setToastRemoveListener } from '@/lib/toast'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    setToastListener((toast) => {
      setToasts(prev => [...prev, toast])
    })

    setToastRemoveListener((id) => {
      setToasts(prev => prev.filter(t => t.id !== id))
    })
  }, [])

  return (
    <div className="fixed top-4 right-4 z-40 space-y-2 max-w-md">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg shadow-lg text-white font-medium flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-green-600'
              : toast.type === 'error'
              ? 'bg-red-600'
              : 'bg-blue-600'
          }`}
        >
          {toast.type === 'success' && '✓'}
          {toast.type === 'error' && '✕'}
          {toast.type === 'info' && 'ℹ'}
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  )
}
