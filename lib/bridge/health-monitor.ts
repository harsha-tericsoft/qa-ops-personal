/**
 * Bridge Health Monitor
 * Tracks bridge connection state, detects offline/degraded conditions
 */

import { prisma } from '@/lib/prisma'
import { BridgeSessionStatusEnum } from '@/lib/types/bridge'

/**
 * Update bridge session status
 */
export async function updateBridgeSessionStatus(
  userId: string,
  bridgeId: string,
  status: BridgeSessionStatusEnum
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // Find bridge token
    const bridgeToken = await prisma.bridgeToken.findUnique({
      where: { bridgeId },
    })

    if (!bridgeToken) {
      return {
        success: false,
        error: 'BRIDGE_TOKEN_NOT_FOUND',
      }
    }

    // Find and update session
    const session = await prisma.bridgeSession.findFirst({
      where: {
        userId,
        bridgeTokenId: bridgeToken.id,
      },
    })

    if (!session) {
      return {
        success: false,
        error: 'SESSION_NOT_FOUND',
      }
    }

    await prisma.bridgeSession.update({
      where: { id: session.id },
      data: {
        status,
        lastHealthCheckAt: new Date(),
        lastHealthCheckStatus: `Status updated to ${status}`,
      },
    })

    return { success: true }
  } catch (error) {
    console.error('[HealthMonitor] Error updating session status:', error)
    return {
      success: false,
      error: 'UPDATE_ERROR',
    }
  }
}

/**
 * Mark bridge as connected (successful heartbeat)
 */
export async function markBridgeConnected(
  bridgeId: string,
  healthCheckStatus?: string
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const bridgeToken = await prisma.bridgeToken.findUnique({
      where: { bridgeId },
    })

    if (!bridgeToken) {
      return {
        success: false,
        error: 'BRIDGE_TOKEN_NOT_FOUND',
      }
    }

    await prisma.bridgeSession.updateMany({
      where: { bridgeTokenId: bridgeToken.id },
      data: {
        status: BridgeSessionStatusEnum.CONNECTED,
        lastHealthCheckAt: new Date(),
        lastHealthCheckStatus: healthCheckStatus || 'Heartbeat received',
      },
    })

    return { success: true }
  } catch (error) {
    console.error('[HealthMonitor] Error marking connected:', error)
    return {
      success: false,
      error: 'MARK_ERROR',
    }
  }
}

/**
 * Mark bridge as offline (failed healthcheck)
 */
export async function markBridgeOffline(
  bridgeId: string,
  errorMessage?: string
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const bridgeToken = await prisma.bridgeToken.findUnique({
      where: { bridgeId },
    })

    if (!bridgeToken) {
      return {
        success: false,
        error: 'BRIDGE_TOKEN_NOT_FOUND',
      }
    }

    await prisma.bridgeSession.updateMany({
      where: { bridgeTokenId: bridgeToken.id },
      data: {
        status: BridgeSessionStatusEnum.OFFLINE,
        lastHealthCheckAt: new Date(),
        lastHealthCheckStatus: errorMessage || 'Bridge offline',
      },
    })

    return { success: true }
  } catch (error) {
    console.error('[HealthMonitor] Error marking offline:', error)
    return {
      success: false,
      error: 'MARK_ERROR',
    }
  }
}

/**
 * Mark bridge as degraded (intermittent failures)
 */
export async function markBridgeDegraded(
  bridgeId: string,
  errorMessage?: string
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const bridgeToken = await prisma.bridgeToken.findUnique({
      where: { bridgeId },
    })

    if (!bridgeToken) {
      return {
        success: false,
        error: 'BRIDGE_TOKEN_NOT_FOUND',
      }
    }

    await prisma.bridgeSession.updateMany({
      where: { bridgeTokenId: bridgeToken.id },
      data: {
        status: BridgeSessionStatusEnum.DEGRADED,
        lastHealthCheckAt: new Date(),
        lastHealthCheckStatus: errorMessage || 'Bridge degraded',
      },
    })

    return { success: true }
  } catch (error) {
    console.error('[HealthMonitor] Error marking degraded:', error)
    return {
      success: false,
      error: 'MARK_ERROR',
    }
  }
}

/**
 * Get bridge health status
 */
export async function getBridgeHealth(
  bridgeId: string
): Promise<{
  status?: BridgeSessionStatusEnum
  lastHealthCheckAt?: Date
  lastHealthCheckStatus?: string
  uptime?: string
  error?: string
}> {
  try {
    const bridgeToken = await prisma.bridgeToken.findUnique({
      where: { bridgeId },
    })

    if (!bridgeToken) {
      return { error: 'BRIDGE_TOKEN_NOT_FOUND' }
    }

    const session = await prisma.bridgeSession.findFirst({
      where: { bridgeTokenId: bridgeToken.id },
    })

    if (!session) {
      return { error: 'SESSION_NOT_FOUND' }
    }

    // Calculate uptime
    const uptimeMs = Date.now() - session.createdAt.getTime()
    const uptimeHours = Math.floor(uptimeMs / (1000 * 60 * 60))
    const uptimeMinutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60))
    const uptime = `${uptimeHours}h ${uptimeMinutes}m`

    return {
      status: session.status as BridgeSessionStatusEnum,
      lastHealthCheckAt: session.lastHealthCheckAt || session.createdAt,
      lastHealthCheckStatus: session.lastHealthCheckStatus || 'No health check',
      uptime,
    }
  } catch (error) {
    console.error('[HealthMonitor] Error getting health:', error)
    return { error: 'GET_HEALTH_ERROR' }
  }
}

/**
 * Cleanup expired bridge sessions
 * Run periodically to remove sessions for expired tokens
 */
export async function cleanupExpiredBridges(): Promise<{
  deletedCount: number
  error?: string
}> {
  try {
    const result = await prisma.bridgeSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    })

    return { deletedCount: result.count }
  } catch (error) {
    console.error('[HealthMonitor] Error cleaning up expired bridges:', error)
    return {
      deletedCount: 0,
      error: 'CLEANUP_ERROR',
    }
  }
}

// Health check job state
let healthCheckJob: NodeJS.Timeout | null = null
const failureCountMap = new Map<string, number>()

/**
 * Start periodic health check job
 */
export function startHealthCheckJob(intervalMs: number = 30000): void {
  if (healthCheckJob) {
    console.warn('[HealthCheckJob] Job already running')
    return
  }

  console.log(`[HealthCheckJob] Starting health check job (interval: ${intervalMs}ms)`)

  healthCheckJob = setInterval(async () => {
    try {
      const sessions = await prisma.bridgeSession.findMany({
        where: {
          expiresAt: { gt: new Date() },
        },
        include: { bridgeToken: true },
      })

      for (const session of sessions) {
        await performHealthCheck(session)
      }
    } catch (error) {
      console.error('[HealthCheckJob] Error in health check cycle:', error)
    }
  }, intervalMs)
}

/**
 * Stop health check job
 */
export function stopHealthCheckJob(): void {
  if (healthCheckJob) {
    clearInterval(healthCheckJob)
    healthCheckJob = null
    failureCountMap.clear()
    console.log('[HealthCheckJob] Stopped health check job')
  }
}

/**
 * Perform health check for a single bridge session
 */
async function performHealthCheck(session: any): Promise<void> {
  const sessionId = session.id
  const bridgeId = session.bridgeToken?.bridgeId

  if (!bridgeId) {
    console.warn(`[HealthCheck] Session ${sessionId} has no bridge ID`)
    return
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

    const response = await fetch(`${session.endpoint}/api/health`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.bridgeToken?.token}`,
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      // Success - mark connected and clear failure count
      failureCountMap.delete(sessionId)
      await markBridgeConnected(bridgeId, 'Health check successful')
    } else {
      // HTTP error - mark degraded
      const failureCount = (failureCountMap.get(sessionId) || 0) + 1
      failureCountMap.set(sessionId, failureCount)

      if (failureCount >= 3) {
        await markBridgeOffline(bridgeId, `Health check failed (${response.status})`)
      } else {
        await markBridgeDegraded(bridgeId, `Health check returned ${response.status}`)
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    const failureCount = (failureCountMap.get(sessionId) || 0) + 1
    failureCountMap.set(sessionId, failureCount)

    if (failureCount >= 3) {
      await markBridgeOffline(bridgeId, `Health check failed: ${errorMsg}`)
    } else {
      await markBridgeDegraded(bridgeId, `Health check error: ${errorMsg}`)
    }
  }
}
