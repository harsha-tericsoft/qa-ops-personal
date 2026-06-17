import { RoamClient } from './client'
import { importRoamJSON, SyncResult } from './importer'
import { MarkdownRoamParser } from './markdown-parser'
import { TestCaseExtractor } from './test-case-extractor'
import { prisma } from '@/lib/prisma'

/**
 * Import markdown nodes directly from Roam hierarchy
 * Uses recursive tree traversal to ensure parents are created before children
 */
async function importMarkdownNodes(
  nodes: Array<any>,
  repositoryId: string,
  projectId: string
): Promise<SyncResult> {
  const result: SyncResult = { added: 0, updated: 0, skipped: 0, errors: [] }

  console.log('[importMarkdownNodes] TOTAL_NODES =', nodes.length)

  try {
    // Sort nodes by depth (parents first) to ensure FK integrity
    const sortedNodes = [...nodes].sort((a, b) => (a.nodeDepth || 0) - (b.nodeDepth || 0))

    // DEBUG: Log what the flattened nodes actually contain
    console.log('[importMarkdownNodes] DEBUG: First 10 nodes after flatten:')
    for (let i = 0; i < Math.min(10, sortedNodes.length); i++) {
      console.log(`  [${i}] uid=${sortedNodes[i].uid}, depth=${sortedNodes[i].nodeDepth}, parentId=${sortedNodes[i].parentId}, text=${sortedNodes[i].text?.substring(0, 50)}`)
    }

    // Build uid -> RepositoryNode.id mapping as we create
    const uidToNodeId = new Map<string, string>()

    // Process nodes in depth order (parents before children)
    for (const node of sortedNodes) {
      if (!node.uid) continue

      const nodeType = node.isTestCase ? 'FILE' : 'FOLDER'
      const slug = node.text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50)

      try {
        const existing = await prisma.repositoryNode.findUnique({
          where: { roamNodeId: node.uid },
        })

        if (existing) {
          uidToNodeId.set(node.uid, existing.id)

          if (existing.name !== node.text) {
            await prisma.repositoryNode.update({
              where: { id: existing.id },
              data: {
                name: node.text,
                slug,
                type: nodeType,
                tags: node.tags || [],
                updatedAt: new Date(),
                syncedAt: new Date(),
              },
            })
            result.updated++
          } else {
            result.skipped++
          }
        } else {
          // Determine parentId: convert Roam UID to RepositoryNode.id
          let parentNodeId: string | null = null
          if (node.parentId) {
            parentNodeId = uidToNodeId.get(node.parentId) || null
          }

          // Create node with correct parentId
          const created = await prisma.repositoryNode.create({
            data: {
              repositoryId,
              projectId,
              name: node.text,
              slug,
              path: node.parentPath,
              depth: node.nodeDepth,
              parentId: parentNodeId,
              roamNodeId: node.uid,
              type: nodeType as any,
              tags: node.tags || [],
              syncedAt: new Date(),
            },
          })

          uidToNodeId.set(node.uid, created.id)
          result.added++
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error('[importMarkdownNodes] Error creating node', node.uid, ':', errorMsg)
        result.errors.push(`Error importing "${node.text}": ${errorMsg}`)
      }
    }

    console.log('[importMarkdownNodes] Complete: created', result.added, 'nodes, updated', result.updated)
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error')
  }

  return result
}

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

    // Use RoamClient with encrypted API token
    const client = new RoamClient(config.graphName, config.apiToken)

    const canConnect = await client.testConnection()

    if (!canConnect) {
      return {
        success: false,
        error: 'Connection test failed',
        details: 'Roam Desktop may not be running or token is invalid',
      }
    }

    return {
      success: true,
      details: `Connected to Roam graph "${config.graphName}"`,
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

    // Create Roam client with encrypted local API token
    const client = new RoamClient(config.graphName, config.apiToken)

    // Test connection first
    const canConnect = await client.testConnection()
    if (!canConnect) {
      throw new Error('Cannot connect to Roam API')
    }

    // Validate configuration
    console.log('[initialSync] VERIFICATION: repositoryRootPage =', JSON.stringify(config.repositoryRootPage))
    if (!config.repositoryRootPage) {
      console.warn('[initialSync] repositoryRootPage not configured, blocking sync')
      throw new Error(
        'Repository Root Page not configured. Please configure the root page in your Roam settings. ' +
        'Example: "Project_Kinergy" or "QA Repository"'
      )
    }

    // Fetch repository subtree using new markdown-based approach
    console.log('[initialSync] SYNC_SOURCE = fetchRepositorySubtree (scoped import)')
    console.log('[initialSync] Fetching repository subtree:', config.repositoryRootPage)
    const tree = await client.fetchRepositorySubtree(config.repositoryRootPage)

    if (!tree) {
      throw new Error(
        `Repository root page not found: "${config.repositoryRootPage}". ` +
        'Verify the page title matches exactly in your Roam graph.'
      )
    }

    // Flatten tree and import into database
    console.log('[initialSync] Flattening markdown tree to database format')
    const nodes = MarkdownRoamParser.flattenTree(tree)
    console.log('[initialSync] Flattened tree contains', nodes.length, 'nodes')

    // Convert markdown blocks to RoamPage format for import
    const importResult = await importMarkdownNodes(nodes, repository.id, projectId)
    const result = importResult

    // Extract test cases from imported nodes
    console.log('[initialSync] Extracting test cases from imported nodes...')
    const testCaseResult = await TestCaseExtractor.extractTestCases(repository.id, projectId)
    console.log('[initialSync] Test case extraction: created', testCaseResult.created, ', skipped', testCaseResult.skipped)

    // Update repository sync status
    await prisma.repository.update({
      where: { id: repository.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
        lastSyncError: null,
        totalTestCount: testCaseResult.created,
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

    // Create Roam client with encrypted local API token
    const client = new RoamClient(config.graphName, config.apiToken)

    // Test connection first
    const canConnect = await client.testConnection()
    if (!canConnect) {
      throw new Error('Cannot connect to Roam API')
    }

    // Validate configuration
    if (!config.repositoryRootPage) {
      throw new Error(
        'Repository Root Page not configured. Please configure the root page in your Roam settings. ' +
        'Example: "Project_Kinergy" or "QA Repository"'
      )
    }

    // Fetch repository subtree
    console.log('[refreshSync] Fetching repository subtree:', config.repositoryRootPage)
    const tree = await client.fetchRepositorySubtree(config.repositoryRootPage)

    if (!tree) {
      throw new Error(
        `Repository root page not found: "${config.repositoryRootPage}". ` +
        'Verify the page title matches exactly in your Roam graph.'
      )
    }

    // Flatten and import (handles updates via importMarkdownNodes)
    console.log('[refreshSync] Flattening markdown tree to database format')
    const nodes = MarkdownRoamParser.flattenTree(tree)
    console.log('[refreshSync] Flattened tree contains', nodes.length, 'nodes')

    const result = await importMarkdownNodes(nodes, repository.id, projectId)

    // Extract test cases from imported nodes
    console.log('[refreshSync] Extracting test cases from imported nodes...')
    const testCaseResult = await TestCaseExtractor.extractTestCases(repository.id, projectId)
    console.log('[refreshSync] Test case extraction: created', testCaseResult.created, ', skipped', testCaseResult.skipped)

    // Update repository sync status
    await prisma.repository.update({
      where: { id: repository.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
        lastSyncError: null,
        totalTestCount: testCaseResult.created,
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
