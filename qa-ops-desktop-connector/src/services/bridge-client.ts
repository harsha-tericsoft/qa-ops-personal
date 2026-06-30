/**
 * Bridge Registration Client
 * HTTP client for registering Desktop Connector with QA Ops backend
 */

import os from 'os'
import { createLogger } from '../logging/logger'

const logger = createLogger('bridge-client')

export interface BridgeRegisterRequest {
  bridgeId: string
  graphName: string
  version: string
  os?: string
  hostname?: string
}

export interface BridgeRegisterResponse {
  success: boolean
  bridgeToken?: string
  expiresAt?: string
  webhookUrl?: string
  graphName?: string
  error?: string
  code?: string
}

/**
 * Register Desktop Connector with QA Ops backend
 * Creates BridgeToken and BridgeSession in database
 */
export async function registerWithBackend(
  backendUrl: string,
  payload: BridgeRegisterRequest
): Promise<BridgeRegisterResponse | null> {
  const url = `${backendUrl}/api/bridge/register`

  logger.info(`[registerWithBackend] Starting registration at ${url}`)
  logger.info(`[registerWithBackend] Bridge: ${payload.bridgeId}, Graph: ${payload.graphName}`)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token', // For MVP/testing
      },
      body: JSON.stringify({
        bridgeId: payload.bridgeId,
        graphName: payload.graphName,
        version: payload.version,
        os: payload.os || process.platform,
        hostname: payload.hostname || os.hostname(),
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    logger.info(`[registerWithBackend] Response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`[registerWithBackend] Registration failed: ${response.status} ${errorText}`)
      return {
        success: false,
        error: `HTTP ${response.status}`,
        code: `REGISTER_HTTP_${response.status}`,
      }
    }

    const data = (await response.json()) as BridgeRegisterResponse

    if (data.success && data.bridgeToken) {
      logger.info(`[registerWithBackend] Registration successful`)
      logger.info(`[registerWithBackend] Token expires: ${data.expiresAt}`)
      return data
    } else {
      logger.error(`[registerWithBackend] Registration returned success=false`)
      return {
        success: false,
        error: data.error || 'Registration failed',
        code: data.code || 'REGISTER_FAILED',
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)

    if (error instanceof TypeError && errorMsg.includes('fetch')) {
      logger.error(`[registerWithBackend] Network error: ${errorMsg}`)
      return {
        success: false,
        error: 'Network error (connection refused)',
        code: 'REGISTER_NETWORK_ERROR',
      }
    }

    if (error instanceof Error && error.name === 'AbortError') {
      logger.error(`[registerWithBackend] Request timeout`)
      return {
        success: false,
        error: 'Request timeout',
        code: 'REGISTER_TIMEOUT',
      }
    }

    logger.error(`[registerWithBackend] Unexpected error: ${errorMsg}`)
    return {
      success: false,
      error: errorMsg,
      code: 'REGISTER_ERROR',
    }
  }
}
