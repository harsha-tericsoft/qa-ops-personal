/**
 * Bridge Authentication Routes
 * Handles registration, heartbeat, and token refresh for Desktop Connector
 */

import { Router, Request, Response } from 'express'
import { createLogger } from '../logging/logger'

const logger = createLogger('bridge-auth')

export function createAuthRouter(): Router {
  const router = Router()

  /**
   * POST /api/bridge/register
   * Register this Desktop Connector with the QA Ops backend
   *
   * Request body:
   * {
   *   "token": "qop_bridge_xxx...",
   *   "graphName": "Project_Kinergy",
   *   "endpoint": "http://localhost:7890"
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "sessionId": "session_xyz...",
   *   "heartbeatInterval": 30000
   * }
   */
  router.post('/bridge/register', async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now()

    try {
      const { token, graphName, endpoint } = req.body

      // Validate required fields
      if (!token || typeof token !== 'string') {
        logger.warn('[register] Missing or invalid token')
        const duration = Date.now() - startTime
        logger.request('POST', '/api/bridge/register', 400, duration)
        res.status(400).json({
          success: false,
          error: 'token is required and must be a string',
        })
        return
      }

      if (!graphName || typeof graphName !== 'string') {
        logger.warn('[register] Missing or invalid graphName')
        const duration = Date.now() - startTime
        logger.request('POST', '/api/bridge/register', 400, duration)
        res.status(400).json({
          success: false,
          error: 'graphName is required and must be a string',
        })
        return
      }

      if (!endpoint || typeof endpoint !== 'string') {
        logger.warn('[register] Missing or invalid endpoint')
        const duration = Date.now() - startTime
        logger.request('POST', '/api/bridge/register', 400, duration)
        res.status(400).json({
          success: false,
          error: 'endpoint is required and must be a string',
        })
        return
      }

      logger.info(`[register] Registration request: token=${token.substring(0, 15)}..., graph=${graphName}`)

      // In a real implementation, this would call back to QA Ops backend
      // For now, we generate a local session ID and return success
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
      const heartbeatInterval = 30000 // 30 seconds

      logger.info(`[register] Registration successful: sessionId=${sessionId}`)

      const duration = Date.now() - startTime
      logger.request('POST', '/api/bridge/register', 200, duration)

      res.status(200).json({
        success: true,
        sessionId,
        heartbeatInterval,
        message: 'Bridge registered successfully',
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(`[register] Error: ${errorMsg}`)

      const duration = Date.now() - startTime
      logger.request('POST', '/api/bridge/register', 500, duration)

      res.status(500).json({
        success: false,
        error: 'Registration failed',
        details: errorMsg,
        timestamp: new Date().toISOString(),
      })
    }
  })

  /**
   * POST /api/bridge/heartbeat
   * Send heartbeat to indicate bridge is still alive
   *
   * Request body:
   * {
   *   "sessionId": "session_xyz...",
   *   "status": "healthy"
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "nextHeartbeatMs": 30000
   * }
   */
  router.post('/bridge/heartbeat', async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now()

    try {
      const { sessionId, status } = req.body

      if (!sessionId || typeof sessionId !== 'string') {
        logger.warn('[heartbeat] Missing or invalid sessionId')
        const duration = Date.now() - startTime
        logger.request('POST', '/api/bridge/heartbeat', 400, duration)
        res.status(400).json({
          success: false,
          error: 'sessionId is required and must be a string',
        })
        return
      }

      const bridgeStatus = status || 'healthy'

      logger.info(`[heartbeat] Heartbeat from session: ${sessionId}, status: ${bridgeStatus}`)

      // In a real implementation, this would update the session in QA Ops backend
      const nextHeartbeatMs = 30000

      const duration = Date.now() - startTime
      logger.request('POST', '/api/bridge/heartbeat', 200, duration)

      res.status(200).json({
        success: true,
        nextHeartbeatMs,
        message: 'Heartbeat received',
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(`[heartbeat] Error: ${errorMsg}`)

      const duration = Date.now() - startTime
      logger.request('POST', '/api/bridge/heartbeat', 500, duration)

      res.status(500).json({
        success: false,
        error: 'Heartbeat processing failed',
        details: errorMsg,
        timestamp: new Date().toISOString(),
      })
    }
  })

  /**
   * POST /api/bridge/refresh-token
   * Refresh authentication token if expiring soon
   *
   * Request body:
   * {
   *   "oldToken": "qop_bridge_xxx...",
   *   "sessionId": "session_xyz..."
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "newToken": "qop_bridge_yyy...",
   *   "expiresAt": "2026-09-30T..."
   * }
   */
  router.post('/bridge/refresh-token', async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now()

    try {
      const { oldToken, sessionId } = req.body

      if (!oldToken || typeof oldToken !== 'string') {
        logger.warn('[refresh-token] Missing or invalid oldToken')
        const duration = Date.now() - startTime
        logger.request('POST', '/api/bridge/refresh-token', 400, duration)
        res.status(400).json({
          success: false,
          error: 'oldToken is required and must be a string',
        })
        return
      }

      if (!sessionId || typeof sessionId !== 'string') {
        logger.warn('[refresh-token] Missing or invalid sessionId')
        const duration = Date.now() - startTime
        logger.request('POST', '/api/bridge/refresh-token', 400, duration)
        res.status(400).json({
          success: false,
          error: 'sessionId is required and must be a string',
        })
        return
      }

      logger.info(`[refresh-token] Token refresh request for session: ${sessionId}`)

      // In a real implementation, this would validate the old token
      // and generate a new one from QA Ops backend
      const newToken = `qop_bridge_${Math.random().toString(36).substring(7)}`
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 90)

      logger.info(`[refresh-token] Token refreshed: new token=${newToken.substring(0, 15)}...`)

      const duration = Date.now() - startTime
      logger.request('POST', '/api/bridge/refresh-token', 200, duration)

      res.status(200).json({
        success: true,
        newToken,
        expiresAt: expiresAt.toISOString(),
        message: 'Token refreshed successfully',
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(`[refresh-token] Error: ${errorMsg}`)

      const duration = Date.now() - startTime
      logger.request('POST', '/api/bridge/refresh-token', 500, duration)

      res.status(500).json({
        success: false,
        error: 'Token refresh failed',
        details: errorMsg,
        timestamp: new Date().toISOString(),
      })
    }
  })

  /**
   * GET /api/health
   * Simple health check endpoint
   * Used by QA Ops to verify Desktop Connector is alive
   */
  router.get('/health', (req: Request, res: Response): void => {
    const startTime = Date.now()

    try {
      const uptime = process.uptime()
      const uptimeHours = Math.floor(uptime / 3600)
      const uptimeMinutes = Math.floor((uptime % 3600) / 60)

      const duration = Date.now() - startTime
      logger.request('GET', '/api/health', 200, duration)

      res.status(200).json({
        status: 'healthy',
        uptime: `${uptimeHours}h ${uptimeMinutes}m`,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(`[health] Error: ${errorMsg}`)

      const duration = Date.now() - startTime
      logger.request('GET', '/api/health', 500, duration)

      res.status(500).json({
        status: 'unhealthy',
        error: errorMsg,
        timestamp: new Date().toISOString(),
      })
    }
  })

  return router
}
