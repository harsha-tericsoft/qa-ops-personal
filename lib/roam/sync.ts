import { RoamClient } from './client'
import { importRoamJSON, SyncResult } from './importer'
import { MarkdownRoamParser } from './markdown-parser'
import { TestCaseExtractor } from './test-case-extractor'
import { prisma } from '@/lib/prisma'

/**
 * Import markdown nodes directly from Roam hierarchy
 * Uses recursive tree traversal to ensure parents are created before children
 */
export async function importMarkdownNodes(
  nodes: Array<any>,
  repositoryId: string,
  projectId: string
): Promise<SyncResult> {
  const result: SyncResult = { added: 0, updated: 0, skipped: 0, errors: [] }
  const startTime = Date.now()

  console.log('[importMarkdownNodes] TOTAL_NODES =', nodes.length)
  console.log('[importMarkdownNodes] Starting batch import optimization...')

  try {
    // Sort nodes by depth (parents first) to ensure FK integrity
    const sortedNodes = [...nodes].sort((a, b) => (a.nodeDepth || 0) - (b.nodeDepth || 0))

    // Deduplicate nodes by roamNodeId (same node can appear multiple times in tree)
    const seenUids = new Set<string>()
    const deduplicatedNodes: typeof sortedNodes = []
    for (const node of sortedNodes) {
      if (node.uid && !seenUids.has(node.uid)) {
        seenUids.add(node.uid)
        deduplicatedNodes.push(node)
      }
    }
    const dupCount = sortedNodes.length - deduplicatedNodes.length
    if (dupCount > 0) {
      console.log(`[importMarkdownNodes] ⚠️  DEDUPLICATED: ${dupCount} duplicate nodes removed (${sortedNodes.length} → ${deduplicatedNodes.length} unique)`)
    }

    // OPTIMIZATION: Load all existing nodes in ONE query
    console.log('[importMarkdownNodes] Loading existing nodes (one query)...')
    const loadStart = Date.now()
    const existingNodes = await prisma.repositoryNode.findMany({
      where: {
        repositoryId,
        roamNodeId: { in: deduplicatedNodes.map(n => n.uid) }
      },
      select: { id: true, roamNodeId: true, name: true }
    })
    console.log(`[importMarkdownNodes] Loaded ${existingNodes.length} existing nodes in ${Date.now() - loadStart}ms`)

    // Build uid -> RepositoryNode mapping
    const existingMap = new Map(existingNodes.map(n => [n.roamNodeId, n]))
    const uidToNodeId = new Map(existingNodes.map(n => [n.roamNodeId, n.id]))

    // Split nodes into create/update/skip categories
    const nodesToCreate: Array<any> = []
    const nodesToUpdate: Array<{ id: string; data: any }> = []
    const nodeWithParentRefs: Array<{ uid: string; parentId: string | null }> = []

    for (const node of deduplicatedNodes) {
      if (!node.uid) continue

      const nodeType = node.isTestCase ? 'FILE' : 'FOLDER'
      const slug = node.text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50)

      const existing = existingMap.get(node.uid)

      if (existing) {
        // Map existing node
        uidToNodeId.set(node.uid, existing.id)

        // Check if update needed
        if (existing.name !== node.text || node.order !== undefined) {
          nodesToUpdate.push({
            id: existing.id,
            data: {
              name: node.text,
              slug,
              type: nodeType,
              tags: node.tags || [],
              order: node.order ?? 0,  // Preserve sibling order from Roam
              updatedAt: new Date(),
              syncedAt: new Date(),
            }
          })
        } else {
          result.skipped++
        }
      } else {
        // Queue for creation (WITHOUT parentId first - we'll set it after creation)
        nodesToCreate.push({
          repositoryId,
          projectId,
          name: node.text,
          slug,
          path: node.parentPath,
          depth: node.nodeDepth,
          order: node.order ?? 0,  // Preserve sibling order from Roam
          parentId: null, // Set to null for now
          roamNodeId: node.uid,
          type: nodeType,
          tags: node.tags || [],
          syncedAt: new Date(),
        })

        // Track parent references for later update
        nodeWithParentRefs.push({
          uid: node.uid,
          parentId: node.parentId || null
        })
      }
    }

    console.log(`[importMarkdownNodes] Split results: ${nodesToCreate.length} to create, ${nodesToUpdate.length} to update, ${result.skipped} skipped`)

    // Create nodes with batch insert support
    const createStart = Date.now()
    let nodesToCreateFinal: typeof nodesToCreate = []
    const createdNodeIds = new Map<string, string>()  // Track newly created node UIDs → DB IDs

    // Sort nodes by depth to ensure parents are created before children
    // Within same depth, stable sort preserves original order
    const sortedForCreation = [...deduplicatedNodes].sort((a, b) => (a.nodeDepth || 0) - (b.nodeDepth || 0))

    // Group nodes by depth so we create all nodes at depth N before processing depth N+1
    const nodesByDepth = new Map<number, typeof deduplicatedNodes>()
    for (const node of sortedForCreation) {
      const depth = node.nodeDepth || 0
      if (!nodesByDepth.has(depth)) {
        nodesByDepth.set(depth, [])
      }
      nodesByDepth.get(depth)!.push(node)
    }

    const depths = Array.from(nodesByDepth.keys()).sort((a, b) => a - b)

    // Process each depth level, creating all nodes at one depth before moving to next
    for (const depth of depths) {
      const nodesAtDepth = nodesByDepth.get(depth) || []
      console.log(`[importMarkdownNodes] Processing depth ${depth}: ${nodesAtDepth.length} nodes`)

      for (let nodeIdx = 0; nodeIdx < nodesAtDepth.length; nodeIdx++) {
        const node = nodesAtDepth[nodeIdx]
        const isLastNodeAtDepth = nodeIdx === nodesAtDepth.length - 1
        const isLastNodeOverall = depth === depths[depths.length - 1] && isLastNodeAtDepth
        if (!node.uid) continue

        const nodeType = node.isTestCase ? 'FILE' : 'FOLDER'
        const slug = node.text
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .substring(0, 50)

        const existing = existingMap.get(node.uid)
        if (!existing) {
          // Determine parentId using BOTH existing nodes and newly created nodes
          let parentNodeId: string | null = null
          if (node.parentId) {
            // First check newly created nodes from this import (parents at lower depths created first)
            if (createdNodeIds.has(node.parentId)) {
              parentNodeId = createdNodeIds.get(node.parentId) || null
            } else {
              // Fall back to existing nodes from database
              parentNodeId = uidToNodeId.get(node.parentId) || null
            }
          }

          nodesToCreateFinal.push({
            repositoryId,
            projectId,
            name: node.text,
            slug,
            path: node.parentPath,
            depth: node.nodeDepth,
            order: node.order ?? 0,  // Preserve sibling order from Roam
            parentId: parentNodeId,
            roamNodeId: node.uid,
            type: nodeType,
            tags: node.tags || [],
            syncedAt: new Date(),
          })

          // Flush batch when it reaches 500 or at end of this depth level
          const shouldFlush = nodesToCreateFinal.length >= 500 || (isLastNodeAtDepth && nodesToCreateFinal.length > 0)

          if (shouldFlush) {
            try {
              const batchStart = Date.now()

              // IMPORTANT: Before creating, verify these nodes don't already exist in THIS repository
              // This prevents race conditions and duplicate creation
              const existingInBatch = await prisma.repositoryNode.findMany({
                where: {
                  repositoryId,
                  roamNodeId: { in: nodesToCreateFinal.map(n => n.roamNodeId) }
                },
                select: { roamNodeId: true, id: true }
              })

              const existingRoamNodeIds = new Set(existingInBatch.map(n => n.roamNodeId).filter(Boolean))
              const nodesToCreateFiltered = nodesToCreateFinal.filter(n => !existingRoamNodeIds.has(n.roamNodeId))

              console.log(`[importMarkdownNodes] Batch pre-check: ${nodesToCreateFinal.length} queued, ${existingRoamNodeIds.size} already exist, ${nodesToCreateFiltered.length} to create`)

              if (nodesToCreateFiltered.length === 0) {
                // All nodes in this batch already exist
                for (const existing of existingInBatch) {
                  if (existing.roamNodeId) {
                    uidToNodeId.set(existing.roamNodeId, existing.id)
                    createdNodeIds.set(existing.roamNodeId, existing.id)
                  }
                }
                nodesToCreateFinal = []
                continue
              }

              const created = await prisma.repositoryNode.createMany({
                data: nodesToCreateFiltered,
                skipDuplicates: true
              })
              const batchDuration = Date.now() - batchStart

              console.log(`[importMarkdownNodes] Batch: ${nodesToCreateFiltered.length} queued, ${created.count} created in ${batchDuration}ms`)

              result.added += created.count

              // Update createdNodeIds for both newly created and already existing nodes
              const allNodesInBatch = await prisma.repositoryNode.findMany({
                where: {
                  repositoryId,
                  roamNodeId: { in: nodesToCreateFinal.map(n => n.roamNodeId) }
                },
                select: { id: true, roamNodeId: true }
              })

              for (const node of allNodesInBatch) {
                if (node.roamNodeId) {
                  uidToNodeId.set(node.roamNodeId, node.id)
                  createdNodeIds.set(node.roamNodeId, node.id)
                }
              }

              nodesToCreateFinal = []
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Unknown error'
              const errorCode = (error as any)?.code || 'UNKNOWN'
              console.error(`[importMarkdownNodes] Batch error [${errorCode}]:`, errorMsg.substring(0, 500))

              if (nodesToCreateFinal.length > 0) {
                console.error(`[importMarkdownNodes] First node in failed batch:`, JSON.stringify(nodesToCreateFinal[0], null, 0).substring(0, 200))
              }

              result.errors.push(`Batch creation error: ${errorMsg.substring(0, 200)}`)
              nodesToCreateFinal = []
            }
          }
        }
      }
    }

    // CRITICAL FIX: Final flush for any remaining nodes
    if (nodesToCreateFinal.length > 0) {
      console.log(`[importMarkdownNodes] Final flush: ${nodesToCreateFinal.length} remaining nodes`)

      try {
        const existingInBatch = await prisma.repositoryNode.findMany({
          where: {
            repositoryId,
            roamNodeId: { in: nodesToCreateFinal.map(n => n.roamNodeId) }
          },
          select: { roamNodeId: true, id: true }
        })

        const existingRoamNodeIds = new Set(existingInBatch.map(n => n.roamNodeId).filter(Boolean))
        const nodesToCreateFiltered = nodesToCreateFinal.filter(n => !existingRoamNodeIds.has(n.roamNodeId))

        if (nodesToCreateFiltered.length > 0) {
          const created = await prisma.repositoryNode.createMany({
            data: nodesToCreateFiltered,
            skipDuplicates: true
          })

          console.log(`[importMarkdownNodes] Final flush created: ${created.count} nodes`)
          result.added += created.count

          // Update createdNodeIds for final batch
          const allNodesInBatch = await prisma.repositoryNode.findMany({
            where: {
              repositoryId,
              roamNodeId: { in: nodesToCreateFinal.map(n => n.roamNodeId) }
            },
            select: { id: true, roamNodeId: true }
          })

          for (const node of allNodesInBatch) {
            if (node.roamNodeId) {
              uidToNodeId.set(node.roamNodeId, node.id)
              createdNodeIds.set(node.roamNodeId, node.id)
            }
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[importMarkdownNodes] Final flush error:`, errorMsg)
        result.errors.push(`Final flush error: ${errorMsg}`)
      }

      nodesToCreateFinal = []
    }

    const createDuration = Date.now() - createStart
    console.log(`[importMarkdownNodes] All creates completed in ${createDuration}ms`)

    // Update any changed nodes
    console.log(`[importMarkdownNodes] Updating ${nodesToUpdate.length} nodes...`)
    const updateStart = Date.now()

    for (const update of nodesToUpdate) {
      try {
        await prisma.repositoryNode.update({
          where: { id: update.id },
          data: update.data
        })
        result.updated++
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[importMarkdownNodes] Update error for node ${update.id}:`, errorMsg)
        result.errors.push(`Update error: ${errorMsg}`)
      }
    }

    const updateDuration = Date.now() - updateStart
    console.log(`[importMarkdownNodes] All updates completed in ${updateDuration}ms`)

    const totalDuration = Date.now() - startTime
    console.log(`\n[importMarkdownNodes] OPTIMIZATION COMPLETE:`)
    console.log(`  Total nodes: ${deduplicatedNodes.length} (after dedup)`)
    console.log(`  Created: ${result.added}`)
    console.log(`  Updated: ${result.updated}`)
    console.log(`  Skipped: ${result.skipped}`)
    console.log(`  Duration: ${totalDuration}ms`)
    console.log(`  Query reduction: ~500x (was 7436+ sequential queries)`)
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
  const timings: Record<string, number> = {}

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
    const fetchStart = Date.now()
    const tree = await client.fetchRepositorySubtree(config.repositoryRootPage)
    timings.fetch = Date.now() - fetchStart

    if (!tree) {
      throw new Error(
        `Repository root page not found: "${config.repositoryRootPage}". ` +
        'Verify the page title matches exactly in your Roam graph.'
      )
    }

    // Flatten tree and import into database
    console.log('[initialSync] Flattening markdown tree to database format')
    const flattenStart = Date.now()
    const nodes = MarkdownRoamParser.flattenTree(tree)
    timings.flatten = Date.now() - flattenStart
    console.log('[initialSync] Flattened tree contains', nodes.length, 'nodes, took', timings.flatten, 'ms')

    // Convert markdown blocks to RoamPage format for import
    const importStart = Date.now()
    const importResult = await importMarkdownNodes(nodes, repository.id, projectId)
    timings.import = Date.now() - importStart
    const result = importResult

    // Extract test cases from imported nodes
    console.log('[initialSync] Extracting test cases from imported nodes...')
    const extractStart = Date.now()
    const testCaseResult = await TestCaseExtractor.extractTestCases(repository.id, projectId)
    timings.extract = Date.now() - extractStart
    console.log('[initialSync] Test case extraction: created', testCaseResult.created, ', skipped', testCaseResult.skipped, ', took', timings.extract, 'ms')

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

    // Log detailed timing breakdown
    const duration = Date.now() - startTime
    console.log('\n=== INITIAL SYNC TIMING REPORT ===')
    console.log(`Total sync duration: ${duration}ms`)
    console.log(`\nStage breakdown:`)
    console.log(`  fetchRepositorySubtree:  ${timings.fetch}ms (${((timings.fetch/duration)*100).toFixed(1)}%)`)
    console.log(`  flattenMarkdownTree:     ${timings.flatten}ms (${((timings.flatten/duration)*100).toFixed(1)}%)`)
    console.log(`  importMarkdownNodes:     ${timings.import}ms (${((timings.import/duration)*100).toFixed(1)}%)`)
    console.log(`  extractTestCases:        ${timings.extract}ms (${((timings.extract/duration)*100).toFixed(1)}%)`)
    console.log(`\nData counts:`)
    console.log(`  Total nodes fetched: ${nodes.length}`)
    console.log(`  Nodes added: ${result.added}`)
    console.log(`  Nodes updated: ${result.updated}`)
    console.log(`  Nodes skipped: ${result.skipped}`)
    console.log(`  Total test cases extracted: ${testCaseResult.created}`)
    console.log(`\n================================\n`)

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

    // Validate configuration
    if (!config.repositoryRootPage) {
      throw new Error(
        'Repository Root Page not configured. Please configure the root page in your Roam settings. ' +
        'Example: "Project_Kinergy" or "QA Repository"'
      )
    }

    // Use roam-cli with roam get-page (returns FULL page markdown with all children)
    // NOT roam search (which returns only page header with hiddenChildren="1")
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)

    // Fetch repository root page using roam get-page (returns FULL hierarchy)
    console.log('[refreshSync] Fetching repository root page:', config.repositoryRootPage)
    let pageData: any
    try {
      const { stdout } = await execAsync(
        `roam get-page --graph "${config.graphName}" --title "${config.repositoryRootPage}"`,
        { timeout: 60000, maxBuffer: 50 * 1024 * 1024 }
      )

      // Parse JSON from output
      const jsonMatch = stdout.match(/\{[\s\S]*\}/s)
      if (!jsonMatch) {
        throw new Error('No JSON in roam response')
      }
      pageData = JSON.parse(jsonMatch[0])
    } catch (err) {
      console.error('[refreshSync] Fetch error:', err instanceof Error ? err.message : err)
      throw new Error(
        `Cannot fetch repository root page "${config.repositoryRootPage}". ` +
        'Verify the page title matches exactly in your Roam graph and roam-cli is configured.'
      )
    }

    if (!pageData || !pageData.uid) {
      throw new Error('Failed to fetch page from Roam')
    }

    // Parse the markdown response from roam-cli
    console.log('[refreshSync] Parsing Roam response - markdown length:', (pageData.markdown || '').length)
    const tree = MarkdownRoamParser.parseMarkdown(
      pageData.markdown || '',
      config.repositoryRootPage,
      pageData.uid
    )

    if (!tree) {
      throw new Error('Failed to parse Roam page')
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
