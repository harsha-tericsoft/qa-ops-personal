/**
 * DELETE /api/bridge/[bridgeId]/unregister
 * Unregister a Desktop Connector bridge (cleanup)
 *
 * Called by: Local bridge when user runs `roam-bridge unregister`
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { revokeBridgeToken } from '@/lib/bridge/token-manager'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ bridgeId: string }> }
) {
  const requestId = Math.random().toString(36).substring(7)
  const { bridgeId } = await params

  console.log(`[BRIDGE_UNREGISTER:${requestId}] Unregister request for bridge: ${bridgeId}`)

  try {
    // Get bridge token
    const bridgeToken = await prisma.bridgeToken.findUnique({
      where: { bridgeId },
    })

    if (!bridgeToken) {
      console.warn(`[BRIDGE_UNREGISTER:${requestId}] Bridge not found`)
      return NextResponse.json(
        {
          success: false,
          error: 'Bridge not found',
          code: 'BRIDGE_NOT_FOUND',
        },
        { status: 404 }
      )
    }

    console.log(`[BRIDGE_UNREGISTER:${requestId}] Found bridge for user: ${bridgeToken.userId}`)

    // Revoke token
    const revokeResult = await revokeBridgeToken(bridgeId)

    if (!revokeResult.success) {
      console.error(`[BRIDGE_UNREGISTER:${requestId}] Failed to revoke token`)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to revoke token',
          code: 'REVOKE_ERROR',
        },
        { status: 500 }
      )
    }

    console.log(`[BRIDGE_UNREGISTER:${requestId}] Token revoked`)

    // Delete sessions
    const deletedSessions = await prisma.bridgeSession.deleteMany({
      where: { bridgeTokenId: bridgeToken.id },
    })

    console.log(`[BRIDGE_UNREGISTER:${requestId}] Deleted ${deletedSessions.count} sessions`)

    // Log unregistration
    await prisma.bridgeLog.create({
      data: {
        userId: bridgeToken.userId,
        bridgeId,
        action: 'UNREGISTER',
        status: 'SUCCESS',
        requestId,
      },
    })

    const response = {
      success: true,
      message: 'Bridge unregistered successfully',
      bridgeId,
    }

    console.log(`[BRIDGE_UNREGISTER:${requestId}] Unregistration successful`)

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[BRIDGE_UNREGISTER:${requestId}] Error:`, errorMsg)

    return NextResponse.json(
      {
        success: false,
        error: 'Unregistration failed',
        code: 'UNREGISTER_ERROR',
        details: errorMsg,
      },
      { status: 500 }
    )
  }
}
