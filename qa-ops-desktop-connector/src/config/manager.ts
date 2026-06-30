/**
 * Configuration Manager for Desktop Connector
 * Handles reading/writing configuration from ~/.qa-ops-bridge/config.json
 */

import fs from 'fs'
import path from 'path'
import { createLogger } from '../logging/logger'

const logger = createLogger('config')

export interface ConnectorConfig {
  version: string
  bridgeId: string
  graphName: string
  apiToken?: string
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
    const home = process.env.HOME || process.env.USERPROFILE || ''
    const configDir = path.join(home, '.qa-ops-bridge')
    return path.join(configDir, 'config.json')
  }

  load(): ConnectorConfig | null {
    try {
      logger.info(`Loading config from ${this.configPath}`)
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8')
        this.config = JSON.parse(data) as ConnectorConfig
        logger.info('Configuration loaded successfully')
        return this.config
      } else {
        logger.info('No existing config file found')
        this.config = null
        return null
      }
    } catch (error) {
      logger.warn(`Failed to load config: ${error instanceof Error ? error.message : String(error)}`)
      this.config = null
      return null
    }
  }

  save(config: Partial<ConnectorConfig>): void {
    try {
      this.config = { ...(this.config || {}), ...config } as ConnectorConfig
      const configDir = path.dirname(this.configPath)

      // Create directory if it doesn't exist
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
        logger.info(`Created config directory: ${configDir}`)
      }

      // Write config file
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8')
      logger.info(`Configuration saved to ${this.configPath}`)
    } catch (error) {
      logger.error(`Failed to save config: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  getConfig(): ConnectorConfig | null {
    return this.config
  }

  getToken(): string | null {
    if (!this.config?.bridgeToken) return null
    if (!this.isTokenValid()) return null
    return this.config.bridgeToken
  }

  isTokenValid(): boolean {
    if (!this.config?.tokenExpiresAt) return false
    const expiresAt = new Date(this.config.tokenExpiresAt)
    return expiresAt > new Date()
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
