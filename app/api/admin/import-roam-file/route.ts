import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { MarkdownRoamParser } from '@/lib/roam/markdown-parser'
import { TestCaseExtractor } from '@/lib/roam/test-case-extractor'

export async function POST(req: NextRequest) {
  try {
    const { uid, markdown } = await req.json()

    if (!uid || !markdown) {
      return NextResponse.json(
        { error: 'uid and markdown required' },
        { status: 400 }
      )
    }

    console.log('[import-roam-file] Starting import')
    console.log('[import-roam-file] Root UID:', uid)
    console.log('[import-roam-file] Markdown size:', markdown.length)

    // Parse markdown
    console.log('[import-roam-file] Parsing markdown...')
    const tree = MarkdownRoamParser.parseMarkdown(markdown, 'TestSuite : Kinergy', uid)

    if (!tree) {
      return NextResponse.json(
        { error: 'Failed to parse markdown' },
        { status: 400 }
      )
    }

    console.log('[import-roam-file] Flattening tree...')
    const nodes = MarkdownRoamParser.flattenTree(tree)
    console.log('[import-roam-file] Flattened nodes:', nodes.length)

    // Get or create repository
    const projectId = '79d857b2-36dd-4810-88ae-3ca8d9aaa8d4'
    let repository = await prisma.repository.findFirst({
      where: { projectId },
    })

    if (!repository) {
      repository = await prisma.repository.create({
        data: {
          projectId,
          name: 'TestSuite : Kinergy',
          description: 'Real Roam import',
        },
      })
    }

    console.log('[import-roam-file] Repository:', repository.id)

    // TWO-PASS IMPORT
    console.log('[import-roam-file] PASS 1: Creating nodes...')
    const uidToNodeId = new Map<string, string>()
    let created = 0
    let errors: string[] = []

    for (const node of nodes) {
      if (!node.uid) continue

      try {
        const existing = await prisma.repositoryNode.findUnique({
          where: { roamNodeId: node.uid },
        })

        if (existing) {
          uidToNodeId.set(node.uid, existing.id)
          continue
        }

        // Create with parentId=null initially
        const nodeType = node.isTestCase ? 'FILE' : 'FOLDER'
        const slug = node.text
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .substring(0, 50)

        const createdNode = await prisma.repositoryNode.create({
          data: {
            repositoryId: repository.id,
            projectId,
            name: node.text,
            slug,
            path: node.parentPath,
            depth: node.nodeDepth,
            parentId: null, // Will update in pass 2
            roamNodeId: node.uid,
            type: nodeType as any,
            tags: node.tags || [],
            syncedAt: new Date(),
          },
        })

        uidToNodeId.set(node.uid, createdNode.id)
        created++
      } catch (error) {
        errors.push(`Error creating node ${node.uid}: ${error instanceof Error ? error.message : 'Unknown'}`)
      }
    }

    console.log('[import-roam-file] PASS 1 complete: created', created)

    // PASS 2: Update parent references
    console.log('[import-roam-file] PASS 2: Updating parent references...')
    let updated = 0

    for (const node of nodes) {
      if (!node.uid || !node.parentId) continue

      try {
        const nodeId = uidToNodeId.get(node.uid)
        const parentNodeId = uidToNodeId.get(node.parentId)

        if (!nodeId || !parentNodeId) continue

        await prisma.repositoryNode.update({
          where: { id: nodeId },
          data: { parentId: parentNodeId },
        })

        updated++
      } catch (error) {
        errors.push(`Error updating parent for ${node.uid}: ${error instanceof Error ? error.message : 'Unknown'}`)
      }
    }

    console.log('[import-roam-file] PASS 2 complete: updated', updated)

    // Extract test cases
    console.log('[import-roam-file] Extracting test cases...')
    const result = await TestCaseExtractor.extractTestCases(repository.id, projectId)
    console.log('[import-roam-file] Extraction result:', result)

    // Get final counts
    const nodeCount = await prisma.repositoryNode.count()
    const testCaseCount = await prisma.roamTestCase.count()

    return NextResponse.json({
      success: true,
      markdown: {
        sizeBytes: markdown.length,
        totalParsedNodes: nodes.length,
      },
      statistics: {
        nodesCreated: created,
        parentsUpdated: updated,
        nodesInDatabase: nodeCount,
        testCasesExtracted: testCaseCount,
        extractionResult: result,
      },
      errors,
    })
  } catch (error) {
    console.error('[import-roam-file] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
