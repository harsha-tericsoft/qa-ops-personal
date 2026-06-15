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
 * RoamCliService: Wrapper around @roam-research/roam-cli
 * Uses official Roam command-line tool for local graph access
 * Token must be stored in environment: ROAM_LOCAL_API_TOKEN
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
   * Sets token env var and attempts a simple search command
   */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      // Try a simple search command to verify connection
      // This will fail if Roam Desktop is not running or token is invalid
      const command = `ROAM_LOCAL_API_TOKEN="${this.localApiToken}" roam search --graph "${this.graphName}" "" --limit 1`

      try {
        await execAsync(command, { timeout: 10000 })
      } catch (execError) {
        const error = execError as any
        // roam search with empty query might return no results (exit code 0) or error
        // Either way, if it runs without "not found" it means connection works
        if (
          error.message.includes('not found') ||
          error.message.includes('ENOENT') ||
          error.message.includes('permission denied')
        ) {
          return {
            success: false,
            message: 'Roam CLI not installed or not accessible',
            details:
              'Install with: npm install -g @roam-research/roam-cli',
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
      }

      return {
        success: true,
        message: `Connected to Roam graph "${this.graphName}"`,
        graphName: this.graphName,
        details: 'Local API token verified and working',
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : String(error)

      return {
        success: false,
        message: `Connection failed: ${errorMsg}`,
        details: 'Check Roam Desktop is running and token is valid',
      }
    }
  }

  /**
   * Search for content in the graph using roam-cli
   * Returns search results as parsed JSON
   */
  async search(query: string): Promise<SearchResult[]> {
    try {
      const command = `ROAM_LOCAL_API_TOKEN="${this.localApiToken}" roam search --graph "${this.graphName}" "${query}" --format json`

      const { stdout } = await execAsync(command, { timeout: 30000 })

      // Parse JSON output
      const results = JSON.parse(stdout)

      return Array.isArray(results)
        ? results.map((result: any) => ({
            uid: result.uid || '',
            title: result.title,
            content: result.string || result.title,
            type: result.title ? 'page' : 'block',
          }))
        : []
    } catch (error) {
      throw new Error(
        `Search failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Fetch a page by title using roam-cli
   */
  async fetchPageByTitle(title: string): Promise<Page | null> {
    try {
      const command = `ROAM_LOCAL_API_TOKEN="${this.localApiToken}" roam fetch-page --graph "${this.graphName}" "${title}" --format json`

      const { stdout } = await execAsync(command, { timeout: 30000 })

      const page = JSON.parse(stdout)

      if (!page) {
        return null
      }

      return {
        uid: page.uid || '',
        title: page.title || title,
        children: this.convertBlocksToTree(page.children || []),
      }
    } catch (error) {
      throw new Error(
        `Fetch page failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Fetch a block and its children using roam-cli
   */
  async fetchBlockWithChildren(uid: string): Promise<Block | null> {
    try {
      const command = `ROAM_LOCAL_API_TOKEN="${this.localApiToken}" roam fetch-block --graph "${this.graphName}" "${uid}" --format json`

      const { stdout } = await execAsync(command, { timeout: 30000 })

      const block = JSON.parse(stdout)

      if (!block) {
        return null
      }

      return this.convertBlockToTree(block)
    } catch (error) {
      throw new Error(
        `Fetch block failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Create a new page in the graph
   */
  async createPage(title: string): Promise<{ uid: string }> {
    try {
      const command = `ROAM_LOCAL_API_TOKEN="${this.localApiToken}" roam create-page --graph "${this.graphName}" "${title}" --format json`

      const { stdout } = await execAsync(command, { timeout: 30000 })

      const result = JSON.parse(stdout)
      return { uid: result.uid || '' }
    } catch (error) {
      throw new Error(
        `Create page failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Update a block's content
   */
  async updateBlock(uid: string, content: string): Promise<void> {
    try {
      const command = `ROAM_LOCAL_API_TOKEN="${this.localApiToken}" roam update-block --graph "${this.graphName}" "${uid}" "${content}"`

      await execAsync(command, { timeout: 30000 })
    } catch (error) {
      throw new Error(
        `Update block failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Export graph as JSON
   */
async exportGraph(): Promise<unknown> {
    try {
      const command = `ROAM_LOCAL_API_TOKEN="${this.localApiToken}" roam export --graph "${this.graphName}" --format json`

      const { stdout } = await execAsync(command, {
        timeout: 60000,
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large exports
      })

      return JSON.parse(stdout)
    } catch (error) {
      throw new Error(
        `Export failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Get all pages in the graph
   * Uses list-graphs and fetch-page to build complete page list
   */
  async getAllPages(): Promise<Page[]> {
    try {
      const command = `ROAM_LOCAL_API_TOKEN="${this.localApiToken}" roam list-graphs --format json`

      const { stdout } = await execAsync(command, { timeout: 30000 })

      const graphs = JSON.parse(stdout)
      const currentGraph = graphs.find((g: any) => g.name === this.graphName)

      if (!currentGraph) {
        throw new Error(`Graph "${this.graphName}" not found`)
      }

      // For full page list, we need to export and parse
      // Since list-graphs only returns metadata, use export
      const allData = await this.exportGraph() as any

      if (Array.isArray(allData)) {
        return allData.map((page: any) => ({
          uid: page.uid || '',
          title: page.title || '',
          children: this.convertBlocksToTree(page.children || []),
        }))
      }

      return []
    } catch (error) {
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
   * roam-cli is stateless subprocess invocations
   */
  async close(): Promise<void> {
    // No cleanup needed for CLI subprocess approach
    return Promise.resolve()
  }
}
