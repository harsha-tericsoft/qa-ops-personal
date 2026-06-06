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
  private apiKey: string
  private baseUrl = 'https://api.roamresearch.com/api/graph'

  constructor(graphName: string, apiKey: string) {
    this.graphName = graphName
    this.apiKey = apiKey
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
    return this.formatPages(results)
  }

  async writePage(pageTitle: string, blocks: RoamBlock[]): Promise<void> {
    // This would use Roam's write API - not fully implemented for now
    // as export is secondary to import for read-only safety
    console.log(`Write to Roam page: ${pageTitle}`, blocks)
  }

  private async queryDatalog(query: string): Promise<unknown> {
    const url = `${this.baseUrl}/${this.graphName}/q`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Roam API error: ${response.status} ${error}`)
    }

    const data = await response.json()
    return data
  }

  private formatPages(results: unknown[]): RoamPage[] {
    // This would transform Roam's response format to our format
    // For now, return empty array
    return []
  }
}
