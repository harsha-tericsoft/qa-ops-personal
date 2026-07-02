/**
 * Bridge Client
 * HTTP client for communicating with local Desktop Connector bridges
 */

import { BridgeResponse } from '@/lib/types/bridge'

interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: Record<string, unknown>
  timeout?: number
  retries?: number
}

interface RequestConfig {
  endpoint: string // e.g., "http://localhost:7890"
  token: string // Bridge authentication token
  userId: string // For request headers
  requestId?: string // Unique request ID for tracing
}

/**
 * Make a request to the bridge
 */
async function makeRequest<T = unknown>(
  config: RequestConfig,
  path: string,
  options: RequestOptions
): Promise<BridgeResponse<T>> {
  const {
    endpoint,
    token,
    userId,
    requestId = generateRequestId(),
  } = config
  const { method, body, timeout = 60000, retries = 1 } = options

  const url = `${endpoint}${path}`

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-User-Id': userId,
    'X-Request-Id': requestId,
  }

  console.log(`[BridgeClient] ===== HTTP REQUEST DIAGNOSTIC =====`)
  console.log(`[BridgeClient] Method: ${method}`)
  console.log(`[BridgeClient] Full URL: ${url}`)
  console.log(`[BridgeClient] Endpoint: ${endpoint}`)
  console.log(`[BridgeClient] Path: ${path}`)
  console.log(`[BridgeClient] Timeout: ${timeout}ms`)
  console.log(`[BridgeClient] Retries: ${retries}`)
  console.log(`[BridgeClient] Headers: Authorization=${headers.Authorization.substring(0, 20)}..., Content-Type=${headers['Content-Type']}, X-User-Id=${headers['X-User-Id']}, X-Request-Id=${headers['X-Request-Id']}`)
  console.log(`[BridgeClient] Body: ${body ? JSON.stringify(body).substring(0, 100) : 'none'}`)
  console.log(`[BridgeClient] ======================================`)

  console.log(`[BridgeClient] Request: ${method} ${path} | Endpoint: ${endpoint} | Timeout: ${timeout}ms`)

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[BridgeClient] Retry attempt ${attempt + 1}/${retries + 1}`)
      }

      console.log(`[BridgeClient] Attempt ${attempt + 1}: Initiating fetch()...`)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      console.log(`[BridgeClient] Attempt ${attempt + 1}: Sending ${method} request to ${url}`)
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      console.log(`[BridgeClient] Attempt ${attempt + 1}: Response received, status=${response.status}`)

      if (!response.ok) {
        if (response.status === 401) {
          return {
            success: false,
            error: 'Bridge authentication failed',
            code: 'BRIDGE_AUTH_FAILED',
            requestId,
          }
        }

        if (response.status === 500) {
          // Server error, could retry
          if (attempt < retries) {
            lastError = new Error(`Bridge returned ${response.status}`)
            await delay(500 * (attempt + 1)) // Exponential backoff
            continue
          }

          return {
            success: false,
            error: 'Bridge server error',
            code: 'BRIDGE_SERVER_ERROR',
            requestId,
          }
        }

        const errorText = await response.text()
        return {
          success: false,
          error: errorText || `Bridge returned ${response.status}`,
          code: `BRIDGE_HTTP_${response.status}`,
          requestId,
        }
      }

      const data = await response.json()
      console.log(`[BridgeClient] Success: ${method} ${path} | Status: ${response.status}`)
      return {
        success: data.success || true,
        data: data.data || data,
        requestId,
      }
    } catch (error) {
      lastError = error as Error
      const errorMsg = error instanceof Error ? error.message : String(error)

      console.error(`[BridgeClient] ===== CATCH BLOCK ERROR =====`)
      console.error(`[BridgeClient] Error Type: ${error?.constructor?.name}`)
      console.error(`[BridgeClient] Error Message: ${errorMsg}`)
      console.error(`[BridgeClient] Error Stack: ${error instanceof Error ? error.stack : 'N/A'}`)
      console.error(`[BridgeClient] Full Error: ${JSON.stringify(error)}`)
      console.error(`[BridgeClient] ==============================`)

      if (error instanceof TypeError && error.message.includes('fetch')) {
        // Network error (connection refused, host unreachable, etc.)
        console.warn(`[BridgeClient] Detected network error in fetch: ${errorMsg}`)
        if (attempt < retries) {
          console.log(`[BridgeClient] Retrying after network error...`)
          await delay(500 * (attempt + 1))
          continue
        }

        console.error(`[BridgeClient] Network error after ${attempt + 1} attempts, falling back to CLI`)
        return {
          success: false,
          error: 'Could not reach bridge (network error)',
          code: 'BRIDGE_UNREACHABLE',
          requestId,
        }
      }

      if (error instanceof Error && error.name === 'AbortError') {
        // Timeout
        console.warn(`[BridgeClient] Request timeout after ${timeout}ms`)
        if (attempt < retries) {
          console.log(`[BridgeClient] Retrying after timeout...`)
          await delay(500 * (attempt + 1))
          continue
        }

        console.error(`[BridgeClient] Timeout after ${attempt + 1} attempts, falling back to CLI`)
        return {
          success: false,
          error: `Bridge request timeout (${timeout}ms)`,
          code: 'BRIDGE_TIMEOUT',
          requestId,
        }
      }

      // Unexpected error
      console.error(`[BridgeClient] Unexpected error: ${errorMsg}`)
      return {
        success: false,
        error: lastError?.message || 'Unknown error',
        code: 'BRIDGE_ERROR',
        requestId,
      }
    }
  }

  // All retries exhausted
  return {
    success: false,
    error: lastError?.message || 'Bridge request failed',
    code: 'BRIDGE_EXHAUSTED_RETRIES',
    requestId,
  }
}

/**
 * Test connection to bridge
 */
export async function testBridgeConnection(
  config: RequestConfig,
  graphName: string,
  apiToken: string
): Promise<BridgeResponse> {
  return makeRequest(config, '/api/roam/test-connection', {
    method: 'POST',
    body: { graphName, apiToken },
  })
}

/**
 * Sync test cases via bridge
 */
export async function syncTestCases(
  config: RequestConfig,
  projectId: string,
  syncType: 'initial' | 'refresh',
  graphName: string,
  apiToken: string,
  repositoryRootPage: string
): Promise<BridgeResponse> {
  return makeRequest(config, '/api/roam/sync', {
    method: 'POST',
    body: { projectId, syncType, graphName, apiToken, repositoryRootPage },
  })
}

/**
 * Search pages/blocks via bridge
 */
export async function searchBridge(
  config: RequestConfig,
  graphName: string,
  apiToken: string,
  query: string,
  limit?: number
): Promise<BridgeResponse> {
  return makeRequest(config, '/api/roam/search', {
    method: 'POST',
    body: { graphName, apiToken, query, limit },
  })
}

/**
 * Fetch a specific page via bridge
 */
export async function fetchPageFromBridge(
  config: RequestConfig,
  pageTitle: string
): Promise<BridgeResponse> {
  return makeRequest(config, `/api/roam/pages/${encodeURIComponent(pageTitle)}`, {
    method: 'GET',
  })
}

/**
 * Export data from bridge
 */
export async function exportFromBridge(
  config: RequestConfig,
  projectId: string
): Promise<BridgeResponse> {
  return makeRequest(config, '/api/roam/export', {
    method: 'POST',
    body: { projectId },
    timeout: 120000, // 2 minute timeout for export
  })
}

/**
 * Import data via bridge
 */
export async function importToBridge(
  config: RequestConfig,
  projectId: string,
  data: unknown
): Promise<BridgeResponse> {
  return makeRequest(config, '/api/roam/import', {
    method: 'POST',
    body: { projectId, data },
  })
}

/**
 * Get bridge health status
 */
export async function getBridgeHealthStatus(
  config: RequestConfig
): Promise<BridgeResponse> {
  return makeRequest(config, '/api/health', {
    method: 'GET',
    timeout: 10000, // Quick timeout for health check
  })
}

/**
 * Helper: Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`
}

/**
 * Helper: Delay for exponential backoff
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Parse bridge response and extract actual data
 */
export function parseBridgeResponse<T = unknown>(
  response: BridgeResponse<T>
): T | null {
  if (response.success && response.data) {
    return response.data as T
  }
  return null
}
