/**
 * Native Roam CLI Client
 * Executes Roam CLI commands and parses responses
 * Independent implementation (no QA Ops dependencies)
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { createLogger } from '../../logging/logger'
import { Block, Page, SearchResult } from './types'

const execAsync = promisify(exec)
const logger = createLogger('roam-cli')

export class RoamCliClient {
  private graphName: string
  private apiToken: string

  constructor(graphName: string, apiToken: string) {
    this.graphName = graphName
    this.apiToken = apiToken
  }

  /**
   * Test connection to Roam Desktop
   * Executes: roam search --graph <name> --query=""
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: string }> {
    try {
      const command = `roam search --graph "${this.graphName}" --query=""`

      logger.info(`[testConnection] Executing: ${command}`)

      try {
        const { stdout, stderr } = await execAsync(command, {
          timeout: 10000,
          env: {
            ...process.env,
            ROAM_LOCAL_API_TOKEN: this.apiToken,
          },
        })

        logger.info('[testConnection] Success')
        if (stderr) logger.info(`[testConnection] stderr: ${stderr.substring(0, 200)}`)

        return {
          success: true,
          message: `Connected to Roam graph "${this.graphName}"`,
          details: 'Local API token verified and working',
        }
      } catch (execError) {
        const error = execError as any
        const errorMsg = error.message || ''
        const stderr = error.stderr || ''

        logger.error(`[testConnection] Command failed: ${errorMsg}`)

        // CLI not installed
        if (errorMsg.includes('not found') || errorMsg.includes('ENOENT') || errorMsg.includes('permission denied')) {
          return {
            success: false,
            message: 'Roam CLI not installed or not accessible',
            details: 'Install with: npm install -g @roam-research/roam-cli',
          }
        }

        // Invalid token
        if (errorMsg.includes('Token') || errorMsg.includes('token') || stderr.includes('token')) {
          return {
            success: false,
            message: 'Invalid or expired local API token',
            details: 'Generate a new token in Roam Desktop Settings → API → Local API Tokens',
          }
        }

        // Graph not found
        if (errorMsg.includes('graph') || errorMsg.includes('Graph') || stderr.includes('graph')) {
          return {
            success: false,
            message: `Graph "${this.graphName}" not found`,
            details: 'Ensure the graph exists in Roam Desktop and the name is spelled correctly',
          }
        }

        // Connection refused
        if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('connection')) {
          return {
            success: false,
            message: 'Cannot connect to Roam Desktop',
            details: 'Ensure Roam Desktop is running and the local API is enabled',
          }
        }

        return {
          success: false,
          message: `Connection failed: ${errorMsg}`,
          details: 'Check Roam Desktop is running and token is valid',
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)

      return {
        success: false,
        message: `Connection test error: ${errorMsg}`,
        details: 'Unexpected error during connection test',
      }
    }
  }

  /**
   * Search for content in the graph
   * Executes: roam search --graph <name> --query <query>
   */
  async search(query: string): Promise<SearchResult[]> {
    try {
      const command = `roam search --graph "${this.graphName}" --query="${query}"`

      logger.info(`[search] Executing: roam search --graph "${this.graphName}" --query="<query>"`)

      const { stdout } = await execAsync(command, {
        timeout: 30000,
        env: {
          ...process.env,
          ROAM_LOCAL_API_TOKEN: this.apiToken,
        },
      })

      logger.info('[search] Success')

      // Parse JSON output
      const results = JSON.parse(stdout)

      // Handle both search results and suggestions formats
      const items = results.results || results.suggestions?.recentlyEditedPages || []

      return Array.isArray(items)
        ? items.map((result: any) => ({
            uid: result.uid || '',
            title: result.title,
            content: result.markdown || result.string || result.title,
            type: result.type || (result.title ? 'page' : 'block'),
          }))
        : []
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(`[search] Error: ${errorMsg}`)
      throw new Error(`Search failed: ${errorMsg}`)
    }
  }

  /**
   * Fetch a page by title
   * Executes: roam get-page --graph <name> --title <title>
   */
  async fetchPageByTitle(title: string): Promise<Page | null> {
    try {
      const command = `roam get-page --graph "${this.graphName}" --title="${title}"`

      logger.info(`[fetchPageByTitle] Executing: roam get-page --graph "${this.graphName}" --title="<title>"`)

      const { stdout } = await execAsync(command, {
        timeout: 30000,
        env: {
          ...process.env,
          ROAM_LOCAL_API_TOKEN: this.apiToken,
        },
      })

      logger.info('[fetchPageByTitle] Success')

      const page = JSON.parse(stdout)

      if (!page || !page.uid) {
        return null
      }

      return {
        uid: page.uid || '',
        title: page.title || title,
        children: this.convertBlocksToTree(page.children || []),
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(`[fetchPageByTitle] Error: ${errorMsg}`)
      throw new Error(`Fetch page failed: ${errorMsg}`)
    }
  }

  /**
   * Fetch a block and its children
   * Executes: roam get-block --graph <name> --uid <uid>
   */
  async fetchBlockWithChildren(uid: string): Promise<Block | null> {
    try {
      const command = `roam get-block --graph "${this.graphName}" --uid="${uid}"`

      logger.info(`[fetchBlockWithChildren] Executing: roam get-block --graph "${this.graphName}" --uid="<uid>"`)

      const { stdout } = await execAsync(command, {
        timeout: 30000,
        env: {
          ...process.env,
          ROAM_LOCAL_API_TOKEN: this.apiToken,
        },
      })

      logger.info('[fetchBlockWithChildren] Success')

      const block = JSON.parse(stdout)

      if (!block) {
        return null
      }

      return this.convertBlockToTree(block)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(`[fetchBlockWithChildren] Error: ${errorMsg}`)
      throw new Error(`Fetch block failed: ${errorMsg}`)
    }
  }

  /**
   * Convert flat block list to tree structure
   */
  private convertBlocksToTree(blocks: any[]): Block[] {
    return blocks.map((block) => this.convertBlockToTree(block))
  }

  /**
   * Convert single block to tree structure
   * Matches QA Ops behavior: string || title (fallback for edge cases)
   */
  private convertBlockToTree(block: any): Block {
    return {
      uid: block.uid || '',
      string: block.string || block.title || '',
      children: block.children ? this.convertBlocksToTree(block.children) : undefined,
    }
  }

  /**
   * Cleanup: No persistent connection to close
   * Provided for API consistency with RoamCliService
   */
  async close(): Promise<void> {
    return Promise.resolve()
  }
}
