import { prisma } from '@/lib/prisma'

/**
 * Extract test cases from imported RepositoryNodes
 * Identifies nodes matching test case patterns and creates RoamTestCase records
 * Uses batched operations for performance with large node counts
 */
export class TestCaseExtractor {
  /**
   * Check if a node text matches test case patterns
   * Test cases: nodes starting with "Test::", tagged with #Manual/#Automated, or using BDD patterns (When/Then/Given)
   */
  static isTestCaseNode(text: string, tags: string[]): boolean {
    // Strip markdown formatting for pattern matching
    const cleanText = text.replace(/^\*+\s*/, '').trim()

    // Direct test case markers
    if (cleanText.startsWith('Test::') || cleanText.startsWith('Test:')) return true

    // BDD test case patterns (When, Then, Given)
    // These are valid test case statements even without "Test::" prefix
    if (cleanText.includes('When ') || cleanText.includes('Then ') || cleanText.includes('Given ')) {
      return true
    }

    // Tag-based detection
    if (tags.includes('Manual') || tags.includes('Automation') || tags.includes('Automated')) {
      return true
    }

    return false
  }

  /**
   * Extract test cases from all RepositoryNodes in a repository
   * Uses batched database operations for performance
   */
  static async extractTestCases(repositoryId: string, projectId: string): Promise<{
    created: number
    updated: number
    skipped: number
    errors: string[]
  }> {
    const result: { created: number; updated: number; skipped: number; errors: string[] } = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    }

    try {
      // Load all nodes in this repository
      const nodes = await prisma.repositoryNode.findMany({
        where: { repositoryId },
        select: { id: true, name: true, tags: true, roamNodeId: true, parentId: true, type: true },
      })

      console.log('[TestCaseExtractor] Found', nodes.length, 'nodes to scan')

      // TEMPORARY LOGGING: Examine first 20 nodes scanned
      console.log('\n[TestCaseExtractor] === SCANNING FIRST 20 NODES FOR EVIDENCE ===')
      let nodesLogged = 0
      for (const node of nodes) {
        if (nodesLogged >= 20) break

        const isTestCase = this.isTestCaseNode(node.name, node.tags || [])

        let reason = ''
        if (!isTestCase) {
          const cleanText = node.name.replace(/^\*+\s*/, '').trim()
          const hasTestPrefix = cleanText.startsWith('Test::') || cleanText.startsWith('Test:')
          const hasBDDPattern = cleanText.includes('When ') || cleanText.includes('Then ') || cleanText.includes('Given ')
          const hasTestTag = (node.tags || []).some(t => ['Manual', 'Automation', 'Automated'].includes(t))

          if (!hasTestPrefix) reason += 'NoTestPrefix '
          if (!hasBDDPattern) reason += 'NoBDDPattern '
          if (!hasTestTag) reason += 'NoTestTag'
          reason = reason.trim() || 'Unknown'
        }

        console.log(`[TCE:${nodesLogged + 1}] ID: ${node.id.substring(0, 12)}... | Text: "${node.name.substring(0, 60)}" | Parent: ${node.parentId ? node.parentId.substring(0, 8) + '...' : 'null'} | Type: ${(node as any).type} | IsTestCase: ${isTestCase} | Reason: ${reason}`)
        nodesLogged++
      }
      console.log(`[TestCaseExtractor] === END SCAN (logged ${nodesLogged} nodes) ===\n`)

      // Get all existing RoamTestCases for this project (batch query once)
      const existing = await prisma.roamTestCase.findMany({
        where: { projectId },
        select: { repositoryNodeId: true },
      })
      const existingNodeIds = new Set(existing.map((r) => r.repositoryNodeId))

      // Filter and prepare nodes to create (batch operation)
      const nodesToCreate: Array<{
        projectId: string
        repositoryNodeId: string
        title: string
        status: 'NOT_RUN'
        priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
        tags: string[]
        sourceRoamUid: string | undefined
      }> = []

      for (const node of nodes) {
        // Check if this node is a test case
        const isTestCase = this.isTestCaseNode(node.name, node.tags || [])
        if (!isTestCase) {
          result.skipped++
          continue
        }

        // Skip if already exists
        if (existingNodeIds.has(node.id)) {
          result.skipped++
          continue
        }

        // Extract priority from tags
        let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM'
        if (node.tags?.includes('Critical')) priority = 'CRITICAL'
        else if (node.tags?.includes('High')) priority = 'HIGH'
        else if (node.tags?.includes('Low')) priority = 'LOW'

        // Log test case creation with tags
        if (node.tags && node.tags.length > 0) {
          console.log(`[TestCaseExtractor] Creating NEW test case with tags: "${node.name.substring(0, 60)}"`)
          console.log(`  - tags: ${JSON.stringify(node.tags)}`)
        }

        nodesToCreate.push({
          projectId,
          repositoryNodeId: node.id,
          title: node.name,
          status: 'NOT_RUN',
          priority,
          tags: node.tags || [],
          sourceRoamUid: node.roamNodeId || undefined,
        })
      }

      console.log('[TestCaseExtractor] Batch creating', nodesToCreate.length, 'test cases')

      // Batch insert all at once
      if (nodesToCreate.length > 0) {
        try {
          const created = await prisma.roamTestCase.createMany({
            data: nodesToCreate,
            skipDuplicates: true,
          })
          result.created = created.count
        } catch (error: any) {
          result.errors.push(`Batch creation error: ${error instanceof Error ? error.message : 'Unknown'}`)
        }
      }

      console.log('[TestCaseExtractor] Extraction complete: created', result.created, 'test cases')
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    }

    return result
  }
}
