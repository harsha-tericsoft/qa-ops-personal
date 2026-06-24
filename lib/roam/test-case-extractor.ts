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
    // Direct test case markers
    if (text.startsWith('Test::') || text.startsWith('Test:')) return true

    // BDD test case patterns (When, Then, Given)
    // These are valid test case statements even without "Test::" prefix
    if (text.includes('When ') || text.includes('Then ') || text.includes('Given ')) {
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
        select: { id: true, name: true, tags: true, roamNodeId: true },
      })

      console.log('[TestCaseExtractor] Found', nodes.length, 'nodes to scan')

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
