import { RoamClient } from './client'
import { importRoamJSON, SyncResult } from './importer'
import { MarkdownRoamParser } from './markdown-parser'
import { TestCaseExtractor } from './test-case-extractor'
import { prisma } from '@/lib/prisma'

/**
 * Normalize values for comparison
 * Treats semantically equivalent values as equal
 */
function normalizeForComparison(value: any, fieldName: string): any {
  // Handle order field: undefined/null/0 are equivalent
  if (fieldName === 'order') {
    if (value === undefined || value === null || value === 0) return 0
    return value
  }

  // Handle tags field: undefined/null/[] are equivalent
  if (fieldName === 'tags') {
    if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) return []
    if (Array.isArray(value)) return value
    return []
  }

  // Handle slug field: undefined/null/empty are equivalent
  if (fieldName === 'slug') {
    if (!value) return ''
    return String(value)
  }

  // Handle parentId field: undefined/null are equivalent
  if (fieldName === 'parentId') {
    if (value === undefined || value === null) return null
    return value
  }

  // Handle children field: undefined/[] are equivalent
  if (fieldName === 'children') {
    if (value === undefined || (Array.isArray(value) && value.length === 0)) return []
    if (Array.isArray(value)) return value
    return []
  }

  // Handle markdown field: trim trailing whitespace
  if (fieldName === 'markdown') {
    if (typeof value === 'string') return value.trimEnd()
    return value
  }

  // Handle string fields: trim with trimEnd()
  if (typeof value === 'string') {
    return value.trimEnd()
  }

  return value
}

/**
 * Check if two values are equal after normalization
 */
function areFieldsEqual(dbValue: any, parsedValue: any, fieldName: string): boolean {
  const dbNorm = normalizeForComparison(dbValue, fieldName)
  const parsedNorm = normalizeForComparison(parsedValue, fieldName)

  // Handle arrays
  if (Array.isArray(dbNorm) && Array.isArray(parsedNorm)) {
    return JSON.stringify(dbNorm.sort()) === JSON.stringify(parsedNorm.sort())
  }

  // Handle objects and primitives
  return dbNorm === parsedNorm
}

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
  const phases: Record<string, number> = {}

  console.log('[importMarkdownNodes] TOTAL_NODES =', nodes.length)
  console.log('[importMarkdownNodes] Starting batch import optimization...')

  try {
    // Sort nodes by depth (parents first) to ensure FK integrity
    let phaseStart = Date.now()
    const sortedNodes = [...nodes].sort((a, b) => (a.nodeDepth || 0) - (b.nodeDepth || 0))
    phases['sort'] = Date.now() - phaseStart
    console.log('[importMarkdownNodes] PHASE: sort =', phases['sort'], 'ms')

    // Deduplicate nodes by roamNodeId (same node can appear multiple times in tree)
    phaseStart = Date.now()
    const seenUids = new Set<string>()
    const deduplicatedNodes: typeof sortedNodes = []
    for (const node of sortedNodes) {
      if (node.uid && !seenUids.has(node.uid)) {
        seenUids.add(node.uid)
        deduplicatedNodes.push(node)
      }
    }
    phases['dedup'] = Date.now() - phaseStart
    console.log('[importMarkdownNodes] PHASE: dedup =', phases['dedup'], 'ms')

    const dupCount = sortedNodes.length - deduplicatedNodes.length
    if (dupCount > 0) {
      console.log(`[importMarkdownNodes] ⚠️  DEDUPLICATED: ${dupCount} duplicate nodes removed (${sortedNodes.length} → ${deduplicatedNodes.length} unique)`)
    }

    // OPTIMIZATION: Load all existing nodes in ONE query
    console.log('[importMarkdownNodes] Loading existing nodes (one query)...')
    phaseStart = Date.now()
    const existingNodes = await prisma.repositoryNode.findMany({
      where: {
        repositoryId,
        roamNodeId: { in: deduplicatedNodes.map(n => n.uid) }
      },
      select: { id: true, roamNodeId: true, name: true, order: true, tags: true, type: true, slug: true }
    })
    phases['loadExisting'] = Date.now() - phaseStart
    console.log(`[importMarkdownNodes] PHASE: loadExisting = ${phases['loadExisting']}ms (loaded ${existingNodes.length} nodes)`)

    // Build uid -> RepositoryNode mapping
    const existingMap = new Map(existingNodes.map(n => [n.roamNodeId, n]))
    const uidToNodeId = new Map(existingNodes.map(n => [n.roamNodeId, n.id]))

    // Split nodes into create/update/skip categories
    const nodesToCreate: Array<any> = []
    const nodesToUpdate: Array<{ id: string; data: any }> = []
    const nodeWithParentRefs: Array<{ uid: string; parentId: string | null }> = []

    // Debug: Print comparison for first node
    let debugNodePrinted = false
    let debugUpdatesPrinted = 0
    const updateReasons = { nameChanged: 0, orderChanged: 0, tagsChanged: 0, slugChanged: 0 }

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

        // Normalize fields for comparison
        const nameEqual = areFieldsEqual(existing.name, node.text, 'name')
        const orderEqual = areFieldsEqual(existing.order, node.order, 'order')
        const tagsEqual = areFieldsEqual(existing.tags, node.tags, 'tags')

        // Calculate slug the same way as update logic
        const slug = node.text
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .substring(0, 50)

        // Normalize slug for comparison using normalization function
        const slugEqual = areFieldsEqual(existing.slug, slug, 'slug')

        // NOTE: Do NOT compare type here - type is determined by TestCaseExtractor AFTER sync
        // Comparing type would cause spurious updates when nodes are later classified as test cases

        // Check if update needed - only update if meaningful fields actually changed
        const needsUpdate = !nameEqual || !orderEqual || !tagsEqual || !slugEqual

        if (!debugNodePrinted) {
          debugNodePrinted = true
          console.log('\n[DIRTY-CHECK] First node comparison (normalized):')
          console.log('  uid:', node.uid)
          console.log('  --- name ---')
          console.log('    DB:', JSON.stringify(existing.name))
          console.log('    Parsed:', JSON.stringify(node.text))
          console.log('    Normalized DB:', JSON.stringify(normalizeForComparison(existing.name, 'name')))
          console.log('    Normalized Parsed:', JSON.stringify(normalizeForComparison(node.text, 'name')))
          console.log('    Equal?', nameEqual)
          console.log('  --- order ---')
          console.log('    DB:', existing.order)
          console.log('    Parsed:', node.order)
          console.log('    Normalized DB:', normalizeForComparison(existing.order, 'order'))
          console.log('    Normalized Parsed:', normalizeForComparison(node.order, 'order'))
          console.log('    Equal?', orderEqual)
          console.log('  --- tags ---')
          console.log('    DB:', existing.tags)
          console.log('    Parsed:', node.tags)
          console.log('    Normalized DB:', normalizeForComparison(existing.tags, 'tags'))
          console.log('    Normalized Parsed:', normalizeForComparison(node.tags, 'tags'))
          console.log('    Equal?', tagsEqual)
          console.log('  --- slug ---')
          console.log('    DB:', JSON.stringify(existing.slug))
          console.log('    Parsed:', JSON.stringify(slug))
          console.log('    Normalized DB:', JSON.stringify(normalizeForComparison(existing.slug, 'slug')))
          console.log('    Normalized Parsed:', JSON.stringify(normalizeForComparison(slug, 'slug')))
          console.log('    Equal?', slugEqual)
          console.log('  --- type (NOT compared - determined by TestCaseExtractor) ---')
          console.log('    DB:', existing.type)
          console.log('    Parsed:', nodeType)
          console.log('  --- result ---')
          console.log('    needsUpdate?', needsUpdate)
          console.log()
        }

        if (needsUpdate) {
          // Track which fields caused the update
          if (!nameEqual) updateReasons.nameChanged++
          if (!orderEqual) updateReasons.orderChanged++
          if (!tagsEqual) updateReasons.tagsChanged++
          if (!slugEqual) updateReasons.slugChanged++

          // Log first 3 nodes that need update
          if (debugUpdatesPrinted < 3) {
            debugUpdatesPrinted++
            if (!orderEqual) {
              console.log(`\n[DEBUG-ORDER] Node ${debugUpdatesPrinted}: uid=${node.uid.substring(0, 8)}`)
              console.log(`  DB order: ${existing.order} (type: ${typeof existing.order})`)
              console.log(`  Parsed order: ${node.order} (type: ${typeof node.order})`)
              const dbNorm = normalizeForComparison(existing.order, 'order')
              const parsedNorm = normalizeForComparison(node.order, 'order')
              console.log(`  Normalized DB: ${dbNorm}`)
              console.log(`  Normalized Parsed: ${parsedNorm}`)
              console.log(`  Are equal?: ${dbNorm === parsedNorm}`)
            }
          }
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
    console.log(`[importMarkdownNodes] Update reasons breakdown:`)
    console.log(`  nameChanged: ${updateReasons.nameChanged}`)
    console.log(`  orderChanged: ${updateReasons.orderChanged}`)
    console.log(`  tagsChanged: ${updateReasons.tagsChanged}`)
    console.log(`  slugChanged: ${updateReasons.slugChanged}`)

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
    phaseStart = Date.now()
    let totalProcessed = 0
    for (const depth of depths) {
      const nodesAtDepth = nodesByDepth.get(depth) || []
      console.log(`[importMarkdownNodes] Processing depth ${depth}: ${nodesAtDepth.length} nodes`)
      totalProcessed += nodesAtDepth.length

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
    phases['depthLoop'] = Date.now() - phaseStart
    console.log(`[importMarkdownNodes] PHASE: depthLoop = ${phases['depthLoop']}ms (processed ${totalProcessed} nodes)`)

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
    phaseStart = Date.now()
    let updateCount = 0
    const updateStartTime = Date.now()

    for (let i = 0; i < nodesToUpdate.length; i++) {
      const update = nodesToUpdate[i]
      const itemStart = Date.now()

      try {
        await prisma.repositoryNode.update({
          where: { id: update.id },
          data: update.data
        })
        result.updated++
        updateCount++

        // Log progress every 100 updates
        if (updateCount % 100 === 0) {
          const elapsed = Date.now() - updateStartTime
          const rate = updateCount / (elapsed / 1000)
          console.log(`[importMarkdownNodes] Update progress: ${updateCount}/${nodesToUpdate.length} (${rate.toFixed(0)} updates/sec)`)
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        const itemTime = Date.now() - itemStart
        console.error(`[importMarkdownNodes] Update error for node ${update.id} (attempt took ${itemTime}ms):`, errorMsg.substring(0, 100))
        result.errors.push(`Update error: ${errorMsg}`)
      }
    }

    phases['updates'] = Date.now() - phaseStart
    console.log(`[importMarkdownNodes] PHASE: updates = ${phases['updates']}ms (updated ${updateCount} nodes)`)

    const totalDuration = Date.now() - startTime
    console.log(`\n[importMarkdownNodes] END - Total duration: ${totalDuration}ms`)
    console.log(`  Total nodes: ${deduplicatedNodes.length} (after dedup)`)
    console.log(`  Created: ${result.added}`)
    console.log(`  Updated: ${result.updated}`)
    console.log(`  Skipped: ${result.skipped}`)
    console.log(`\n[importMarkdownNodes] Phase breakdown:`)
    Object.entries(phases).forEach(([phase, ms]) => {
      const pct = ((ms / totalDuration) * 100).toFixed(1)
      console.log(`  ${phase}: ${ms}ms (${pct}%)`)
    })
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
  const timings: Record<string, number> = {}

  console.log('[refreshSync] START at', new Date(startTime).toISOString())

  try {
    // Load Roam config
    const configStart = Date.now()
    const config = await prisma.roamConfig.findUnique({
      where: { projectId },
    })
    timings['loadConfig'] = Date.now() - configStart
    console.log('[refreshSync] PHASE: loadConfig =', timings['loadConfig'], 'ms')

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
    const roamGetStart = Date.now()
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
    timings['roamGetPage'] = Date.now() - roamGetStart
    console.log('[refreshSync] PHASE: roamGetPage =', timings['roamGetPage'], 'ms, markdown length:', (pageData?.markdown || '').length)

    if (!pageData || !pageData.uid) {
      throw new Error('Failed to fetch page from Roam')
    }

    // Parse the markdown response from roam-cli
    const parseStart = Date.now()
    console.log('[refreshSync] Parsing Roam response - markdown length:', (pageData.markdown || '').length)
    const tree = MarkdownRoamParser.parseMarkdown(
      pageData.markdown || '',
      config.repositoryRootPage,
      pageData.uid
    )
    timings['parseMarkdown'] = Date.now() - parseStart
    console.log('[refreshSync] PHASE: parseMarkdown =', timings['parseMarkdown'], 'ms')

    if (!tree) {
      throw new Error('Failed to parse Roam page')
    }

    // Flatten and import (handles updates via importMarkdownNodes)
    const flattenStart = Date.now()
    console.log('[refreshSync] Flattening markdown tree to database format')
    const nodes = MarkdownRoamParser.flattenTree(tree)
    timings['flattenTree'] = Date.now() - flattenStart
    console.log('[refreshSync] PHASE: flattenTree =', timings['flattenTree'], 'ms, node count:', nodes.length)

    const importStart = Date.now()
    const result = await importMarkdownNodes(nodes, repository.id, projectId)
    timings['importMarkdownNodes'] = Date.now() - importStart
    console.log('[refreshSync] PHASE: importMarkdownNodes =', timings['importMarkdownNodes'], 'ms, added:', result.added)

    // Extract test cases from imported nodes
    const extractStart = Date.now()
    console.log('[refreshSync] Extracting test cases from imported nodes...')
    const testCaseResult = await TestCaseExtractor.extractTestCases(repository.id, projectId)
    timings['extractTestCases'] = Date.now() - extractStart
    console.log('[refreshSync] PHASE: extractTestCases =', timings['extractTestCases'], 'ms, created:', testCaseResult.created)

    // Update repository sync status
    const updateStart = Date.now()
    await prisma.repository.update({
      where: { id: repository.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
        lastSyncError: null,
        totalTestCount: testCaseResult.created,
      },
    })
    timings['updateRepository'] = Date.now() - updateStart
    console.log('[refreshSync] PHASE: updateRepository =', timings['updateRepository'], 'ms')

    // Log sync operation
    const logStart = Date.now()
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
    timings['createSyncLog'] = Date.now() - logStart
    console.log('[refreshSync] PHASE: createSyncLog =', timings['createSyncLog'], 'ms')

    // Update Roam config
    const configUpdateStart = Date.now()
    await prisma.roamConfig.update({
      where: { projectId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'SUCCESS',
        lastSyncError: null,
      },
    })
    timings['updateRoamConfig'] = Date.now() - configUpdateStart
    console.log('[refreshSync] PHASE: updateRoamConfig =', timings['updateRoamConfig'], 'ms')

    const totalDuration = Date.now() - startTime
    console.log('[refreshSync] END - Total duration:', totalDuration, 'ms')
    console.log('[refreshSync] Timing breakdown:')
    Object.entries(timings).forEach(([phase, ms]) => {
      const pct = ((ms / totalDuration) * 100).toFixed(1)
      console.log(`  ${phase}: ${ms}ms (${pct}%)`)
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
