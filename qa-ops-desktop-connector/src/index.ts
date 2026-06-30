/**
 * Desktop Connector Entry Point
 * Main startup sequence and graceful shutdown
 */

import 'dotenv/config'
import { createServer, Server } from './server'
import { configManager } from './config/manager'
import { createLogger } from './logging/logger'

const logger = createLogger('main')

let server: Server | null = null
let isShuttingDown = false

async function startup(): Promise<void> {
  try {
    logger.info('='.repeat(60))
    logger.info('QA Ops Desktop Connector Starting')
    logger.info('='.repeat(60))

    // Load configuration
    logger.info('Loading configuration...')
    const config = configManager.load()
    if (config) {
      logger.info(`Loaded config for graph: ${config.graphName}`)
    } else {
      logger.info('No existing config found - setup required')
    }

    // Get server configuration
    const port = configManager.getPort()
    const host = configManager.getHost()
    const env = process.env.NODE_ENV || 'development'

    logger.info(`Server configuration: ${host}:${port} (${env})`)

    // Create and start server
    server = createServer({ port, host, env })
    await server.start()

    logger.info('='.repeat(60))
    logger.info('Desktop Connector Ready')
    logger.info('='.repeat(60))
    logger.info(`Health check: http://${host}:${port}/health`)
    logger.info(`API info: http://${host}:${port}/`)
    logger.info('')
  } catch (error) {
    logger.error('Failed to start Desktop Connector', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return
  }

  isShuttingDown = true

  logger.info(`${signal} received - initiating graceful shutdown`)

  try {
    if (server) {
      await server.stop()
    }
    logger.info('Shutdown complete')
    process.exit(0)
  } catch (error) {
    logger.error('Error during shutdown', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

// Handle process signals
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', error.message)
  process.exit(1)
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled promise rejection', String(reason))
  process.exit(1)
})

// Start the application
startup().catch((error) => {
  logger.error('Fatal error', error)
  process.exit(1)
})
