/**
 * Roam CLI Integration Routes
 * Endpoints for interacting with Roam graphs via Roam CLI
 */

import { Router, Request, Response } from 'express'
import { createLogger } from '../logging/logger'
import { RoamBridgeService } from '../services/roam/bridge-service'
import { configManager } from '../config/manager'

const logger = createLogger('roam-api')

export function createRoamRouter(): Router {
  const router = Router()

  /**
   * POST /api/roam/test-connection
   * Test connection to a Roam graph
   *
   * Request body:
   * {
   *   "graphName": "Project_Kinergy",
   *   "apiToken": "roam-graph-local-token-xxxxx"
   * }
   */
  router.post('/test-connection', async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now()

    try {
      const { graphName, apiToken } = req.body

      // Validate required fields
      if (!graphName || typeof graphName !== 'string') {
        logger.warn('[testConnection] Missing or invalid graphName')
        const duration = Date.now() - startTime
        logger.request('POST', '/api/roam/test-connection', 400, duration)
        res.status(400).json({
          success: false,
          error: 'graphName is required and must be a string',
        })
        return
      }

      if (!apiToken || typeof apiToken !== 'string') {
        logger.warn('[testConnection] Missing or invalid apiToken')
        const duration = Date.now() - startTime
        logger.request('POST', '/api/roam/test-connection', 400, duration)
        res.status(400).json({
          success: false,
          error: 'apiToken is required and must be a string',
        })
        return
      }

      logger.info(`[testConnection] Testing connection to graph: ${graphName}`)

      const service = new RoamBridgeService(graphName, apiToken)
      const result = await service.testConnection()

      const statusCode = result.success ? 200 : 503
      const duration = Date.now() - startTime
      logger.request('POST', '/api/roam/test-connection', statusCode, duration)

      res.status(statusCode).json({
        success: result.success,
        message: result.message,
        graphName: result.graphName,
        details: result.details,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(`[testConnection] Error: ${errorMsg}`)

      const duration = Date.now() - startTime
      logger.request('POST', '/api/roam/test-connection', 500, duration)

      res.status(500).json({
        success: false,
        error: 'Connection test failed',
        details: errorMsg,
        timestamp: new Date().toISOString(),
      })
    }
  })

  /**
   * POST /api/roam/search
   * Search the Roam graph
   *
   * Request body:
   * {
   *   "graphName": "Project_Kinergy",
   *   "apiToken": "roam-graph-local-token-xxxxx",
   *   "query": "test case"
   * }
   */
  router.post('/search', async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now()

    try {
      const { graphName, apiToken, query } = req.body

      // Validate required fields
      if (!graphName || typeof graphName !== 'string') {
        logger.warn('[search] Missing or invalid graphName')
        const duration = Date.now() - startTime
        logger.request('POST', '/api/roam/search', 400, duration)
        res.status(400).json({
          success: false,
          error: 'graphName is required and must be a string',
        })
        return
      }

      if (!apiToken || typeof apiToken !== 'string') {
        logger.warn('[search] Missing or invalid apiToken')
        const duration = Date.now() - startTime
        logger.request('POST', '/api/roam/search', 400, duration)
        res.status(400).json({
          success: false,
          error: 'apiToken is required and must be a string',
        })
        return
      }

      if (typeof query !== 'string') {
        logger.warn('[search] Missing or invalid query')
        const duration = Date.now() - startTime
        logger.request('POST', '/api/roam/search', 400, duration)
        res.status(400).json({
          success: false,
          error: 'query must be a string',
        })
        return
      }

      logger.info(`[search] Searching graph: ${graphName} for: "${query}"`)

      const service = new RoamBridgeService(graphName, apiToken)
      const result = await service.search(query)

      const statusCode = result.success ? 200 : 500
      const duration = Date.now() - startTime
      logger.request('POST', '/api/roam/search', statusCode, duration)

      res.status(statusCode).json({
        success: result.success,
        results: result.results || [],
        error: result.error,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(`[search] Error: ${errorMsg}`)

      const duration = Date.now() - startTime
      logger.request('POST', '/api/roam/search', 500, duration)

      res.status(500).json({
        success: false,
        error: 'Search failed',
        details: errorMsg,
        timestamp: new Date().toISOString(),
      })
    }
  })

  /**
   * POST /api/roam/sync
   * Sync test cases from Roam graph
   *
   * Request body:
   * {
   *   "projectId": "project_id",
   *   "syncType": "initial" or "refresh",
   *   "graphName": "Roam graph name",
   *   "apiToken": "roam-graph-local-token-xxxxx"
   * }
   *
   * The endpoint validates Roam accessibility and returns sync readiness.
   * Actual sync logic is performed by QA Ops.
   */
  router.post('/sync', async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now()

    try {
      const { projectId, syncType, graphName, apiToken } = req.body

      // Validate required fields
      if (!projectId || typeof projectId !== 'string') {
        logger.warn('[sync] Missing or invalid projectId')
        const duration = Date.now() - startTime
        logger.request('POST', '/api/roam/sync', 400, duration)
        res.status(400).json({
          success: false,
          error: 'projectId is required and must be a string',
        })
        return
      }

      if (!syncType || !['initial', 'refresh'].includes(syncType)) {
        logger.warn('[sync] Missing or invalid syncType')
        const duration = Date.now() - startTime
        logger.request('POST', '/api/roam/sync', 400, duration)
        res.status(400).json({
          success: false,
          error: 'syncType is required and must be "initial" or "refresh"',
        })
        return
      }

      if (!graphName || typeof graphName !== 'string') {
        logger.warn('[sync] Missing or invalid graphName')
        const duration = Date.now() - startTime
        logger.request('POST', '/api/roam/sync', 400, duration)
        res.status(400).json({
          success: false,
          error: 'graphName is required and must be a string',
        })
        return
      }

      if (!apiToken || typeof apiToken !== 'string') {
        logger.warn('[sync] Missing or invalid apiToken')
        const duration = Date.now() - startTime
        logger.request('POST', '/api/roam/sync', 400, duration)
        res.status(400).json({
          success: false,
          error: 'apiToken is required and must be a string',
        })
        return
      }

      logger.info(`[sync] Processing ${syncType} sync for projectId: ${projectId}`)

      // Desktop Connector's role: validate Roam is accessible and acknowledge sync
      logger.info(`[sync] Validating Roam accessibility for ${syncType}`)
      const service = new RoamBridgeService(graphName, apiToken)
      const testResult = await service.testConnection()

      if (!testResult.success) {
        logger.warn(`[sync] Roam not accessible: ${testResult.message}`)
        const duration = Date.now() - startTime
        logger.request('POST', '/api/roam/sync', 503, duration)
        res.status(503).json({
          success: false,
          error: 'Roam not accessible',
          details: testResult.message,
        })
        return
      }

      // Sync validation successful - QA Ops will handle the actual sync logic
      logger.info(`[sync] Roam accessible, sync can proceed`)
      const duration = Date.now() - startTime
      logger.request('POST', '/api/roam/sync', 200, duration)

      // Return response matching QA Ops expectations
      res.status(200).json({
        success: true,
        nodesAdded: 0,
        nodesUpdated: 0,
        message: `${syncType} sync ready`,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(`[sync] Error: ${errorMsg}`)

      const duration = Date.now() - startTime
      logger.request('POST', '/api/roam/sync', 500, duration)

      res.status(500).json({
        success: false,
        error: 'Sync validation failed',
        details: errorMsg,
        timestamp: new Date().toISOString(),
      })
    }
  })

  /**
   * GET /api/roam/page/:title
   * Fetch a page by title
   *
   * Query parameters:
   * - graphName (required): The Roam graph name
   * - apiToken (required): The local API token
   *
   * Example:
   * GET /api/roam/page/TestCase?graphName=Project_Kinergy&apiToken=roam-...
   */
  router.get('/page/:title', async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now()

    try {
      const { title } = req.params
      const { graphName, apiToken } = req.query

      // Validate required parameters
      if (!title || typeof title !== 'string') {
        logger.warn('[getPage] Missing or invalid title')
        const duration = Date.now() - startTime
        logger.request('GET', '/api/roam/page/:title', 400, duration)
        res.status(400).json({
          success: false,
          error: 'Page title is required',
        })
        return
      }

      if (!graphName || typeof graphName !== 'string') {
        logger.warn('[getPage] Missing or invalid graphName')
        const duration = Date.now() - startTime
        logger.request('GET', '/api/roam/page/:title', 400, duration)
        res.status(400).json({
          success: false,
          error: 'graphName query parameter is required',
        })
        return
      }

      if (!apiToken || typeof apiToken !== 'string') {
        logger.warn('[getPage] Missing or invalid apiToken')
        const duration = Date.now() - startTime
        logger.request('GET', '/api/roam/page/:title', 400, duration)
        res.status(400).json({
          success: false,
          error: 'apiToken query parameter is required',
        })
        return
      }

      logger.info(`[getPage] Fetching page: "${title}" from graph: ${graphName}`)

      const service = new RoamBridgeService(graphName, apiToken)
      const result = await service.getPage(decodeURIComponent(title))

      const statusCode = result.success ? 200 : 404
      const duration = Date.now() - startTime
      logger.request('GET', '/api/roam/page/:title', statusCode, duration)

      res.status(statusCode).json({
        success: result.success,
        page: result.page,
        error: result.error,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(`[getPage] Error: ${errorMsg}`)

      const duration = Date.now() - startTime
      logger.request('GET', '/api/roam/page/:title', 500, duration)

      res.status(500).json({
        success: false,
        error: 'Failed to fetch page',
        details: errorMsg,
        timestamp: new Date().toISOString(),
      })
    }
  })

  return router
}
