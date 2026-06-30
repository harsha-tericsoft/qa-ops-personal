/**
 * Heartbeat Service
 * Sends heartbeat to backend to keep bridge session alive
 * MVI: Sends immediate heartbeat after registration/resume
 */

import { createLogger } from '../logging/logger'

const logger = createLogger('heartbeat')

export interface HeartbeatRequest {
  bridgeId: string
  token: string
  status: string
  uptime: number
  requestsProcessed: number
  errorsInLast30s: number
  roamStatus: string
  lastError?: string
}

export interface HeartbeatResponse {
  success: boolean
  acknowledged?: boolean
  nextHeartbeatAt?: string
  error?: string
}

export class HeartbeatService {
  private webhookUrl: string = ''
  private bridgeId: string = ''
  private token: string = ''

  /**
   * Start heartbeat service
   * For MVI: Sends one immediate heartbeat
   */
  async start(bridgeId: string, token: string, webhookUrl: string): Promise<boolean> {
    this.bridgeId = bridgeId
    this.token = token
    this.webhookUrl = webhookUrl

    logger.info(`[heartbeat] Starting heartbeat service`)
    logger.info(`[heartbeat] Webhook URL: ${webhookUrl}`)

    // Send immediate heartbeat
    const result = await this.sendHeartbeat()

    if (result.success) {
      logger.info(`[heartbeat] Initial heartbeat sent successfully`)
      return true
    } else {
      logger.warn(`[heartbeat] Initial heartbeat failed: ${result.error}`)
      return false
    }
  }

  /**
   * Send heartbeat to backend
   */
  private async sendHeartbeat(): Promise<HeartbeatResponse> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

      const payload: HeartbeatRequest = {
        bridgeId: this.bridgeId,
        token: this.token,
        status: 'CONNECTED',
        uptime: process.uptime(),
        requestsProcessed: 0,
        errorsInLast30s: 0,
        roamStatus: 'CONNECTED',
      }

      logger.info(`[heartbeat] Sending heartbeat to ${this.webhookUrl}`)

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      logger.info(`[heartbeat] Response status: ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text()
        logger.error(`[heartbeat] Heartbeat failed: ${response.status} ${errorText}`)
        return {
          success: false,
          error: `HTTP ${response.status}`,
        }
      }

      const data = (await response.json()) as HeartbeatResponse

      if (data.success) {
        logger.info(`[heartbeat] Heartbeat acknowledged by backend`)
        return data
      } else {
        logger.error(`[heartbeat] Heartbeat rejected: ${data.error}`)
        return {
          success: false,
          error: data.error || 'Heartbeat rejected',
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.warn(`[heartbeat] Heartbeat error: ${errorMsg}`)
      return {
        success: false,
        error: errorMsg,
      }
    }
  }

  /**
   * Stop heartbeat service (cleanup on shutdown)
   */
  stop(): void {
    logger.info(`[heartbeat] Heartbeat service stopped`)
  }
}

// Singleton instance
let heartbeatInstance: HeartbeatService | null = null

export function getHeartbeatService(): HeartbeatService {
  if (!heartbeatInstance) {
    heartbeatInstance = new HeartbeatService()
  }
  return heartbeatInstance
}
