// Toast notification system for user feedback
interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  duration?: number
}

let toastListener: ((toast: Toast) => void) | null = null
let toastRemoveListener: ((id: string) => void) | null = null

export function setToastListener(listener: (toast: Toast) => void) {
  toastListener = listener
}

export function setToastRemoveListener(listener: (id: string) => void) {
  toastRemoveListener = listener
}

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 4000) {
  if (!toastListener) {
    // Fallback to console if no listener registered
    console.log(`[${type.toUpperCase()}] ${message}`)
    return
  }

  const id = `toast-${Date.now()}-${Math.random()}`
  toastListener({ id, message, type, duration })

  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => {
      if (toastRemoveListener) {
        toastRemoveListener(id)
      }
    }, duration)
  }

  return id
}
