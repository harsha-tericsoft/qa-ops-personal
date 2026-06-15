import { RoamClient } from './client'
import { importRoamJSON, SyncResult } from './importer'
import { decryptApiKey } from './crypto'
import { prisma } from '@/lib/prisma'

export async function testConnection(projectId: string): Promise<{
  success: boolean
  error?: string
  details?: string
}> {
  try {
    const config = await prisma.roamConfig.findUnique({
      where: { projectId },
    })

    if (!config) {
      return {
        success: false,
        error: 'No Roam configuration found',
        details: 'Configure Roam before testing connection',
      }
    }

    const decryptedToken = decryptApiKey(config.apiToken || '')
    const client = new RoamClient(config.graphName, decryptedToken, config.apiEndpoint)

    const canConnect = await client.testConnection()

    if (!canConnect) {
      return {
        success: false,
        error: 'Connection test failed',
        details: 'Roam did not respond to test query',
      }
    }

    return {
      success: true,
      details: `Connected to Roam at ${config.apiEndpoint}`,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      error: errorMsg,
    }
  }
}

export async function initialSync(projectId: string): Promise<{
  success: boolean
  error?: string
  nodesAdded: number
  message: string
  syncLogId: string
}> {
  const startTime = Date.now()

  try {
    // Load Roam config
    const config = await prisma.roamConfig.findUnique({
      where: { projectId },
    })

    if (!config) {
      throw new Error('No Roam configuration found')
    }

    // Get or create repository
    let repository = await prisma.repository.findFirst({
      where: { projectId },
    })

    if (!repository) {
      repository = await prisma.repository.create({
        data: {
          projectId,
          name: `${config.graphName} Repository`,
          description: `Synchronized from Roam graph: ${config.graphName}`,
        },
      })
    }

    // Create Roam client with decrypted token and per-project endpoint
    const decryptedToken = decryptApiKey(config.apiToken || '')
    const client = new RoamClient(config.graphName, decryptedToken, config.apiEndpoint)

    // Test connection first
    const canConnect = await client.testConnection()
    if (!canConnect) {
      throw new Error('Cannot connect to Roam API')
    }

    // Fetch all pages from Roam
    const pages = await client.fetchAllPages()

    // Import into database (handles unlimited nesting depth)
    const result = await importRoamJSON(pages, repository.id, projectId)

    // Update repository sync status
    await prisma.repository.update({
      where: { id: repository.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
        lastSyncError: null,
        totalTestCount: result.added,
      },
    })

    // Log sync operation
    const duration = Date.now() - startTime
    const syncLog = await prisma.syncLog.create({
      data: {
        projectId,
        action: 'INITIAL_SYNC',
        status: result.errors.length === 0 ? 'SUCCESS' : 'PARTIAL',
        nodesAdded: result.added,
        nodesUpdated: 0,
        nodesSkipped: result.skipped,
        error: result.errors.length > 0 ? result.errors.join('; ') : null,
        durationMs: duration,
      },
    })

    // Update Roam config
    await prisma.roamConfig.update({
      where: { projectId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'SUCCESS',
        lastSyncError: null,
      },
    })

    return {
      success: true,
      nodesAdded: result.added,
      message: `Initial sync completed: ${result.added} test cases imported from Roam`,
      syncLogId: syncLog.id,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'

    // Log failed sync
    const syncLog = await prisma.syncLog.create({
      data: {
        projectId,
        action: 'INITIAL_SYNC',
        status: 'FAILED',
        error: errorMsg,
        durationMs: duration,
      },
    })

    // Update config with error
    await prisma.roamConfig.update({
      where: { projectId },
      data: {
        lastSyncStatus: 'FAILED',
        lastSyncError: errorMsg,
      },
    }).catch(() => null)

    return {
      success: false,
      error: errorMsg,
      nodesAdded: 0,
      message: `Initial sync failed: ${errorMsg}`,
      syncLogId: syncLog.id,
    }
  }
}

export async function refreshSync(projectId: string): Promise<{
  success: boolean
  error?: string
  nodesAdded: number
  nodesUpdated: number
  message: string
}> {
  const startTime = Date.now()

  try {
    // Load Roam config
    const config = await prisma.roamConfig.findUnique({
      where: { projectId },
    })

    if (!config) {
      throw new Error('No Roam configuration found')
    }

    // Get repository
    const repository = await prisma.repository.findFirst({
      where: { projectId },
    })

    if (!repository) {
      throw new Error('No repository found. Run initial sync first.')
    }

    // Create Roam client
    const decryptedToken = decryptApiKey(config.apiToken || '')
    const client = new RoamClient(config.graphName, decryptedToken, config.apiEndpoint)

    // Test connection first
    const canConnect = await client.testConnection()
    if (!canConnect) {
      throw new Error('Cannot connect to Roam API')
    }

    // Fetch all pages
    const pages = await client.fetchAllPages()

    // Import with delta logic (same function, it handles updates)
    const result = await importRoamJSON(pages, repository.id, projectId)

    // Update repository sync status
    await prisma.repository.update({
      where: { id: repository.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
        lastSyncError: null,
        totalTestCount: result.added + result.updated,
      },
    })

    // Log sync operation
    const duration = Date.now() - startTime
    await prisma.syncLog.create({
      data: {
        projectId,
        action: 'REFRESH_SYNC',
        status: result.errors.length === 0 ? 'SUCCESS' : 'PARTIAL',
        nodesAdded: result.added,
        nodesUpdated: result.updated,
        nodesSkipped: result.skipped,
        error: result.errors.length > 0 ? result.errors.join('; ') : null,
        durationMs: duration,
      },
    })

    // Update Roam config
    await prisma.roamConfig.update({
      where: { projectId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'SUCCESS',
        lastSyncError: null,
      },
    })

    return {
      success: true,
      nodesAdded: result.added,
      nodesUpdated: result.updated,
      message: `Refresh sync completed: ${result.added} added, ${result.updated} updated`,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'

    // Log failed sync
    await prisma.syncLog.create({
      data: {
        projectId,
        action: 'REFRESH_SYNC',
        status: 'FAILED',
        error: errorMsg,
        durationMs: duration,
      },
    })

    // Update config with error
    await prisma.roamConfig.update({
      where: { projectId },
      data: {
        lastSyncStatus: 'FAILED',
        lastSyncError: errorMsg,
      },
    }).catch(() => null)

    return {
      success: false,
      error: errorMsg,
      nodesAdded: 0,
      nodesUpdated: 0,
      message: `Refresh sync failed: ${errorMsg}`,
    }
  }
}

export async function importFromFile(json: unknown, repositoryId: string, projectId: string): Promise<SyncResult> {
  const startTime = Date.now()

  try {
    // Validate JSON structure
    if (!Array.isArray(json)) {
      throw new Error('Expected array of pages')
    }

    const result = await importRoamJSON(json, repositoryId, projectId)

    const duration = Date.now() - startTime
    await prisma.syncLog.create({
      data: {
        projectId,
        action: 'IMPORT_FILE',
        status: result.errors.length === 0 ? 'SUCCESS' : 'PARTIAL',
        nodesAdded: result.added,
        nodesUpdated: result.updated,
        nodesSkipped: result.skipped,
        error: result.errors.length > 0 ? result.errors.join('; ') : null,
        durationMs: duration,
      },
    })

    return result
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'

    await prisma.syncLog.create({
      data: {
        projectId,
        action: 'IMPORT_FILE',
        status: 'FAILED',
        error: errorMsg,
        durationMs: duration,
      },
    })

    return { added: 0, updated: 0, skipped: 0, errors: [errorMsg] }
  }
}
