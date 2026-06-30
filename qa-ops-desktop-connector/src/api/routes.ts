/**
 * API Routes for Desktop Connector
 * Health check, version, and Roam CLI integration endpoints
 */

import { Router, Request, Response } from 'express'
import { createLogger } from '../logging/logger'
import { createRoamRouter } from './roam-routes'

const logger = createLogger('routes')

export function createRouter(): Router {
  const router = Router()

  // Register Roam routes
  const roamRouter = createRoamRouter()
  router.use('/api/roam', roamRouter)

  /**
   * GET /health
   * Health check endpoint
   */
  router.get('/health', (req: Request, res: Response) => {
    const startTime = Date.now()

    try {
      const response = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        pid: process.pid,
        nodeVersion: process.version,
      }

      const duration = Date.now() - startTime
      logger.request('GET', '/health', 200, duration)

      res.json(response)
    } catch (error) {
      const duration = Date.now() - startTime
      logger.error('Health check failed', error instanceof Error ? error.message : String(error))
      logger.request('GET', '/health', 500, duration)

      res.status(500).json({
        status: 'error',
        error: 'Health check failed',
      })
    }
  })

  /**
   * GET /version
   * Version endpoint
   */
  router.get('/version', (req: Request, res: Response) => {
    const startTime = Date.now()

    try {
      const pjson = require('../../package.json')

      const response = {
        name: pjson.name,
        version: pjson.version,
        description: pjson.description,
        timestamp: new Date().toISOString(),
      }

      const duration = Date.now() - startTime
      logger.request('GET', '/version', 200, duration)

      res.json(response)
    } catch (error) {
      const duration = Date.now() - startTime
      logger.error('Version endpoint failed', error instanceof Error ? error.message : String(error))
      logger.request('GET', '/version', 500, duration)

      res.status(500).json({
        status: 'error',
        error: 'Failed to get version',
      })
    }
  })

  /**
   * GET / (root)
   * API info endpoint
   */
  router.get('/', (req: Request, res: Response) => {
    const startTime = Date.now()

    try {
      const response = {
        name: 'QA Ops Desktop Connector',
        status: 'running',
        endpoints: {
          health: 'GET /health',
          version: 'GET /version',
          'roam.test-connection': 'POST /api/roam/test-connection',
          'roam.search': 'POST /api/roam/search',
          'roam.page': 'GET /api/roam/page/:title',
        },
        timestamp: new Date().toISOString(),
      }

      const duration = Date.now() - startTime
      logger.request('GET', '/', 200, duration)

      res.json(response)
    } catch (error) {
      const duration = Date.now() - startTime
      logger.error('Root endpoint failed', error instanceof Error ? error.message : String(error))
      logger.request('GET', '/', 500, duration)

      res.status(500).json({
        status: 'error',
        error: 'Failed to get API info',
      })
    }
  })

  return router
}
