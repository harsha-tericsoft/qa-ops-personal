// Application-level semaphore to prevent connection pool exhaustion
// Limits concurrent database operations to stay within Supabase PgBouncer limits

class ConnectionLimiter {
  private activeConnections = 0
  private maxConnections: number
  private queue: Array<(value?: any) => void> = []

  constructor(maxConnections: number = 8) {
    this.maxConnections = maxConnections
  }

  async acquire<T>(fn: () => Promise<T>): Promise<T> {
    while (this.activeConnections >= this.maxConnections) {
      // Wait for a connection to be released
      await new Promise(resolve => {
        this.queue.push(resolve as (value?: any) => void)
      })
    }

    this.activeConnections++

    try {
      return await fn()
    } finally {
      this.activeConnections--
      const resolve = this.queue.shift()
      if (resolve) {
        resolve()
      }
    }
  }

  getStats() {
    return {
      activeConnections: this.activeConnections,
      maxConnections: this.maxConnections,
      queuedRequests: this.queue.length,
    }
  }
}

// Global instance - shared across all API routes
// Using 16 to match typical Supabase PgBouncer limits
export const connectionLimiter = new ConnectionLimiter(16)

export async function withConnectionLimit<T>(fn: () => Promise<T>): Promise<T> {
  return connectionLimiter.acquire(fn)
}
