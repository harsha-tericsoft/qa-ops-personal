/**
 * POST /api/bridge/heartbeat
 * Receive health check from running bridge (every 30 seconds)
 *
 * Called by: Local bridge periodically
 * Updates: BridgeSession status, handles token refresh if needed
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateBridgeToken, refreshBridgeToken } from '@/lib/bridge/token-manager'
import { markBridgeConnected } from '@/lib/bridge/health-monitor'
import { BridgeSessionStatusEnum } from '@/lib/types/bridge'

interface HeartbeatRequest {
  bridgeId: string
  token: string
  status: BridgeSessionStatusEnum
  uptime: number
  requestsProcessed: number
  errorsInLast30s: number
  roamStatus: 'CONNECTED' | 'CONNECTING' | 'OFFLINE'
  lastError?: string
}

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  console.log(`[BRIDGE_HEARTBEAT:${requestId}] Heartbeat received`)

  try {
    const body = (await req.json()) as HeartbeatRequest

    const { bridgeId, token, status, uptime, requestsProcessed, roamStatus } = body

    console.log(`[BRIDGE_HEARTBEAT:${requestId}] Bridge: ${bridgeId}, Status: ${status}`)

    // Validate required fields
    if (!bridgeId || !token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing bridgeId or token',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      )
    }

    // Validate token
    const validation = await validateBridgeToken(token)

    if (!validation.valid) {
      console.warn(`[BRIDGE_HEARTBEAT:${requestId}] Token validation failed: ${validation.error}`)

      // If token expired, tell bridge to re-register
      if (validation.error === 'TOKEN_EXPIRED') {
        return NextResponse.json(
          {
            success: false,
            error: 'Token expired, please re-register',
            code: 'TOKEN_EXPIRED',
            requiresReRegistration: true,
          },
          { status: 401 }
        )
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Token validation failed',
          code: validation.error,
        },
        { status: 401 }
      )
    }

    console.log(`[BRIDGE_HEARTBEAT:${requestId}] Token valid, userId: ${validation.userId}`)

    // Find bridge token
    const bridgeToken = await prisma.bridgeToken.findUnique({
      where: { bridgeId },
    })

    if (!bridgeToken || bridgeToken.userId !== validation.userId) {
      console.warn(`[BRIDGE_HEARTBEAT:${requestId}] Bridge token not found or user mismatch`)
      return NextResponse.json(
        {
          success: false,
          error: 'Bridge not found',
          code: 'BRIDGE_NOT_FOUND',
        },
        { status: 404 }
      )
    }

    // Update session status
    console.log(`[BRIDGE_HEARTBEAT:${requestId}] Updating session status to ${status}`)

    const session = await prisma.bridgeSession.findFirst({
      where: {
        userId: validation.userId,
        bridgeTokenId: bridgeToken.id,
      },
    })

    if (!session) {
      console.warn(`[BRIDGE_HEARTBEAT:${requestId}] Session not found`)
      return NextResponse.json(
        {
          success: false,
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND',
        },
        { status: 404 }
      )
    }

    // Update session with heartbeat info
    await prisma.bridgeSession.update({
      where: { id: session.id },
      data: {
        status,
        lastHealthCheckAt: new Date(),
        lastHealthCheckStatus: `Roam: ${roamStatus}, Uptime: ${uptime}s, Requests: ${requestsProcessed}`,
      },
    })

    console.log(`[BRIDGE_HEARTBEAT:${requestId}] Session updated`)

    // Check if token should be refreshed
    let newToken: string | undefined

    if (validation.shouldRefresh) {
      console.log(`[BRIDGE_HEARTBEAT:${requestId}] Token expiring soon, refreshing...`)

      const refreshResult = await refreshBridgeToken(bridgeToken.id)

      if (refreshResult.token) {
        newToken = refreshResult.token
        console.log(`[BRIDGE_HEARTBEAT:${requestId}] Token refreshed successfully`)
      }
    }

    // Log heartbeat operation
    await prisma.bridgeLog.create({
      data: {
        userId: validation.userId,
        bridgeSessionId: session.id,
        bridgeId,
        action: 'HEARTBEAT',
        status: 'SUCCESS',
        requestId,
      },
    })

    // Prepare response
    const response = {
      success: true,
      acknowledged: true,
      nextHeartbeatAt: new Date(Date.now() + 30 * 1000).toISOString(), // Next in 30 seconds
      ...(newToken && { newBridgeToken: newToken }),
    }

    console.log(`[BRIDGE_HEARTBEAT:${requestId}] Response sent`)

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[BRIDGE_HEARTBEAT:${requestId}] Error:`, errorMsg)

    return NextResponse.json(
      {
        success: false,
        error: 'Heartbeat processing failed',
        code: 'HEARTBEAT_ERROR',
        details: errorMsg,
      },
      { status: 500 }
    )
  }
}
