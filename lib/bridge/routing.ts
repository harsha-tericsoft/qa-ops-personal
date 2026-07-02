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
 * Get configured Desktop Connector endpoint
 */
export function getBridgeEndpoint(): string {
  return process.env.BRIDGE_ENDPOINT || 'http://localhost:7890'
}

/**
 * Get configured request timeout in milliseconds
 */
export function getBridgeRequestTimeout(): number {
  const timeout = parseInt(process.env.BRIDGE_REQUEST_TIMEOUT_MS || '5000', 10)
  return isNaN(timeout) ? 5000 : timeout
}

/**
 * Decide whether to use Bridge for this request
 * Returns decision object with reasoning
 *
 * Routing Logic:
 * 1. Check feature flag (must be enabled)
 * 2. Find active bridge session for user
 * 3. Validate session status (not OFFLINE)
 * 4. Validate token (ACTIVE, not expired)
 * 5. Return decision with configuration
 *
 * If any check fails, return useBridge: false with reason
 */
export async function shouldUseBridge(
  userId: string,
  featureFlagEnabled: boolean = false
): Promise<RoutingDecision> {
  const now = new Date()

  // Step 1: Feature flag must be enabled
  if (!featureFlagEnabled) {
    const decision: RoutingDecision = {
      useBridge: false,
      reason: 'Feature flag disabled - using CLI',
    }
    console.log({
      featureFlagEnabled,
      sessionFound: false,
      sessionStatus: null,
      bridgeEndpoint: null,
      tokenFound: false,
      tokenStatus: null,
      tokenExpiresAt: null,
      now: now.toISOString(),
      finalDecision: decision,
      returnReason: 'Feature flag check failed',
    })
    logRoutingStep('Feature flag disabled', 'SKIP')
    return decision
  }

  logRoutingStep('Feature flag enabled', 'CONTINUE')

  try {
    // Step 2: Find active bridge session for user
    const session = await prisma.bridgeSession.findFirst({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      include: {
        bridgeToken: true,
      },
    })

    const sessionFound = !!session

    if (!session) {
      const decision: RoutingDecision = {
        useBridge: false,
        reason: 'No bridge session found - using CLI',
      }
      console.log({
        featureFlagEnabled,
        sessionFound,
        sessionStatus: null,
        bridgeEndpoint: null,
        tokenFound: false,
        tokenStatus: null,
        tokenExpiresAt: null,
        now: now.toISOString(),
        finalDecision: decision,
        returnReason: 'No bridge session found',
      })
      logRoutingStep('No bridge session found for user', 'FALLBACK')
      return decision
    }

    logRoutingStep(`Bridge session found: ${session.id}`, 'CONTINUE')

    // Step 3: Check session status
    if (session.status === BridgeSessionStatusEnum.OFFLINE) {
      const decision: RoutingDecision = {
        useBridge: false,
        reason: 'Bridge session offline - using CLI',
      }
      console.log({
        featureFlagEnabled,
        sessionFound,
        sessionStatus: session.status,
        bridgeEndpoint: null,
        tokenFound: false,
        tokenStatus: null,
        tokenExpiresAt: null,
        now: now.toISOString(),
        finalDecision: decision,
        returnReason: 'Bridge session offline',
      })
      logRoutingStep(`Bridge session offline: ${session.status}`, 'FALLBACK')
      return decision
    }

    logRoutingStep(`Bridge session status: ${session.status}`, 'CONTINUE')

    // Step 4: Check token validity
    const tokenFound = !!session.bridgeToken

    if (session.bridgeToken.status !== 'ACTIVE') {
      const decision: RoutingDecision = {
        useBridge: false,
        reason: 'Bridge token not active - using CLI',
      }
      console.log({
        featureFlagEnabled,
        sessionFound,
        sessionStatus: session.status,
        bridgeEndpoint: getBridgeEndpoint(),
        tokenFound,
        tokenStatus: session.bridgeToken.status,
        tokenExpiresAt: session.bridgeToken.expiresAt.toISOString(),
        now: now.toISOString(),
        finalDecision: decision,
        returnReason: 'Bridge token not active',
      })
      logRoutingStep(`Bridge token not active: ${session.bridgeToken.status}`, 'FALLBACK')
      return decision
    }

    logRoutingStep(`Bridge token status: ${session.bridgeToken.status}`, 'CONTINUE')

    if (session.bridgeToken.expiresAt < now) {
      const decision: RoutingDecision = {
        useBridge: false,
        reason: 'Bridge token expired - using CLI',
      }
      console.log({
        featureFlagEnabled,
        sessionFound,
        sessionStatus: session.status,
        bridgeEndpoint: getBridgeEndpoint(),
        tokenFound,
        tokenStatus: session.bridgeToken.status,
        tokenExpiresAt: session.bridgeToken.expiresAt.toISOString(),
        now: now.toISOString(),
        finalDecision: decision,
        returnReason: 'Bridge token expired',
      })
      logRoutingStep('Bridge token expired', 'FALLBACK')
      return decision
    }

    logRoutingStep('Bridge token valid', 'CONTINUE')

    // Step 5: All checks passed - use bridge with configured endpoint
    const endpoint = getBridgeEndpoint()

    const decision: RoutingDecision = {
      useBridge: true,
      bridgeId: session.bridgeToken.bridgeId,
      bridgeEndpoint: endpoint,
      bridgeToken: session.bridgeToken.token,
      reason: 'Bridge available and healthy',
    }
    console.log({
      featureFlagEnabled,
      sessionFound,
      sessionStatus: session.status,
      bridgeEndpoint: endpoint,
      tokenFound,
      tokenStatus: session.bridgeToken.status,
      tokenExpiresAt: session.bridgeToken.expiresAt.toISOString(),
      now: now.toISOString(),
      finalDecision: decision,
      returnReason: 'All checks passed',
    })

    logRoutingStep(`All checks passed, using bridge endpoint: ${endpoint}`, 'BRIDGE')
    return decision
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    const decision: RoutingDecision = {
      useBridge: false,
      reason: `Routing check error (${errorMsg}) - using CLI`,
    }
    console.log({
      featureFlagEnabled,
      sessionFound: false,
      sessionStatus: null,
      bridgeEndpoint: null,
      tokenFound: false,
      tokenStatus: null,
      tokenExpiresAt: null,
      now: now.toISOString(),
      finalDecision: decision,
      returnReason: `Exception: ${errorMsg}`,
    })
    logRoutingStep(`Error during routing check: ${errorMsg}`, 'FALLBACK')
    return decision
  }
}

/**
 * Feature flag: whether to enable bridge routing
 * Reads from environment variable (default: disabled for safety)
 */
export function getBridgeFeatureFlag(): boolean {
  console.log("===== getBridgeFeatureFlag =====")
  console.log("process.env.ENABLE_BRIDGE_ROUTING =", process.env.ENABLE_BRIDGE_ROUTING)
  console.log("typeof =", typeof process.env.ENABLE_BRIDGE_ROUTING)
  const comparison = process.env.ENABLE_BRIDGE_ROUTING === 'true'
  console.log("comparison (=== 'true') =", comparison)
  const result = comparison
  console.log("returned =", result)
  console.log("================================")
  return result
}

/**
 * Log a routing step for debugging
 */
function logRoutingStep(message: string, action: 'SKIP' | 'CONTINUE' | 'FALLBACK' | 'BRIDGE'): void {
  const actionSymbol = {
    SKIP: '⊗',
    CONTINUE: '→',
    FALLBACK: '↻',
    BRIDGE: '✓',
  }[action]

  console.log(`[ROUTING] ${actionSymbol} ${message}`)
}

/**
 * Log routing decision for request tracing
 * Includes:
 * - Feature flag state
 * - Bridge selected (yes/no)
 * - Fallback reason (if applicable)
 * - Endpoint (if using bridge)
 */
export function logRoutingDecision(
  requestId: string,
  decision: RoutingDecision,
  action: string
): void {
  const flagStatus = getBridgeFeatureFlag() ? 'ENABLED' : 'DISABLED'
  const source = decision.useBridge ? 'BRIDGE' : 'CLI'
  const endpoint = decision.bridgeEndpoint ? ` (${decision.bridgeEndpoint})` : ''
  const timeout = decision.useBridge ? ` [timeout: ${getBridgeRequestTimeout()}ms]` : ''

  console.log(
    `[REQUEST:${requestId}] Action: ${action} | Flag: ${flagStatus} | Source: ${source}${endpoint}${timeout} | Reason: ${decision.reason}`
  )
}

/**
 * Format routing decision for audit logging
 */
export function formatRoutingDecisionForLog(decision: RoutingDecision): string {
  if (decision.useBridge) {
    return `BRIDGE[${decision.bridgeId}] at ${decision.bridgeEndpoint}`
  }
  return `CLI (${decision.reason})`
}
