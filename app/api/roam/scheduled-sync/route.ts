import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TestCaseExtractor } from '@/lib/roam/test-case-extractor'
import { MarkdownRoamParser } from '@/lib/roam/markdown-parser'
import { importMarkdownNodes } from '@/lib/roam/sync'
import { spawn } from 'child_process'

/**
 * FIXED LIVE ROAM SYNC - Gets full page content including nested children
 * Uses: roam get-page (returns complete markdown tree)
 * NOT: roam search (returns only page header with hiddenChildren="1")
 */

function roamGetPage(graphName: string, pageTitle: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const process = spawn('roam', ['get-page', '--graph', graphName, '--title', pageTitle], {
      timeout: 60000,
      // Note: spawn handles large buffers differently than exec, no maxBuffer needed
    })

    let stdout = ''
    let stderr = ''

    process.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    process.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    process.on('error', (err) => {
      console.error('[roam-cli] Process error:', err)
      reject(err)
    })

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`roam-cli exited with code ${code}: ${stderr}`))
        return
      }

      try {
        // Parse JSON - skip warnings (without using 's' flag for ES2017 compatibility)
        const jsonMatch = stdout.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          reject(new Error('No JSON in roam response'))
          return
        }
        const result = JSON.parse(jsonMatch[0])
        resolve(result)
      } catch (err) {
        reject(err)
      }
    })
  })
}

async function performSync() {
  console.log('[roam-sync] Starting live Roam sync')
  const startTime = Date.now()

  try {
    const configs = await prisma.roamConfig.findMany({
      where: {
        graphName: { not: '' },
        repositoryRootPage: { not: '' },
      },
    })

    console.log('[roam-sync] Found', configs.length, 'Roam graphs to sync')

    for (const config of configs) {
      try {
        console.log('[roam-sync] Syncing:', config.graphName, 'root:', config.repositoryRootPage)

        // Get or create repository
        let repository = await prisma.repository.findFirst({
          where: { projectId: config.projectId },
        })

        if (!repository) {
          repository = await prisma.repository.create({
            data: {
              projectId: config.projectId,
              name: config.graphName,
              description: 'Live Roam sync',
            },
          })
        }

        // Get full page content (including all nested children)
        if (!config.repositoryRootPage) {
          throw new Error('Repository root page not configured')
        }

        console.log('[roam-sync] Fetching root page:', config.repositoryRootPage)
        const pageResult = await roamGetPage(config.graphName, config.repositoryRootPage)

        if (!pageResult || !pageResult.uid) {
          throw new Error(`Root page not found: "${config.repositoryRootPage}"`)
        }

        const pageUid = pageResult.uid
        const markdown = pageResult.markdown || ''

        console.log('[roam-sync] Found page UID:', pageUid, 'markdown length:', markdown.length)

        if (!markdown) {
          console.log('[roam-sync] No markdown content')
          continue
        }

        // Parse markdown
        const tree = MarkdownRoamParser.parseMarkdown(
          markdown,
          config.repositoryRootPage,
          pageUid
        )

        if (!tree) {
          throw new Error('Failed to parse markdown')
        }

        // Import into RepositoryNode
        const nodes = MarkdownRoamParser.flattenTree(tree)
        console.log('[roam-sync] Flattened to', nodes.length, 'nodes')

        const syncResult = await importMarkdownNodes(nodes, repository.id, config.projectId)
        console.log('[roam-sync] Sync result:', syncResult)

        // Extract test cases from RepositoryNode
        const testCaseResult = await TestCaseExtractor.extractTestCases(repository.id, config.projectId)
        console.log('[roam-sync] Extracted:', testCaseResult.created, 'new test cases')

        // Update repository
        await prisma.repository.update({
          where: { id: repository.id },
          data: {
            lastSyncAt: new Date(),
            lastSyncStatus: 'success',
            lastSyncError: null,
            totalTestCount: testCaseResult.created + testCaseResult.skipped,
          },
        })

        // Update Roam config
        await prisma.roamConfig.update({
          where: { projectId: config.projectId },
          data: {
            lastSyncAt: new Date(),
            lastSyncStatus: 'SUCCESS',
            lastSyncError: null,
          },
        })

        console.log('[roam-sync] ✅ Complete:', config.graphName)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error('[roam-sync] ❌ Error:', config.graphName, '-', errorMsg)

        await prisma.roamConfig.update({
          where: { projectId: config.projectId },
          data: {
            lastSyncStatus: 'FAILED',
            lastSyncError: errorMsg,
          },
        }).catch(() => null)
      }
    }

    const duration = Date.now() - startTime
    console.log('[roam-sync] Completed in', duration, 'ms')

    // Log sync
    if (configs.length > 0) {
      await prisma.syncLog.create({
        data: {
          projectId: configs[0].projectId,
          action: 'SCHEDULED_SYNC',
          status: 'SUCCESS',
          durationMs: duration,
        },
      }).catch(() => null)
    }
  } catch (error) {
    console.error('[roam-sync] Fatal error:', error)
  }
}

/**
 * Scheduled sync endpoint - called every 5 minutes via GitHub Actions
 */
export async function POST(request: NextRequest) {
  console.log('[scheduled-sync] Cron triggered at', new Date().toISOString())

  // Start background sync
  performSync().catch((err) => console.error('[roam-sync] Background error:', err))

  return NextResponse.json({
    success: true,
    message: 'Live Roam sync queued',
    timestamp: new Date().toISOString(),
  })
}

/**
 * Health check
 */
export async function GET() {
  try {
    const lastSync = await prisma.syncLog.findFirst({
      where: { action: 'SCHEDULED_SYNC' },
      orderBy: { createdAt: 'desc' },
    })

    const roamTestCaseCount = await prisma.roamTestCase.count()
    const repositoryNodeCount = await prisma.repositoryNode.count()

    return NextResponse.json({
      status: 'healthy',
      scheduler: 'GitHub Actions - every 5 minutes',
      syncMethod: 'roam-cli with spawn()',
      lastSyncAt: lastSync?.createdAt || null,
      lastSyncDuration: lastSync?.durationMs || null,
      metrics: {
        roamTestCases: roamTestCaseCount,
        repositoryNodes: repositoryNodeCount,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
