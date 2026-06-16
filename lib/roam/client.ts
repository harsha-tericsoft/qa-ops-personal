import { RoamCliService } from './cli-service'
import { decryptApiKey } from './crypto'

export interface RoamPage {
  title: string
  uid: string
  children?: RoamBlock[]
}

export interface RoamBlock {
  string: string
  uid: string
  children?: RoamBlock[]
}

/**
 * RoamClient: Wrapper around RoamCliService
 * Uses official @roam-research/roam-tools-local for local graph access
 * Requires: Roam Desktop running + valid local API token
 */
export class RoamClient {
  private cliService: RoamCliService

  constructor(graphName: string, encryptedToken: string) {
    if (!encryptedToken) {
      throw new Error('RoamClient: encryptedToken is required but undefined')
    }

    // Decrypt the stored token
    const localApiToken = decryptApiKey(encryptedToken)
    this.cliService = new RoamCliService(graphName, localApiToken)
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await this.cliService.testConnection()
      return result.success
    } catch {
      return false
    }
  }

  async fetchAllPages(): Promise<RoamPage[]> {
    try {
      const pages = await this.cliService.getAllPages()
      return pages.map((page) => ({
        title: page.title,
        uid: page.uid,
        children: page.children?.map((block) =>
          this.convertBlockToRoamBlock(block)
        ),
      }))
    } catch (error) {
      console.error('Error fetching pages:', error)
      return []
    }
  }

  async writePage(pageTitle: string, blocks: RoamBlock[]): Promise<void> {
    // Write functionality through CLI is limited
    // This maintains backward compatibility but is not fully implemented
    console.log(`Write to Roam page: ${pageTitle}`, blocks)
  }

  /**
   * Helper: Convert CLI service block format to RoamBlock format
   */
  private convertBlockToRoamBlock(block: any): RoamBlock {
    return {
      string: block.string,
      uid: block.uid,
      children: block.children?.map((child: any) =>
        this.convertBlockToRoamBlock(child)
      ),
    }
  }

  /**
   * Cleanup: Close connection
   */
  async close(): Promise<void> {
    await this.cliService.close()
  }
}
