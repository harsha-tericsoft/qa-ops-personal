/**
 * Desktop Connector Entry Point
 * Main startup sequence and graceful shutdown
 */

import 'dotenv/config'
import { v4 as uuidv4 } from 'uuid'
import { createServer, Server } from './server'
import { configManager } from './config/manager'
import { createLogger } from './logging/logger'
import { registerWithBackend } from './services/bridge-client'
import { getHeartbeatService } from './services/heartbeat-service'

const logger = createLogger('main')

let server: Server | null = null
let isShuttingDown = false

/**
 * Wait for health endpoint to be available
 */
async function waitForHealthCheck(host: string, port: number, maxRetries: number = 10): Promise<boolean> {
  const healthUrl = `http://${host}:${port}/health`
  logger.info(`[waitForHealthCheck] Verifying health endpoint: ${healthUrl}`)

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000)

      const response = await fetch(healthUrl, { signal: controller.signal })
      clearTimeout(timeoutId)

      if (response.ok) {
        const data = (await response.json()) as any
        if (data.status === 'healthy') {
          logger.info(`[waitForHealthCheck] Health endpoint verified`)
          return true
        }
      }
    } catch (error) {
      // Ignore errors, retry
    }

    if (attempt < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  logger.warn(`[waitForHealthCheck] Health endpoint not available after ${maxRetries} retries`)
  return false
}

/**
 * Register bridge session or resume existing one
 */
async function registerOrResumeSession(): Promise<{ success: boolean; bridgeId: string; token: string; webhookUrl: string } | null> {
  const backendUrl = configManager.getBackendUrl()

  // Check if we can resume existing session
  const existingConfig = configManager.getConfig()
  if (existingConfig && configManager.isTokenValid()) {
    logger.info(`[registerOrResumeSession] Resuming existing session`)
    logger.info(`[registerOrResumeSession] Bridge ID: ${existingConfig.bridgeId}`)
    return {
      success: true,
      bridgeId: existingConfig.bridgeId,
      token: existingConfig.bridgeToken,
      webhookUrl: `${backendUrl}/api/bridge/heartbeat`,
    }
  }

  // Register new session
  logger.info(`[registerOrResumeSession] Starting new registration`)

  // Generate bridge ID if not exists (format: bridge-<32 hex chars no dashes>)
  const uuid = uuidv4().replace(/-/g, '')
  const bridgeId = existingConfig?.bridgeId || `bridge-${uuid}`
  const graphName = existingConfig?.graphName || 'Project_Kinergy' // Default for testing
  const version = '1.0.0'

  const response = await registerWithBackend(backendUrl, {
    bridgeId,
    graphName,
    version,
  })

  if (!response || !response.success || !response.bridgeToken) {
    logger.error(`[registerOrResumeSession] Registration failed: ${response?.error || 'Unknown error'}`)
    return null
  }

  // Save config
  configManager.save({
    version,
    bridgeId,
    graphName,
    bridgeToken: response.bridgeToken,
    backendUrl,
    port: configManager.getPort(),
    endpoint: `http://${configManager.getHost()}:${configManager.getPort()}`,
    registeredAt: new Date().toISOString(),
    tokenExpiresAt: response.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    autoStartEnabled: false,
  })

  logger.info(`[registerOrResumeSession] Registration successful`)
  logger.info(`[registerOrResumeSession] Token expires: ${response.expiresAt}`)

  return {
    success: true,
    bridgeId,
    token: response.bridgeToken,
    webhookUrl: response.webhookUrl || `${backendUrl}/api/bridge/heartbeat`,
  }
}

/**
 * Start heartbeat service
 */
async function startHeartbeat(bridgeId: string, token: string, webhookUrl: string): Promise<void> {
  logger.info(`[startHeartbeat] Initializing heartbeat service`)

  const heartbeatService = getHeartbeatService()
  const result = await heartbeatService.start(bridgeId, token, webhookUrl)

  if (result) {
    logger.info(`[startHeartbeat] Heartbeat started successfully`)
  } else {
    logger.warn(`[startHeartbeat] Heartbeat initialization failed, continuing without heartbeat`)
  }
}

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
      logger.info('No existing config found - will register new session')
    }

    // Get server configuration
    const port = configManager.getPort()
    const host = configManager.getHost()
    const env = process.env.NODE_ENV || 'development'

    logger.info(`Server configuration: ${host}:${port} (${env})`)

    // Create and start server
    server = createServer({ port, host, env })
    await server.start()

    logger.info(`Server started on http://${host}:${port}`)

    // Verify health endpoint
    const healthReady = await waitForHealthCheck(host, port)
    if (!healthReady) {
      logger.warn('Health endpoint not responding, attempting registration anyway')
    }

    // Register or resume session
    const sessionResult = await registerOrResumeSession()
    if (!sessionResult) {
      logger.warn('[startup] Bridge registration failed - CLI fallback will be used')
    } else {
      // Start heartbeat after successful registration/resume
      await startHeartbeat(sessionResult.bridgeId, sessionResult.token, sessionResult.webhookUrl)
      logger.info('[startup] Bridge session ready for QA Ops routing')
    }

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
    // Stop heartbeat
    const heartbeatService = getHeartbeatService()
    heartbeatService.stop()

    // Stop server
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
