/**
 * Express Server Configuration for Desktop Connector
 */

import express, { Express, Request, Response, NextFunction } from 'express'
import { createLogger } from './logging/logger'
import { createRouter } from './api/routes'
import { createErrorResponse } from './utils/errors'

const logger = createLogger('server')

export interface ServerConfig {
  port: number
  host: string
  env: string
}

export class Server {
  private app: Express
  private config: ServerConfig
  private httpServer: any = null
  private requestsCount: number = 0

  constructor(config: ServerConfig) {
    this.config = config
    this.app = express()
    this.setupMiddleware()
    this.setupRoutes()
    this.setupErrorHandling()
  }

  getRequestsCount(): number {
    return this.requestsCount
  }

  private setupMiddleware(): void {
    // JSON parsing middleware
    this.app.use(express.json())
    this.app.use(express.urlencoded({ extended: true }))

    // Request logging middleware with metrics
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now()
      this.requestsCount++

      res.on('finish', () => {
        const duration = Date.now() - start
        logger.request(req.method, req.path, res.statusCode, duration)
      })

      next()
    })

    // CORS middleware (allow localhost only)
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const origin = req.get('origin')
      const isLocalhost = origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))

      if (isLocalhost || !origin) {
        res.header('Access-Control-Allow-Origin', origin || '*')
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id')
        res.header('Access-Control-Max-Age', '86400')
      }

      if (req.method === 'OPTIONS') {
        res.sendStatus(200)
      } else {
        next()
      }
    })

    logger.info('Middleware configured')
  }

  private setupRoutes(): void {
    const router = createRouter()
    this.app.use('/', router)
    logger.info('Routes configured')
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req: Request, res: Response) => {
      const error = createErrorResponse(new Error('Not Found'))
      res.status(404).json({
        ...error,
        statusCode: 404,
        code: 'NOT_FOUND',
      })
    })

    // Error handler
    this.app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
      const error = createErrorResponse(err)
      const errorMsg = err instanceof Error ? err.message : String(err)
      logger.error(`Request error: ${errorMsg}`)
      res.status(error.statusCode).json(error)
    })

    logger.info('Error handling configured')
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.httpServer = this.app.listen(this.config.port, this.config.host, () => {
          logger.info(`Server started on http://${this.config.host}:${this.config.port}`)
          logger.info(`Environment: ${this.config.env}`)
          logger.info('Ready to accept connections')
          resolve()
        })

        this.httpServer.on('error', (error: any) => {
          logger.error('Server error', error)
          reject(error)
        })
      } catch (error) {
        const errorMsg = error instanceof Error ? error : String(error)
        logger.error('Failed to start server', errorMsg)
        reject(error)
      }
    })
  }

  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.httpServer) {
        resolve()
        return
      }

      logger.info('Gracefully shutting down server...')

      this.httpServer.close((error?: Error) => {
        if (error) {
          logger.error('Error during shutdown', error)
          reject(error)
        } else {
          logger.info('Server shut down successfully')
          resolve()
        }
      })

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.warn('Force shutdown after 30 seconds')
        reject(new Error('Forced shutdown timeout'))
      }, 30000)
    })
  }

  public getApp(): Express {
    return this.app
  }
}

/**
 * Create and configure a server instance
 */
export function createServer(config: ServerConfig): Server {
  return new Server(config)
}
