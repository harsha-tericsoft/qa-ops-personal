import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface ConnectionTestResult {
  success: boolean
  message: string
  graphName?: string
  details?: string
}

export interface SearchResult {
  uid: string
  title?: string
  content?: string
  type: 'page' | 'block'
}

export interface Block {
  uid: string
  string: string
  children?: Block[]
}

export interface Page {
  uid: string
  title: string
  children?: Block[]
}

/**
 * RoamCliService: Wrapper around @roam-research/roam-cli v0.7.4
 * Uses official Roam command-line tool for local graph access
 */
export class RoamCliService {
  private graphName: string
  private localApiToken: string

  constructor(graphName: string, localApiToken: string) {
    this.graphName = graphName
    this.localApiToken = localApiToken
  }

  /**
   * Test connection to Roam Desktop
   * Uses: roam search --graph <name> --query="" --limit 1
   */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      // Verify connection by searching with empty query (returns recently edited)
      const command = `ROAM_LOCAL_API_TOKEN="${this.localApiToken}" roam search --graph "${this.graphName}" --query=""`

      console.log('[RoamCliService.testConnection] Executing command:', command)

      try {
        const { stdout, stderr } = await execAsync(command, { timeout: 10000 })
        console.log('[RoamCliService.testConnection] Success')
        console.log('[RoamCliService.testConnection] stdout:', stdout.substring(0, 200))
        if (stderr) console.log('[RoamCliService.testConnection] stderr:', stderr)

        return {
          success: true,
          message: `Connected to Roam graph "${this.graphName}"`,
          graphName: this.graphName,
          details: 'Local API token verified and working',
        }
      } catch (execError) {
        const error = execError as any
        console.error('[RoamCliService.testConnection] Command failed')
        console.error('[RoamCliService.testConnection] Error message:', error.message)
        console.error('[RoamCliService.testConnection] Error code:', error.code)
        console.error('[RoamCliService.testConnection] stderr:', error.stderr)

        if (
          error.message.includes('not found') ||
          error.message.includes('ENOENT') ||
          error.message.includes('permission denied')
        ) {
          return {
            success: false,
            message: 'Roam CLI not installed or not accessible',
            details: 'Install with: npm install -g @roam-research/roam-cli',
          }
        }

        if (error.message.includes('Token') || error.message.includes('token')) {
          return {
            success: false,
            message: 'Invalid or expired local API token',
            details:
              'Generate a new token in Roam Desktop Settings → API → Local API Tokens',
          }
        }

        if (error.message.includes('graph') || error.message.includes('Graph')) {
          return {
            success: false,
            message: `Graph "${this.graphName}" not found`,
            details:
              'Ensure the graph exists in Roam Desktop and the name is spelled correctly',
          }
        }

        if (error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
          return {
            success: false,
            message: 'Cannot connect to Roam Desktop',
            details: 'Ensure Roam Desktop is running and the local API is enabled',
          }
        }

        return {
          success: false,
          message: `Connection failed: ${error.message}`,
          details: 'Check Roam Desktop is running and token is valid',
        }
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : String(error)

      return {
        success: false,
        message: `Connection test error: ${errorMsg}`,
        details: 'Unexpected error during connection test',
      }
    }
  }

  /**
   * Search for content in the graph
   * Uses: roam search --graph <name> --query <query>
   */
  async search(query: string): Promise<SearchResult[]> {
    try {
      const command = `ROAM_LOCAL_API_TOKEN="${this.localApiToken}" roam search --graph "${this.graphName}" --query="${query}"`

      console.log('[RoamCliService.search] Executing command:', command.substring(0, 100) + '...')

      const { stdout } = await execAsync(command, { timeout: 30000 })

      console.log('[RoamCliService.search] Success, results received')

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
      console.error('[RoamCliService.search] Error:', error instanceof Error ? error.message : String(error))
      throw new Error(
        `Search failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Fetch a page by title
   * Uses: roam get-page --graph <name> --title <title>
   */
  async fetchPageByTitle(title: string): Promise<Page | null> {
    try {
      const command = `ROAM_LOCAL_API_TOKEN="${this.localApiToken}" roam get-page --graph "${this.graphName}" --title="${title}"`

      console.log('[RoamCliService.fetchPageByTitle] Executing command:', command.substring(0, 100) + '...')

      const { stdout } = await execAsync(command, { timeout: 30000 })

      console.log('[RoamCliService.fetchPageByTitle] Success, page received')

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
      console.error('[RoamCliService.fetchPageByTitle] Error:', error instanceof Error ? error.message : String(error))
      throw new Error(
        `Fetch page failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Fetch a block and its children
   * Uses: roam get-block --graph <name> --uid <uid>
   */
  async fetchBlockWithChildren(uid: string): Promise<Block | null> {
    try {
      const command = `ROAM_LOCAL_API_TOKEN="${this.localApiToken}" roam get-block --graph "${this.graphName}" --uid="${uid}"`

      console.log('[RoamCliService.fetchBlockWithChildren] Executing command:', command.substring(0, 100) + '...')

      const { stdout } = await execAsync(command, { timeout: 30000 })

      console.log('[RoamCliService.fetchBlockWithChildren] Success, block received')

      const block = JSON.parse(stdout)

      if (!block) {
        return null
      }

      return this.convertBlockToTree(block)
    } catch (error) {
      console.error('[RoamCliService.fetchBlockWithChildren] Error:', error instanceof Error ? error.message : String(error))
      throw new Error(
        `Fetch block failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Create a new page in the graph
   * Uses: roam create-page --graph <name> --title <title>
   */
  async createPage(title: string): Promise<{ uid: string }> {
    try {
      const command = `ROAM_LOCAL_API_TOKEN="${this.localApiToken}" roam create-page --graph "${this.graphName}" --title="${title}"`

      console.log('[RoamCliService.createPage] Executing command:', command.substring(0, 100) + '...')

      const { stdout } = await execAsync(command, { timeout: 30000 })

      console.log('[RoamCliService.createPage] Success, page created')

      const result = JSON.parse(stdout)
      return { uid: result.uid || '' }
    } catch (error) {
      console.error('[RoamCliService.createPage] Error:', error instanceof Error ? error.message : String(error))
      throw new Error(
        `Create page failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Update a block's content
   * Uses: roam update-block --graph <name> --uid <uid> --content <content>
   */
  async updateBlock(uid: string, content: string): Promise<void> {
    try {
      const command = `ROAM_LOCAL_API_TOKEN="${this.localApiToken}" roam update-block --graph "${this.graphName}" --uid="${uid}" --content="${content}"`

      console.log('[RoamCliService.updateBlock] Executing command:', command.substring(0, 100) + '...')

      await execAsync(command, { timeout: 30000 })

      console.log('[RoamCliService.updateBlock] Success, block updated')
    } catch (error) {
      console.error('[RoamCliService.updateBlock] Error:', error instanceof Error ? error.message : String(error))
      throw new Error(
        `Update block failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Export graph as JSON
   * Uses: roam datalog-query for exporting structured data
   * Note: roam export command does not exist in v0.7.4
   */
  async exportGraph(): Promise<unknown> {
    try {
      // Query to get all pages with basic structure
      const datalogQuery = '[:find ?e :where [?e :node/title]]'
      const command = `ROAM_LOCAL_API_TOKEN="${this.localApiToken}" roam datalog-query --graph "${this.graphName}" --query="${datalogQuery}"`

      console.log('[RoamCliService.exportGraph] Executing command:', command.substring(0, 100) + '...')

      const { stdout } = await execAsync(command, {
        timeout: 60000,
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large exports
      })

      console.log('[RoamCliService.exportGraph] Success, data exported')

      return JSON.parse(stdout)
    } catch (error) {
      console.error('[RoamCliService.exportGraph] Error:', error instanceof Error ? error.message : String(error))
      throw new Error(
        `Export failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Get all pages in the graph
   * Uses: roam datalog-query to find all pages
   */
  async getAllPages(): Promise<Page[]> {
    try {
      // Query to get all pages with titles
      const datalogQuery = '[:find ?e ?title :where [?e :node/title ?title]]'
      const command = `ROAM_LOCAL_API_TOKEN="${this.localApiToken}" roam datalog-query --graph "${this.graphName}" --query="${datalogQuery}"`

      console.log('[RoamCliService.getAllPages] Executing command:', command.substring(0, 100) + '...')

      const { stdout } = await execAsync(command, { timeout: 60000 })

      console.log('[RoamCliService.getAllPages] Success, pages retrieved')

      const results = JSON.parse(stdout)

      // Parse datalog results - format is [[uid, title], ...]
      if (Array.isArray(results)) {
        return results.map((row: any) => ({
          uid: row[0] || '',
          title: row[1] || '',
          children: [],
        }))
      }

      return []
    } catch (error) {
      console.error('[RoamCliService.getAllPages] Error:', error instanceof Error ? error.message : String(error))
      throw new Error(
        `Get pages failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Helper: Convert block to tree structure
   */
  private convertBlockToTree(block: any): Block {
    return {
      uid: block.uid || '',
      string: block.string || block.title || '',
      children: this.convertBlocksToTree(block.children || []),
    }
  }

  /**
   * Helper: Convert array of blocks to tree structure
   */
  private convertBlocksToTree(blocks: any[]): Block[] {
    return blocks.map((block) => this.convertBlockToTree(block))
  }

  /**
   * Cleanup: No persistent connection to close
   */
  async close(): Promise<void> {
    return Promise.resolve()
  }
}
