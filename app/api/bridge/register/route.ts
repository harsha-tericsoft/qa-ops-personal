/**
 * POST /api/bridge/register
 * Register a new Desktop Connector bridge with the backend
 *
 * Called by: Local bridge during setup (roam-bridge setup)
 * Returns: Bridge token, expiry, webhook URL
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createBridgeToken } from '@/lib/bridge/token-manager'
import { BridgeSessionStatusEnum } from '@/lib/types/bridge'

interface RegisterRequest {
  bridgeId: string
  graphName: string
  publicKey?: string
  version: string
  os?: string
  hostname?: string
}

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  console.log(`[BRIDGE_REGISTER:${requestId}] Register request received`)

  try {
    const body = (await req.json()) as RegisterRequest

    console.log(`[BRIDGE_REGISTER:${requestId}] Bridge details:`)
    console.log(`  bridgeId: ${body.bridgeId}`)
    console.log(`  graphName: ${body.graphName}`)
    console.log(`  version: ${body.version}`)

    // Validate required fields
    if (!body.bridgeId || !body.graphName || !body.version) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: bridgeId, graphName, version',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      )
    }

    // Validate bridgeId format (should be UUID-like)
    if (!isValidBridgeId(body.bridgeId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid bridgeId format',
          code: 'INVALID_BRIDGE_ID',
        },
        { status: 400 }
      )
    }

    // Validate graphName (alphanumeric, spaces, underscores)
    if (!isValidGraphName(body.graphName)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid graphName format',
          code: 'INVALID_GRAPH_NAME',
        },
        { status: 400 }
      )
    }

    // Get user from request (for now, use a guest user or require auth)
    // In production, this would validate session/auth token
    const userId = extractUserIdFromRequest(req)

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not authenticated',
          code: 'NOT_AUTHENTICATED',
        },
        { status: 401 }
      )
    }

    console.log(`[BRIDGE_REGISTER:${requestId}] User: ${userId}`)

    // Check if bridge already registered
    const existingBridge = await prisma.bridgeToken.findUnique({
      where: { bridgeId: body.bridgeId },
    })

    if (existingBridge) {
      console.log(`[BRIDGE_REGISTER:${requestId}] Bridge already registered`)
      return NextResponse.json(
        {
          success: false,
          error: 'Bridge already registered',
          code: 'BRIDGE_ALREADY_REGISTERED',
        },
        { status: 409 }
      )
    }

    // Create bridge token
    const tokenResult = await createBridgeToken(
      userId,
      body.bridgeId,
      body.graphName
    )

    if (!tokenResult.token || tokenResult.error) {
      console.error(`[BRIDGE_REGISTER:${requestId}] Token creation failed:`, tokenResult.error)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create bridge token',
          code: tokenResult.error,
        },
        { status: 500 }
      )
    }

    console.log(`[BRIDGE_REGISTER:${requestId}] Token created successfully`)

    // Create bridge session
    const bridgeToken = await prisma.bridgeToken.findUnique({
      where: { token: tokenResult.token },
    })

    if (!bridgeToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to retrieve created token',
          code: 'TOKEN_RETRIEVAL_ERROR',
        },
        { status: 500 }
      )
    }

    // Session expires at same time as token
    await prisma.bridgeSession.create({
      data: {
        userId,
        bridgeTokenId: bridgeToken.id,
        endpoint: 'http://localhost:7890', // Default endpoint, bridge may override
        status: BridgeSessionStatusEnum.CONNECTED,
        expiresAt: tokenResult.expiresAt,
      },
    })

    console.log(`[BRIDGE_REGISTER:${requestId}] Session created successfully`)

    // Prepare response
    const response = {
      success: true,
      bridgeToken: tokenResult.token,
      expiresAt: tokenResult.expiresAt.toISOString(),
      webhookUrl: `${getBackendUrl()}/api/bridge/heartbeat`,
      graphName: body.graphName,
    }

    console.log(`[BRIDGE_REGISTER:${requestId}] Registration successful`)

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[BRIDGE_REGISTER:${requestId}] Error:`, errorMsg)

    return NextResponse.json(
      {
        success: false,
        error: 'Registration failed',
        code: 'REGISTRATION_ERROR',
        details: errorMsg,
      },
      { status: 500 }
    )
  }
}

/**
 * Validate bridge ID format
 */
function isValidBridgeId(bridgeId: string): boolean {
  // UUID-like format: bridge-xxxxx or bridge-uuid-xxxxx
  return /^bridge-[a-f0-9]{8}([a-f0-9]{4}){3}[a-f0-9]{12}$|^bridge-[a-zA-Z0-9]{20,}$/.test(
    bridgeId
  )
}

/**
 * Validate graph name format
 */
function isValidGraphName(graphName: string): boolean {
  // Allow alphanumeric, spaces, underscores, hyphens
  // Length 1-100 chars
  return /^[a-zA-Z0-9\s_-]{1,100}$/.test(graphName)
}

/**
 * Extract user ID from request
 * In MVP, this is a placeholder. Should validate auth token.
 */
function extractUserIdFromRequest(req: NextRequest): string | null {
  // TODO: Validate JWT/session token from cookies or Authorization header
  // For now, return a test user ID
  const authHeader = req.headers.get('authorization')

  if (authHeader?.startsWith('Bearer ')) {
    // In production, validate and decode JWT
    return 'user_placeholder' // Placeholder
  }

  // Check for session cookie
  const cookieHeader = req.headers.get('cookie')
  if (cookieHeader) {
    // In production, validate session
    return 'user_placeholder' // Placeholder
  }

  return null
}

/**
 * Get backend URL for webhook
 */
function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://qa-ops.vercel.app'
}
