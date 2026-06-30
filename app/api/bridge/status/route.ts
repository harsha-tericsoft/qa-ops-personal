/**
 * GET /api/bridge/status
 * Get current bridge status for authenticated user
 *
 * Called by: Frontend to check if bridge is available and online
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BridgeSessionStatusEnum } from '@/lib/types/bridge'

export async function GET(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  console.log(`[BRIDGE_STATUS:${requestId}] Status request received`)

  try {
    // Get user ID from request
    const userId = extractUserIdFromRequest(req)

    if (!userId) {
      console.warn(`[BRIDGE_STATUS:${requestId}] User not authenticated`)
      return NextResponse.json(
        {
          success: false,
          error: 'Not authenticated',
          code: 'NOT_AUTHENTICATED',
          bridgeAvailable: false,
        },
        { status: 401 }
      )
    }

    console.log(`[BRIDGE_STATUS:${requestId}] User: ${userId}`)

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
      console.log(`[BRIDGE_STATUS:${requestId}] No bridge session found`)
      return NextResponse.json(
        {
          success: true,
          bridgeAvailable: false,
          message: 'No bridge registered',
        },
        { status: 200 }
      )
    }

    console.log(`[BRIDGE_STATUS:${requestId}] Bridge found: ${session.bridgeToken.bridgeId}`)

    // Calculate uptime
    const uptimeMs = Date.now() - session.createdAt.getTime()
    const uptimeHours = Math.floor(uptimeMs / (1000 * 60 * 60))
    const uptimeMinutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60))
    const uptime = `${uptimeHours}h ${uptimeMinutes}m`

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      console.log(`[BRIDGE_STATUS:${requestId}] Session expired`)
      return NextResponse.json(
        {
          success: true,
          bridgeAvailable: false,
          message: 'Bridge session expired',
        },
        { status: 200 }
      )
    }

    // Determine if bridge is effectively online
    const isOnline =
      session.status === BridgeSessionStatusEnum.CONNECTED ||
      session.status === BridgeSessionStatusEnum.DEGRADED

    const timeSinceLastCheck = session.lastHealthCheckAt
      ? Math.floor((Date.now() - session.lastHealthCheckAt.getTime()) / 1000)
      : null

    const response = {
      success: true,
      bridgeAvailable: true,
      bridgeId: session.bridgeToken.bridgeId,
      graphName: session.bridgeToken.graphName,
      status: session.status,
      isOnline,
      endpoint: session.endpoint,
      uptime,
      lastHealthCheckAt: session.lastHealthCheckAt?.toISOString() || null,
      timeSinceLastCheckSeconds: timeSinceLastCheck,
      lastHealthCheckStatus: session.lastHealthCheckStatus,
    }

    console.log(`[BRIDGE_STATUS:${requestId}] Response: available=${response.bridgeAvailable}, online=${isOnline}`)

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[BRIDGE_STATUS:${requestId}] Error:`, errorMsg)

    return NextResponse.json(
      {
        success: false,
        error: 'Status check failed',
        code: 'STATUS_CHECK_ERROR',
        bridgeAvailable: false,
        details: errorMsg,
      },
      { status: 500 }
    )
  }
}

/**
 * Extract user ID from request
 * In MVP, this is a placeholder. Should validate auth token.
 */
function extractUserIdFromRequest(req: NextRequest): string | null {
  // TODO: Validate JWT/session token from cookies or Authorization header
  // For now, return a test user ID

  // Check Authorization header
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    // In production, validate and decode JWT
    return 'user_placeholder'
  }

  // Check session cookie
  const cookieHeader = req.headers.get('cookie')
  if (cookieHeader) {
    // In production, validate session
    return 'user_placeholder'
  }

  return null
}
