/**
 * Configuration Manager for Desktop Connector
 * Handles reading/writing configuration from ~/.qa-ops-bridge/config.json
 */

import { createLogger } from '../logging/logger'

const logger = createLogger('config')

export interface ConnectorConfig {
  version: string
  bridgeId: string
  graphName: string
  apiToken?: string // Encrypted
  bridgeToken: string
  backendUrl: string
  port: number
  endpoint: string
  registeredAt: string
  tokenExpiresAt: string
  autoStartEnabled: boolean
}

export class ConfigManager {
  private config: ConnectorConfig | null = null
  private configPath: string

  constructor(configPath?: string) {
    this.configPath = configPath || this.getDefaultConfigPath()
  }

  private getDefaultConfigPath(): string {
    const home = process.env.HOME || process.env.USERPROFILE || '~'
    return `${home}/.qa-ops-bridge/config.json`
  }

  load(): ConnectorConfig | null {
    try {
      logger.info(`Loading config from ${this.configPath}`)
      // In Milestone 1, we're just setting up the framework
      // Actual file I/O will be implemented in future milestones
      this.config = null
      return this.config
    } catch (error) {
      logger.warn(`Failed to load config: ${error instanceof Error ? error.message : String(error)}`)
      return null
    }
  }

  save(config: Partial<ConnectorConfig>): void {
    try {
      logger.info(`Saving config to ${this.configPath}`)
      // In Milestone 1, we're just setting up the framework
      // Actual file I/O will be implemented in future milestones
      this.config = { ...(this.config || {}), ...config } as ConnectorConfig
    } catch (error) {
      logger.error(`Failed to save config: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  getConfig(): ConnectorConfig | null {
    return this.config
  }

  getBackendUrl(): string {
    return process.env.BACKEND_URL || 'http://localhost:3000'
  }

  getPort(): number {
    const port = process.env.PORT || '7890'
    return parseInt(port, 10)
  }

  getHost(): string {
    return process.env.HOST || '127.0.0.1'
  }

  clear(): void {
    this.config = null
    logger.info('Configuration cleared')
  }
}

// Global config instance
export const configManager = new ConfigManager()
