/**
 * Desktop Connector (Bridge) Type Definitions
 * Provides type-safe interfaces for bridge operations
 */

// Bridge Token Status
export enum BridgeTokenStatusEnum {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

// Bridge Session Status
export enum BridgeSessionStatusEnum {
  CONNECTED = 'CONNECTED',
  OFFLINE = 'OFFLINE',
  DEGRADED = 'DEGRADED',
}

// Bridge Token (Database Model)
export interface BridgeToken {
  id: string
  userId: string
  bridgeId: string
  token: string
  graphName: string
  status: BridgeTokenStatusEnum
  expiresAt: Date
  createdAt: Date
  lastUsedAt: Date | null
  refreshToken: string | null
}

// Bridge Session (Database Model)
export interface BridgeSession {
  id: string
  userId: string
  bridgeTokenId: string
  endpoint: string // e.g., "http://localhost:7890"
  status: BridgeSessionStatusEnum
  lastHealthCheckAt: Date | null
  lastHealthCheckStatus: string | null
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

// Bridge Log (Database Model)
export interface BridgeLog {
  id: string
  userId: string
  bridgeSessionId: string | null
  bridgeId: string
  action: string
  status: string
  requestId: string | null
  durationMs: number | null
  error: string | null
  createdAt: Date
}

// Bridge Registration Request (from Bridge to Backend)
export interface BridgeRegisterRequest {
  bridgeId: string
  graphName: string
  publicKey: string
  version: string
  os?: string
  hostname?: string
}

// Bridge Registration Response (from Backend to Bridge)
export interface BridgeRegisterResponse {
  bridgeToken: string
  expiresAt: string // ISO 8601
  webhookUrl: string
  graphName: string
}

// Bridge Heartbeat Request (from Bridge to Backend)
export interface BridgeHeartbeatRequest {
  bridgeId: string
  status: BridgeSessionStatusEnum
  uptime: number // seconds
  requestsProcessed: number
  errorsInLast30s: number
  roamStatus: 'CONNECTED' | 'CONNECTING' | 'OFFLINE'
  lastError?: string
}

// Bridge Heartbeat Response (from Backend to Bridge)
export interface BridgeHeartbeatResponse {
  acknowledged: boolean
  nextHeartbeatAt: string // ISO 8601
}

// Bridge Health Status
export interface BridgeHealthStatus {
  status: BridgeSessionStatusEnum
  bridgeId: string
  graphName: string
  uptime: number // seconds
  requestsProcessed: number
  lastRequestAt: string | null // ISO 8601
}

// Bridge Request (from Backend to Bridge)
export interface BridgeRequest {
  projectId: string
  syncType?: 'initial' | 'refresh'
  action?: string
  params?: Record<string, unknown>
}

// Bridge Response (from Bridge to Backend)
export interface BridgeResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  code?: string
  requestId?: string
  duration?: number // milliseconds
}

// Roam MCP Connection Status
export type RoamMCPStatus = 'CONNECTED' | 'CONNECTING' | 'OFFLINE' | 'DEGRADED'

// Bridge Event Log Entry
export interface BridgeEventLog {
  timestamp: string // ISO 8601
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
  requestId?: string
  action: string
  status: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS'
  duration?: number // milliseconds
  details?: string
  error?: string
}

// Configuration for Desktop Connector (stored locally on user machine)
export interface BridgeConfig {
  version: string
  bridgeId: string
  graphName: string
  apiToken: string
  bridgeToken: string
  backendUrl: string
  port: number
  registeredAt: string // ISO 8601
  tokenExpiresAt: string // ISO 8601
  tokenRefreshToken?: string
  autoStartEnabled?: boolean
}

// Bridge Statistics
export interface BridgeStatistics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTimeMs: number
  uptime: number // seconds
  lastError?: string
  lastErrorAt?: string // ISO 8601
}

// API Error Response Format
export interface ApiErrorResponse {
  success: false
  error: string
  code?: string
  requestId?: string
  bridgeUsed?: boolean
  fallbackAttempted?: boolean
  details?: string
  helpUrl?: string
}

// API Success Response Format (generic)
export interface ApiSuccessResponse<T = unknown> {
  success: true
  data?: T
  bridgeUsed?: boolean
  duration?: number
  [key: string]: unknown
}

// Union type for API responses
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse

// Bridge Token with User Info
export interface BridgeTokenWithUser extends BridgeToken {
  user: {
    id: string
    email: string
    name: string
  }
}

// Bridge Session with Token Info
export interface BridgeSessionWithToken extends BridgeSession {
  bridgeToken: BridgeToken
}

// Test Connection Request (sent to bridge)
export interface TestConnectionRequest {
  // No body needed - bridge uses its own config
}

// Test Connection Response (from bridge)
export interface TestConnectionResponse {
  success: boolean
  message: string
  graphName: string
  status?: BridgeSessionStatusEnum
  uptime?: number // seconds
  error?: string
  code?: string
}

// Sync Request (sent to bridge)
export interface SyncRequest {
  projectId: string
  syncType: 'initial' | 'refresh'
}

// Sync Response (from bridge)
export interface SyncResponse {
  success: boolean
  projectId: string
  syncType: string
  nodesAdded: number
  nodesUpdated: number
  nodesSkipped: number
  duration: number // milliseconds
  error?: string
  code?: string
}

// Search Request (sent to bridge)
export interface SearchRequest {
  query: string
  limit?: number
  tags?: string[]
}

// Search Result
export interface SearchResult {
  uid: string
  title?: string
  type: 'page' | 'block'
  preview?: string
}

// Search Response (from bridge)
export interface SearchResponse {
  success: boolean
  results: SearchResult[]
  error?: string
  code?: string
}
