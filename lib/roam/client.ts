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

export class RoamClient {
  private graphName: string
  private apiToken: string
  private apiEndpoint: string

  constructor(
    graphName: string,
    apiToken: string,
    apiEndpoint: string = 'http://localhost:8000'
  ) {
    this.graphName = graphName
    this.apiToken = apiToken
    this.apiEndpoint = apiEndpoint
  }

  async testConnection(): Promise<boolean> {
    try {
      const query = '[:find ?e :where [?e :node/title "roam/db"]]'
      await this.queryDatalog(query)
      return true
    } catch {
      return false
    }
  }

  async fetchAllPages(): Promise<RoamPage[]> {
    const query = `
      [:find (pull ?page [:node/title :node/uid {:node/children [...]}])
       :where [?page :node/title ?title]]
    `
    const results = await this.queryDatalog(query)
    return this.formatPages(Array.isArray(results) ? results : [])
  }

  async writePage(pageTitle: string, blocks: RoamBlock[]): Promise<void> {
    // This would use Roam's write API - not fully implemented for now
    // as export is secondary to import for read-only safety
    console.log(`Write to Roam page: ${pageTitle}`, blocks)
  }

  private async queryDatalog(query: string): Promise<unknown> {
    const url = `${this.apiEndpoint}/api/graph/${this.graphName}/q`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      })

      if (!response.ok) {
        // Detailed error messages for common failures
        if (response.status === 502 || response.status === 503) {
          throw new Error(
            `Roam server not running. Check that Roam Desktop is running at ${this.apiEndpoint}`
          )
        }
        if (response.status === 404) {
          throw new Error(
            `Graph "${this.graphName}" not found. Verify the graph name in Roam.`
          )
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error('Invalid API token. Check your Roam API token.')
        }

        const error = await response.text()
        throw new Error(`Roam API error: ${response.status} ${error}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      if (error instanceof Error && error.message.includes('fetch')) {
        throw new Error(
          `Cannot reach Roam at ${this.apiEndpoint}. Check endpoint and network.`
        )
      }
      throw error
    }
  }

  private formatPages(results: unknown[]): RoamPage[] {
    // This would transform Roam's response format to our format
    // For now, return empty array
    return []
  }
}
