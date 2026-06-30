/**
 * Bridge Routing Logic
 * Determines whether to use Bridge or fallback to CLI
 * This logic is additive - existing CLI path is always available as fallback
 */

import { prisma } from '@/lib/prisma'
import { BridgeSessionStatusEnum } from '@/lib/types/bridge'

interface RoutingDecision {
  useBridge: boolean
  bridgeId?: string
  bridgeEndpoint?: string
  bridgeToken?: string
  reason: string
}

/**
 * Decide whether to use Bridge for this request
 * Returns decision object with reasoning
 */
export async function shouldUseBridge(
  userId: string,
  featureFlagEnabled: boolean = false
): Promise<RoutingDecision> {
  // Feature flag must be enabled
  if (!featureFlagEnabled) {
    return {
      useBridge: false,
      reason: 'Bridge feature flag disabled',
    }
  }

  try {
    // Find active bridge session for user
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
      return {
        useBridge: false,
        reason: 'No bridge session found for user',
      }
    }

    // Check session status
    if (session.status === BridgeSessionStatusEnum.OFFLINE) {
      return {
        useBridge: false,
        reason: 'Bridge is offline',
      }
    }

    // Check token validity
    if (session.bridgeToken.status !== 'ACTIVE') {
      return {
        useBridge: false,
        reason: 'Bridge token is not active',
      }
    }

    if (session.bridgeToken.expiresAt < new Date()) {
      return {
        useBridge: false,
        reason: 'Bridge token is expired',
      }
    }

    // All checks passed - use bridge
    return {
      useBridge: true,
      bridgeId: session.bridgeToken.bridgeId,
      bridgeEndpoint: session.endpoint,
      bridgeToken: session.bridgeToken.token,
      reason: 'Bridge is available and healthy',
    }
  } catch (error) {
    console.error('[Routing] Error checking bridge status:', error)
    return {
      useBridge: false,
      reason: 'Error checking bridge status, using CLI fallback',
    }
  }
}

/**
 * Feature flag: whether to enable bridge routing
 * Reads from environment variable (default: disabled for safety)
 */
export function getBridgeFeatureFlag(): boolean {
  return process.env.ENABLE_BRIDGE_ROUTING === 'true'
}

/**
 * Log routing decision for debugging
 */
export function logRoutingDecision(
  requestId: string,
  decision: RoutingDecision,
  action: string
): void {
  console.log(
    `[ROUTING:${requestId}] Action: ${action}, UseBridge: ${decision.useBridge}, Reason: ${decision.reason}`
  )
}
