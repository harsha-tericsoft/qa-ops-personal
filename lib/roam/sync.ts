import { RoamClient } from './client'
import { importRoamJSON, SyncResult } from './importer'
import { decryptApiKey } from './crypto'
import { prisma } from '@/lib/prisma'

export async function syncNow(projectId: string): Promise<SyncResult & { error?: string }> {
  const startTime = Date.now()

  try {
    // Load Roam config
    const config = await prisma.roamConfig.findUnique({
      where: { projectId },
    })

    if (!config) {
      return { added: 0, updated: 0, skipped: 0, errors: ['No Roam config found'], error: 'No Roam config' }
    }

    // Get the primary repository for this project (default to first one)
    const repository = await prisma.repository.findFirst({
      where: { projectId },
    })

    if (!repository) {
      return { added: 0, updated: 0, skipped: 0, errors: ['No repository found'], error: 'No repository' }
    }

    // Create Roam client with decrypted key
    const decryptedKey = decryptApiKey(config.apiKey)
    const client = new RoamClient(config.graphName, decryptedKey)

    // Test connection
    const canConnect = await client.testConnection()
    if (!canConnect) {
      throw new Error('Failed to connect to Roam API')
    }

    // Fetch all pages from Roam
    const pages = await client.fetchAllPages()

    // Import into DB
    const result = await importRoamJSON(pages, repository.id, projectId)

    // Record sync in log
    const duration = Date.now() - startTime
    await prisma.syncLog.create({
      data: {
        projectId,
        action: 'LIVE_SYNC',
        status: result.errors.length === 0 ? 'SUCCESS' : 'PARTIAL',
        nodesAdded: result.added,
        nodesUpdated: result.updated,
        nodesSkipped: result.skipped,
        error: result.errors.length > 0 ? result.errors.join('; ') : null,
        durationMs: duration,
      },
    })

    // Update config
    await prisma.roamConfig.update({
      where: { projectId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: result.errors.length === 0 ? 'SUCCESS' : 'FAILED',
      },
    })

    return result
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'

    await prisma.syncLog.create({
      data: {
        projectId,
        action: 'LIVE_SYNC',
        status: 'FAILED',
        error: errorMsg,
        durationMs: duration,
      },
    })

    await prisma.roamConfig.update({
      where: { projectId },
      data: {
        lastSyncStatus: 'FAILED',
      },
    }).catch(() => null) // Ignore if config doesn't exist

    return { added: 0, updated: 0, skipped: 0, errors: [errorMsg], error: errorMsg }
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
