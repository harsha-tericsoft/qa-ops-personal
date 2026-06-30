/**
 * Bridge Session Manager
 * High-level session lifecycle management
 */

import { prisma } from '@/lib/prisma'
import { BridgeSessionStatusEnum } from '@/lib/types/bridge'

/**
 * Register a new bridge session
 * Called when Desktop Connector connects for the first time
 */
export async function registerBridgeSession(
  userId: string,
  bridgeId: string,
  bridgeTokenId: string,
  endpoint: string, // e.g., "http://localhost:7890"
  daysValid: number = 90
): Promise<{
  sessionId: string
  success: boolean
  error?: string
}> {
  try {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + daysValid)

    const session = await prisma.bridgeSession.create({
      data: {
        userId,
        bridgeTokenId,
        endpoint,
        status: BridgeSessionStatusEnum.CONNECTED,
        expiresAt,
      },
    })

    return {
      sessionId: session.id,
      success: true,
    }
  } catch (error) {
    console.error('[SessionManager] Error registering session:', error)
    return {
      sessionId: '',
      success: false,
      error: 'REGISTRATION_ERROR',
    }
  }
}

/**
 * Validate a bridge session
 */
export async function validateBridgeSession(
  sessionId: string,
  userId: string
): Promise<{
  valid: boolean
  endpoint?: string
  error?: string
}> {
  try {
    const session = await prisma.bridgeSession.findUnique({
      where: { id: sessionId },
    })

    if (!session) {
      return { valid: false, error: 'SESSION_NOT_FOUND' }
    }

    if (session.userId !== userId) {
      return { valid: false, error: 'USER_MISMATCH' }
    }

    if (session.expiresAt < new Date()) {
      return { valid: false, error: 'SESSION_EXPIRED' }
    }

    if (session.status === BridgeSessionStatusEnum.OFFLINE) {
      return { valid: false, error: 'BRIDGE_OFFLINE' }
    }

    return { valid: true, endpoint: session.endpoint }
  } catch (error) {
    console.error('[SessionManager] Error validating session:', error)
    return { valid: false, error: 'VALIDATION_ERROR' }
  }
}

/**
 * Get user's active bridge session
 */
export async function getUserBridgeSession(
  userId: string
): Promise<{
  sessionId?: string
  endpoint?: string
  status?: string
  error?: string
}> {
  try {
    const session = await prisma.bridgeSession.findFirst({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      include: {
        bridgeToken: true,
      },
    })

    if (!session) {
      return { error: 'NO_ACTIVE_SESSION' }
    }

    return {
      sessionId: session.id,
      endpoint: session.endpoint,
      status: session.status,
    }
  } catch (error) {
    console.error('[SessionManager] Error getting user session:', error)
    return { error: 'GET_SESSION_ERROR' }
  }
}

/**
 * Refresh a bridge session (extend expiration)
 */
export async function refreshBridgeSession(
  sessionId: string,
  daysValid: number = 90
): Promise<{
  success: boolean
  expiresAt?: Date
  error?: string
}> {
  try {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + daysValid)

    const session = await prisma.bridgeSession.update({
      where: { id: sessionId },
      data: {
        expiresAt,
        updatedAt: new Date(),
      },
    })

    return { success: true, expiresAt: session.expiresAt }
  } catch (error) {
    console.error('[SessionManager] Error refreshing session:', error)
    return { success: false, error: 'REFRESH_ERROR' }
  }
}

/**
 * Revoke a bridge session (mark offline)
 */
export async function revokeBridgeSession(sessionId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    await prisma.bridgeSession.update({
      where: { id: sessionId },
      data: {
        status: BridgeSessionStatusEnum.OFFLINE,
        updatedAt: new Date(),
      },
    })

    return { success: true }
  } catch (error) {
    console.error('[SessionManager] Error revoking session:', error)
    return { success: false, error: 'REVOKE_ERROR' }
  }
}

/**
 * Get bridge session status for user
 */
export async function getBridgeSessionStatus(
  userId: string
): Promise<{
  status?: string
  endpoint?: string
  lastHealthCheck?: Date
  error?: string
}> {
  try {
    const session = await prisma.bridgeSession.findFirst({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
    })

    if (!session) {
      return { error: 'NO_SESSION' }
    }

    return {
      status: session.status,
      endpoint: session.endpoint,
      lastHealthCheck: session.lastHealthCheckAt || undefined,
    }
  } catch (error) {
    console.error('[SessionManager] Error getting status:', error)
    return { error: 'STATUS_ERROR' }
  }
}
