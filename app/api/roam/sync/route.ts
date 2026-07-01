import { NextRequest, NextResponse } from 'next/server'
import { initialSync, refreshSync, importMarkdownNodes } from '@/lib/roam/sync'
import { shouldUseBridge, getBridgeFeatureFlag, logRoutingDecision } from '@/lib/bridge/routing'
import { syncTestCases } from '@/lib/bridge/bridge-client'
import { MarkdownRoamParser, type RoamMarkdownBlock } from '@/lib/roam/markdown-parser'
import { TestCaseExtractor } from '@/lib/roam/test-case-extractor'
import { prisma } from '@/lib/prisma'

// POST /api/roam/sync
export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)

  try {
    const { projectId, syncType = 'refresh' } = await req.json()

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId required' },
        { status: 400 }
      )
    }

    if (syncType !== 'initial' && syncType !== 'refresh') {
      return NextResponse.json(
        { success: false, error: 'Invalid syncType. Use "initial" or "refresh".' },
        { status: 400 }
      )
    }

    // BRIDGE ROUTING LOGIC (NEW - Parallel path)
    // Get routing decision
    const userId = extractUserIdFromRequest(req) // TODO: Get from actual auth
    const featureFlagEnabled = getBridgeFeatureFlag()
    const routingDecision = await shouldUseBridge(userId, featureFlagEnabled)
    logRoutingDecision(requestId, routingDecision, 'SYNC')

    // If bridge available: try it first
    if (routingDecision.useBridge) {
      console.log(
        `[ROAM_SYNC:${requestId}] Attempting bridge sync for project ${projectId}`
      )

      try {
        // Load Roam configuration for credentials and repository root
        const roamConfig = await prisma.roamConfig.findUnique({
          where: { projectId },
        })

        if (!roamConfig || !roamConfig.graphName || !roamConfig.apiToken || !roamConfig.repositoryRootPage) {
          console.warn(
            `[ROAM_SYNC:${requestId}] Roam config not found or incomplete, falling back to CLI`
          )
          // Fall through to CLI fallback
        } else {
          const bridgeConfig = {
            endpoint: routingDecision.bridgeEndpoint!,
            token: routingDecision.bridgeToken!,
            userId,
            requestId,
          }

          const bridgeResponse = await syncTestCases(
            bridgeConfig,
            projectId,
            syncType,
            roamConfig.graphName,
            roamConfig.apiToken,
            roamConfig.repositoryRootPage
          )

          if (bridgeResponse.success && (bridgeResponse.data as any)?.tree) {
            console.log(`[ROAM_SYNC:${requestId}] Bridge tree fetched, processing import`)

            // Bridge returned tree - convert and import
            try {
              // Get or create repository
              let repository = await prisma.repository.findFirst({
                where: { projectId },
              })

              if (!repository) {
                repository = await prisma.repository.create({
                  data: {
                    projectId,
                    name: `${roamConfig.graphName} Repository`,
                    description: `Synchronized from Roam graph: ${roamConfig.graphName}`,
                  },
                })
              }

              // Convert bridge tree to RoamMarkdownBlock format
              const tree = convertBridgeTreeToMarkdownBlock((bridgeResponse.data as any).tree)

              // Flatten and import using existing QA Ops logic
              const nodes = MarkdownRoamParser.flattenTree(tree)
              const importResult = await importMarkdownNodes(nodes, repository.id, projectId)

              // Extract test cases
              const testCaseResult = await TestCaseExtractor.extractTestCases(repository.id, projectId)

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

              console.log(`[ROAM_SYNC:${requestId}] Bridge import complete: ${testCaseResult.created} test cases`)

              return NextResponse.json({
                success: true,
                nodesAdded: importResult.added,
                nodesUpdated: importResult.updated,
                message: `${syncType} sync completed: ${testCaseResult.created} test cases imported from Roam`,
                syncLogId: repository.id,
                _source: 'BRIDGE',
              })
            } catch (importError) {
              console.error(
                `[ROAM_SYNC:${requestId}] Bridge import failed:`,
                importError instanceof Error ? importError.message : importError
              )
              // Fall through to CLI fallback
            }
          } else {
            console.warn(
              `[ROAM_SYNC:${requestId}] Bridge sync failed or no tree returned: ${bridgeResponse.error}`
            )
            // Fall through to CLI fallback
          }
        }
      } catch (bridgeError) {
        console.warn(
          `[ROAM_SYNC:${requestId}] Bridge request failed, falling back to CLI:`,
          bridgeError instanceof Error ? bridgeError.message : bridgeError
        )
        // Fall through to CLI fallback
      }
    }

    // CLI FALLBACK (EXISTING - Unchanged)
    // All original code preserved - runs if bridge disabled or failed
    console.log(`[ROAM_SYNC:${requestId}] Using CLI fallback for sync`)

    if (syncType === 'initial') {
      const result = await initialSync(projectId)
      return NextResponse.json({
        ...result,
        _source: 'CLI',
      })
    } else {
      // syncType === 'refresh' (checked above)
      const result = await refreshSync(projectId)
      return NextResponse.json({
        ...result,
        _source: 'CLI',
      })
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[ROAM_SYNC:${requestId}] Fatal error:`, msg)
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    )
  }
}

/**
 * Convert Desktop Connector Block/Page tree to QA Ops RoamMarkdownBlock format
 * Maps: Block.string -> text, Block.uid -> uid, Block.children -> children
 */
function convertBridgeTreeToMarkdownBlock(page: any): RoamMarkdownBlock {
  const convertBlock = (block: any, depth: number = 0, order: number = 0): RoamMarkdownBlock => {
    const text = block.string || block.title || ''
    const tags = (text.match(/#(\w+)/g) || []).map((tag) => tag.substring(1))

    return {
      uid: block.uid || '',
      text,
      depth,
      order,
      children: (block.children || []).map((child: any, idx: number) =>
        convertBlock(child, depth + 1, idx)
      ),
      tags,
      isTestCase: false,
      isFolder: (block.children && block.children.length > 0) || false,
    }
  }

  return convertBlock(page, 0, 0)
}

/**
 * Extract user ID from request (placeholder)
 * TODO: Get from actual authentication system
 */
function extractUserIdFromRequest(req: NextRequest): string {
  // Placeholder - will be replaced with actual auth
  return 'user_placeholder'
}
