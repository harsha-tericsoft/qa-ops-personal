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
  const envValue = process.env.ENABLE_BRIDGE_ROUTING
  console.log(`[ROUTING_DIAGNOSTIC] ENABLE_BRIDGE_ROUTING env value: ${JSON.stringify(envValue)}`)
  console.log(`[ROUTING_DIAGNOSTIC] featureFlagEnabled parameter: ${featureFlagEnabled}`)
  console.log(`[ROUTING_DIAGNOSTIC] userId: ${userId}`)

  // Step 1: Feature flag must be enabled
  if (!featureFlagEnabled) {
    console.log(`[ROUTING_DIAGNOSTIC] STEP 1 FAILED: Feature flag disabled (featureFlagEnabled=${featureFlagEnabled})`)
    const decision: RoutingDecision = {
      useBridge: false,
      reason: 'Feature flag disabled - using CLI',
    }
    console.log(`[ROUTING_DIAGNOSTIC] RETURNING: ${JSON.stringify(decision)}`)
    logRoutingStep('Feature flag disabled', 'SKIP')
    return decision
  }

  console.log(`[ROUTING_DIAGNOSTIC] STEP 1 PASSED: Feature flag enabled`)
  logRoutingStep('Feature flag enabled', 'CONTINUE')

  try {
    // Step 2: Find active bridge session for user
    console.log(`[ROUTING_DIAGNOSTIC] STEP 2: Searching for active bridge session for userId=${userId}`)
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
    console.log(`[ROUTING_DIAGNOSTIC] STEP 2 RESULT: Active bridge session found: ${sessionFound}`)
    if (session) {
      console.log(`[ROUTING_DIAGNOSTIC]   Session ID: ${session.id}`)
      console.log(`[ROUTING_DIAGNOSTIC]   Session Status: ${session.status}`)
      console.log(`[ROUTING_DIAGNOSTIC]   Session Expires At: ${session.expiresAt.toISOString()}`)
    }

    if (!session) {
      console.log(`[ROUTING_DIAGNOSTIC] STEP 2 FAILED: No bridge session found`)
      const decision: RoutingDecision = {
        useBridge: false,
        reason: 'No bridge session found - using CLI',
      }
      console.log(`[ROUTING_DIAGNOSTIC] RETURNING: ${JSON.stringify(decision)}`)
      logRoutingStep('No bridge session found for user', 'FALLBACK')
      return decision
    }

    logRoutingStep(`Bridge session found: ${session.id}`, 'CONTINUE')

    // Step 3: Check session status
    const sessionOffline = session.status === BridgeSessionStatusEnum.OFFLINE
    console.log(`[ROUTING_DIAGNOSTIC] STEP 3: Checking session status`)
    console.log(`[ROUTING_DIAGNOSTIC]   Current status: ${session.status}`)
    console.log(`[ROUTING_DIAGNOSTIC]   Is OFFLINE: ${sessionOffline}`)

    if (sessionOffline) {
      console.log(`[ROUTING_DIAGNOSTIC] STEP 3 FAILED: Bridge session offline`)
      const decision: RoutingDecision = {
        useBridge: false,
        reason: 'Bridge session offline - using CLI',
      }
      console.log(`[ROUTING_DIAGNOSTIC] RETURNING: ${JSON.stringify(decision)}`)
      logRoutingStep(`Bridge session offline: ${session.status}`, 'FALLBACK')
      return decision
    }

    console.log(`[ROUTING_DIAGNOSTIC] STEP 3 PASSED: Session status is not OFFLINE`)
    logRoutingStep(`Bridge session status: ${session.status}`, 'CONTINUE')

    // Step 4: Check token validity
    const tokenFound = !!session.bridgeToken
    console.log(`[ROUTING_DIAGNOSTIC] STEP 4: Checking bridge token`)
    console.log(`[ROUTING_DIAGNOSTIC]   Token found: ${tokenFound}`)
    if (session.bridgeToken) {
      console.log(`[ROUTING_DIAGNOSTIC]   Token Status: ${session.bridgeToken.status}`)
      console.log(`[ROUTING_DIAGNOSTIC]   Token Expires At: ${session.bridgeToken.expiresAt.toISOString()}`)
    }

    if (session.bridgeToken.status !== 'ACTIVE') {
      console.log(`[ROUTING_DIAGNOSTIC] STEP 4 FAILED: Bridge token not active (status=${session.bridgeToken.status})`)
      const decision: RoutingDecision = {
        useBridge: false,
        reason: 'Bridge token not active - using CLI',
      }
      console.log(`[ROUTING_DIAGNOSTIC] RETURNING: ${JSON.stringify(decision)}`)
      logRoutingStep(`Bridge token not active: ${session.bridgeToken.status}`, 'FALLBACK')
      return decision
    }

    console.log(`[ROUTING_DIAGNOSTIC] STEP 4A PASSED: Token status is ACTIVE`)
    logRoutingStep(`Bridge token status: ${session.bridgeToken.status}`, 'CONTINUE')

    const tokenExpired = session.bridgeToken.expiresAt < new Date()
    console.log(`[ROUTING_DIAGNOSTIC] STEP 4B: Checking token expiration`)
    console.log(`[ROUTING_DIAGNOSTIC]   Token expired: ${tokenExpired}`)
    console.log(`[ROUTING_DIAGNOSTIC]   Now: ${new Date().toISOString()}`)
    console.log(`[ROUTING_DIAGNOSTIC]   Expires: ${session.bridgeToken.expiresAt.toISOString()}`)

    if (tokenExpired) {
      console.log(`[ROUTING_DIAGNOSTIC] STEP 4B FAILED: Bridge token expired`)
      const decision: RoutingDecision = {
        useBridge: false,
        reason: 'Bridge token expired - using CLI',
      }
      console.log(`[ROUTING_DIAGNOSTIC] RETURNING: ${JSON.stringify(decision)}`)
      logRoutingStep('Bridge token expired', 'FALLBACK')
      return decision
    }

    console.log(`[ROUTING_DIAGNOSTIC] STEP 4B PASSED: Token is not expired`)
    logRoutingStep('Bridge token valid', 'CONTINUE')

    // Step 5: All checks passed - use bridge with configured endpoint
    const endpoint = getBridgeEndpoint()
    console.log(`[ROUTING_DIAGNOSTIC] STEP 5: All checks passed`)
    console.log(`[ROUTING_DIAGNOSTIC]   Configured endpoint: ${endpoint}`)
    console.log(`[ROUTING_DIAGNOSTIC]   Bridge ID: ${session.bridgeToken.bridgeId}`)

    logRoutingStep(`All checks passed, using bridge endpoint: ${endpoint}`, 'BRIDGE')

    const decision: RoutingDecision = {
      useBridge: true,
      bridgeId: session.bridgeToken.bridgeId,
      bridgeEndpoint: endpoint, // Use configured endpoint
      bridgeToken: session.bridgeToken.token,
      reason: 'Bridge available and healthy',
    }
    console.log(`[ROUTING_DIAGNOSTIC] RETURNING: ${JSON.stringify(decision)}`)
    return decision
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.log(`[ROUTING_DIAGNOSTIC] EXCEPTION CAUGHT: ${errorMsg}`)
    if (error instanceof Error) {
      console.log(`[ROUTING_DIAGNOSTIC] Stack: ${error.stack}`)
    }
    logRoutingStep(`Error during routing check: ${errorMsg}`, 'FALLBACK')
    const decision: RoutingDecision = {
      useBridge: false,
      reason: `Routing check error (${errorMsg}) - using CLI`,
    }
    console.log(`[ROUTING_DIAGNOSTIC] RETURNING: ${JSON.stringify(decision)}`)
    return decision
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
