/**
 * Type definitions for Roam CLI operations
 */

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

export interface RoamCliConfig {
  graphName: string
  apiToken: string
}
