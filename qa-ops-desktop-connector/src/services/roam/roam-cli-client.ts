/**
 * Native Roam CLI Client
 * Executes Roam CLI commands and parses responses
 * Independent implementation (no QA Ops dependencies)
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { createLogger } from '../../logging/logger'
import { Block, Page, SearchResult } from './types'
import { MarkdownRoamParser, RoamMarkdownBlock } from './markdown-parser'

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

      const startTime = Date.now()
      logger.info(`[testConnection] Executing CLI command: ${command}`)

      try {
        const { stdout, stderr } = await execAsync(command, {
          timeout: 10000,
          env: {
            ...process.env,
            ROAM_LOCAL_API_TOKEN: this.apiToken,
          },
        })

        const duration = Date.now() - startTime
        logger.info(`[testConnection] Success (${duration}ms)`)
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
        const exitCode = error.code || 'unknown'

        logger.error(`[testConnection] Command failed with exit code ${exitCode}: ${errorMsg}`)
        if (stderr) logger.error(`[testConnection] stderr: ${stderr.substring(0, 500)}`)

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
      const startTime = Date.now()

      logger.info(`[search] Executing CLI command: ${command.substring(0, 100)}...`)

      const { stdout } = await execAsync(command, {
        timeout: 30000,
        env: {
          ...process.env,
          ROAM_LOCAL_API_TOKEN: this.apiToken,
        },
      })

      const duration = Date.now() - startTime
      logger.info(`[search] Success (${duration}ms)`)

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
      const startTime = Date.now()

      logger.info(`[fetchPageByTitle] Executing CLI command: ${command.substring(0, 100)}...`)

      const { stdout } = await execAsync(command, {
        timeout: 30000,
        env: {
          ...process.env,
          ROAM_LOCAL_API_TOKEN: this.apiToken,
        },
      })

      const duration = Date.now() - startTime
      logger.info(`[fetchPageByTitle] Success (${duration}ms)`)

      // TRACE 1: Complete raw stdout (not truncated)
      logger.info(`\n[TRACE 1] Complete raw stdout from 'roam get-page':`)
      logger.info(stdout)
      logger.info(`[TRACE 1] Total stdout length: ${stdout.length} characters`)

      const page = JSON.parse(stdout)

      // TRACE 2: After JSON.parse()
      logger.info(`\n[TRACE 2] After JSON.parse()`)
      logger.info(`  page.uid: ${page?.uid}`)
      logger.info(`  page.markdown exists: ${!!page?.markdown}`)
      logger.info(`  page.markdown length: ${page?.markdown?.length || 0}`)

      if (!page || !page.uid) {
        return null
      }

      // TRACE 3: Parse markdown to tree
      logger.info(`\n[TRACE 3] Parsing markdown to tree`)
      const parsedTree = MarkdownRoamParser.parseMarkdown(page.markdown || '', title, page.uid)

      if (!parsedTree) {
        logger.warn('[TRACE 3] Markdown parser returned null')
        return null
      }

      logger.info(`  Parsed tree children count: ${parsedTree.children.length}`)

      // TRACE 4: Convert RoamMarkdownBlock to Block structure
      logger.info(`\n[TRACE 4] Converting to Block structure`)
      const children = parsedTree.children.map((block) => this.convertMarkdownBlockToBlock(block))
      logger.info(`  Converted children count: ${children.length}`)

      const result = {
        uid: page.uid || '',
        title: title,
        children: children,
      }

      // STAGE 2: Final summary
      const countNodes = (node: any): number => {
        return 1 + (node.children ? node.children.reduce((sum: number, child: any) => sum + countNodes(child), 0) : 0)
      }
      const totalNodesInResult = countNodes(result)

      logger.info(`\n[STAGE 2] Roam CLI fetchPageByTitle() output`)
      logger.info(`  Root UID: ${result.uid}`)
      logger.info(`  Root Title: ${result.title}`)
      logger.info(`  Root direct children: ${result.children.length}`)
      logger.info(`  Total recursive nodes: ${totalNodesInResult}`)

      return result
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
   * Convert RoamMarkdownBlock to Block structure
   * Used when parsing markdown from roam get-page command
   */
  private convertMarkdownBlockToBlock(block: RoamMarkdownBlock): Block {
    return {
      uid: block.uid,
      string: block.text,
      children: block.children.length > 0 ? block.children.map((child) => this.convertMarkdownBlockToBlock(child)) : undefined,
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
