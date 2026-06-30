/**
 * Bridge Token Manager
 * Handles generation, validation, and refresh of bridge authentication tokens
 */

import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { BridgeTokenStatusEnum } from '@/lib/types/bridge'

/**
 * Generate a cryptographically secure random token
 * Format: qop_bridge_<32 random chars>
 */
export function generateBridgeToken(): string {
  const randomPart = randomBytes(24).toString('hex') // 48 hex chars = 24 bytes
  return `qop_bridge_${randomPart}`
}

/**
 * Validate a bridge token
 * Checks: token exists, is active, not expired, user matches
 */
export async function validateBridgeToken(
  token: string,
  userId?: string
): Promise<{
  valid: boolean
  bridgeId?: string
  userId?: string
  error?: string
  shouldRefresh?: boolean
}> {
  try {
    // Find token in database
    const bridgeToken = await prisma.bridgeToken.findUnique({
      where: { token },
    })

    if (!bridgeToken) {
      return {
        valid: false,
        error: 'TOKEN_NOT_FOUND',
      }
    }

    // Check if user matches (if provided)
    if (userId && bridgeToken.userId !== userId) {
      return {
        valid: false,
        error: 'USER_MISMATCH',
      }
    }

    // Check if token is active
    if (bridgeToken.status !== BridgeTokenStatusEnum.ACTIVE) {
      return {
        valid: false,
        error: 'TOKEN_INACTIVE',
        bridgeId: bridgeToken.bridgeId,
        userId: bridgeToken.userId,
      }
    }

    // Check if token is expired
    if (bridgeToken.expiresAt < new Date()) {
      return {
        valid: false,
        error: 'TOKEN_EXPIRED',
        bridgeId: bridgeToken.bridgeId,
        userId: bridgeToken.userId,
      }
    }

    // Check if token should be refreshed (< 7 days to expiry)
    const daysUntilExpiry = Math.floor(
      (bridgeToken.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    const shouldRefresh = daysUntilExpiry < 7

    // Update lastUsedAt
    await prisma.bridgeToken.update({
      where: { id: bridgeToken.id },
      data: { lastUsedAt: new Date() },
    })

    return {
      valid: true,
      bridgeId: bridgeToken.bridgeId,
      userId: bridgeToken.userId,
      shouldRefresh,
    }
  } catch (error) {
    console.error('[TokenManager] Error validating token:', error)
    return {
      valid: false,
      error: 'VALIDATION_ERROR',
    }
  }
}

/**
 * Create a new bridge token (during registration)
 */
export async function createBridgeToken(
  userId: string,
  bridgeId: string,
  graphName: string,
  daysValid: number = 90
): Promise<{
  token: string
  expiresAt: Date
  error?: string
}> {
  try {
    // Check if bridge already registered
    const existing = await prisma.bridgeToken.findUnique({
      where: { bridgeId },
    })

    if (existing) {
      return {
        token: '',
        expiresAt: new Date(),
        error: 'BRIDGE_ALREADY_REGISTERED',
      }
    }

    // Generate token
    const token = generateBridgeToken()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + daysValid)

    // Store token
    const bridgeToken = await prisma.bridgeToken.create({
      data: {
        userId,
        bridgeId,
        token,
        graphName,
        status: BridgeTokenStatusEnum.ACTIVE,
        expiresAt,
      },
    })

    return {
      token: bridgeToken.token,
      expiresAt: bridgeToken.expiresAt,
    }
  } catch (error) {
    console.error('[TokenManager] Error creating token:', error)
    return {
      token: '',
      expiresAt: new Date(),
      error: 'CREATION_ERROR',
    }
  }
}

/**
 * Refresh a bridge token (extend expiry)
 */
export async function refreshBridgeToken(
  tokenId: string,
  daysValid: number = 90
): Promise<{
  token?: string
  expiresAt?: Date
  error?: string
}> {
  try {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + daysValid)

    const updatedToken = await prisma.bridgeToken.update({
      where: { id: tokenId },
      data: {
        token: generateBridgeToken(),
        expiresAt,
      },
    })

    return {
      token: updatedToken.token,
      expiresAt: updatedToken.expiresAt,
    }
  } catch (error) {
    console.error('[TokenManager] Error refreshing token:', error)
    return {
      error: 'REFRESH_ERROR',
    }
  }
}

/**
 * Revoke a bridge token
 */
export async function revokeBridgeToken(bridgeId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    await prisma.bridgeToken.update({
      where: { bridgeId },
      data: { status: BridgeTokenStatusEnum.REVOKED },
    })

    return { success: true }
  } catch (error) {
    console.error('[TokenManager] Error revoking token:', error)
    return {
      success: false,
      error: 'REVOKE_ERROR',
    }
  }
}

/**
 * Get token info by bridgeId
 */
export async function getBridgeTokenInfo(
  bridgeId: string
): Promise<{
  token?: string
  userId?: string
  graphName?: string
  expiresAt?: Date
  status?: string
  error?: string
}> {
  try {
    const bridgeToken = await prisma.bridgeToken.findUnique({
      where: { bridgeId },
    })

    if (!bridgeToken) {
      return { error: 'TOKEN_NOT_FOUND' }
    }

    return {
      token: bridgeToken.token,
      userId: bridgeToken.userId,
      graphName: bridgeToken.graphName,
      expiresAt: bridgeToken.expiresAt,
      status: bridgeToken.status,
    }
  } catch (error) {
    console.error('[TokenManager] Error getting token info:', error)
    return { error: 'GET_INFO_ERROR' }
  }
}

/**
 * Mask token for logging (show only first 8 chars)
 */
export function maskToken(token: string): string {
  if (!token || token.length < 8) return '***'
  return `${token.substring(0, 8)}...`
}
