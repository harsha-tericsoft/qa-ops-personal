// Request queue to limit concurrent database operations
// Prevents Supabase pgBouncer pool exhaustion by serializing requests

interface QueuedRequest<T> {
  id: string
  fn: () => Promise<T>
  resolve: (value: T) => void
  reject: (error: any) => void
}

class RequestQueue {
  private queue: Array<QueuedRequest<any>> = []
  private activeCount = 0
  private readonly maxConcurrent = 2
  private requestId = 0

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const id = (++this.requestId).toString()

    return new Promise((resolve, reject) => {
      const request: QueuedRequest<T> = { id, fn, resolve, reject }
      this.queue.push(request)
      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
      return
    }

    this.activeCount++
    const request = this.queue.shift()!

    try {
      const result = await request.fn()
      request.resolve(result)
    } catch (error) {
      request.reject(error)
    } finally {
      this.activeCount--
      // Process next request if available
      if (this.queue.length > 0) {
        this.processQueue()
      }
    }
  }

  getStatus() {
    return {
      queueLength: this.queue.length,
      activeCount: this.activeCount,
      totalProcessed: this.requestId,
    }
  }
}

// Singleton instance
const requestQueue = new RequestQueue()

export { requestQueue, RequestQueue }
