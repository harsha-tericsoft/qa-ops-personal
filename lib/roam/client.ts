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
    console.log('[RoamClient.constructor] Started with graphName:', graphName)

    if (!encryptedToken) {
      console.error('[RoamClient.constructor] ERROR: encryptedToken is missing')
      throw new Error('RoamClient: encryptedToken is required but undefined')
    }

    console.log('[RoamClient.constructor] encryptedToken provided, length:', encryptedToken.length)

    // Decrypt the stored token
    try {
      console.log('[RoamClient.constructor] Calling decryptApiKey...')
      const localApiToken = decryptApiKey(encryptedToken)
      console.log('[RoamClient.constructor] Token decrypted successfully, length:', localApiToken.length)

      console.log('[RoamClient.constructor] Creating RoamCliService...')
      this.cliService = new RoamCliService(graphName, localApiToken)
      console.log('[RoamClient.constructor] RoamCliService created successfully')
    } catch (error) {
      console.error('[RoamClient.constructor] ERROR during initialization:')
      console.error('[RoamClient.constructor] Error message:', error instanceof Error ? error.message : String(error))
      console.error('[RoamClient.constructor] Stack:', error instanceof Error ? error.stack : '')
      throw error
    }
  }

  async testConnection(): Promise<boolean> {
    console.log('[RoamClient.testConnection] Called')
    try {
      console.log('[RoamClient.testConnection] Calling cliService.testConnection()...')
      const result = await this.cliService.testConnection()
      console.log('[RoamClient.testConnection] Result received:', result.success ? 'SUCCESS' : 'FAILED')
      return result.success
    } catch (error) {
      console.error('[RoamClient.testConnection] Exception caught:')
      console.error('[RoamClient.testConnection] Error:', error instanceof Error ? error.message : String(error))
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
