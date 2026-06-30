/**
 * Roam Bridge Service Layer
 * Wraps RoamCliClient and provides structured API responses
 */

import { createLogger } from '../../logging/logger'
import { RoamCliClient } from './roam-cli-client'
import { ConnectionTestResult, Page, SearchResult } from './types'

const logger = createLogger('roam-service')

export class RoamBridgeService {
  private client: RoamCliClient

  constructor(graphName: string, apiToken: string) {
    this.client = new RoamCliClient(graphName, apiToken)
  }

  /**
   * Test connection to Roam graph
   */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      logger.info('[testConnection] Starting connection test')
      const result = await this.client.testConnection()
      logger.info(`[testConnection] Result: ${result.success ? 'success' : 'failed'}`)
      return result
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(`[testConnection] Error: ${errorMsg}`)
      return {
        success: false,
        message: `Connection test failed: ${errorMsg}`,
        details: 'An unexpected error occurred during the connection test',
      }
    }
  }

  /**
   * Search the Roam graph
   * Matches QA Ops: allows empty queries (returns recently edited/viewed)
   */
  async search(query: string): Promise<{ success: boolean; results?: SearchResult[]; error?: string }> {
    try {
      logger.info(`[search] Starting search for: "${query || '(empty query - recent items)'}"`)
      const results = await this.client.search(query)
      logger.info(`[search] Found ${results.length} results`)

      return {
        success: true,
        results,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(`[search] Error: ${errorMsg}`)
      return {
        success: false,
        error: errorMsg,
      }
    }
  }

  /**
   * Fetch a page by title
   */
  async getPage(title: string): Promise<{ success: boolean; page?: Page; error?: string }> {
    try {
      if (!title || title.trim() === '') {
        logger.warn('[getPage] Empty title provided')
        return {
          success: false,
          error: 'Page title cannot be empty',
        }
      }

      logger.info(`[getPage] Fetching page: "${title}"`)
      const page = await this.client.fetchPageByTitle(title)

      if (!page) {
        logger.warn(`[getPage] Page not found: "${title}"`)
        return {
          success: false,
          error: `Page "${title}" not found`,
        }
      }

      logger.info(`[getPage] Successfully fetched page: "${title}"`)
      return {
        success: true,
        page,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(`[getPage] Error: ${errorMsg}`)
      return {
        success: false,
        error: errorMsg,
      }
    }
  }

  /**
   * Fetch a block by UID
   */
  async getBlock(uid: string): Promise<{ success: boolean; block?: any; error?: string }> {
    try {
      if (!uid || uid.trim() === '') {
        logger.warn('[getBlock] Empty UID provided')
        return {
          success: false,
          error: 'Block UID cannot be empty',
        }
      }

      logger.info(`[getBlock] Fetching block: "${uid}"`)
      const block = await this.client.fetchBlockWithChildren(uid)

      if (!block) {
        logger.warn(`[getBlock] Block not found: "${uid}"`)
        return {
          success: false,
          error: `Block "${uid}" not found`,
        }
      }

      logger.info(`[getBlock] Successfully fetched block: "${uid}"`)
      return {
        success: true,
        block,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(`[getBlock] Error: ${errorMsg}`)
      return {
        success: false,
        error: errorMsg,
      }
    }
  }
}
