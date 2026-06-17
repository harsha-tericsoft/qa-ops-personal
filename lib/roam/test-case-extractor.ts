import { prisma } from '@/lib/prisma'

/**
 * Extract test cases from imported RepositoryNodes
 * Identifies nodes matching test case patterns and creates RoamTestCase records
 */
export class TestCaseExtractor {
  /**
   * Check if a node text matches test case patterns
   * Test cases: nodes starting with "Test::" or tagged with #Manual/#Automated
   */
  static isTestCaseNode(text: string, tags: string[]): boolean {
    // Direct test case markers
    if (text.startsWith('Test::') || text.startsWith('Test:')) return true

    // Tag-based detection
    if (tags.includes('Manual') || tags.includes('Automation') || tags.includes('Automated')) {
      return true
    }

    return false
  }

  /**
   * Extract test cases from all RepositoryNodes in a repository
   * Creates RoamTestCase records for matching nodes
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
      })

      console.log('[TestCaseExtractor] Found', nodes.length, 'nodes to scan')

      // Check each node
      for (const node of nodes) {
        try {
          // Check if this node is a test case
          const isTestCase = this.isTestCaseNode(node.name, node.tags || [])
          if (!isTestCase) {
            result.skipped++
            continue
          }

          // Check if test case already exists
          const existing = await prisma.roamTestCase.findUnique({
            where: { repositoryNodeId: node.id },
          })

          if (existing) {
            result.skipped++
            continue
          }

          // Extract priority from tags
          let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM'
          if (node.tags?.includes('Critical')) priority = 'CRITICAL'
          else if (node.tags?.includes('High')) priority = 'HIGH'
          else if (node.tags?.includes('Low')) priority = 'LOW'

          // Create test case record
          await prisma.roamTestCase.create({
            data: {
              projectId,
              repositoryNodeId: node.id,
              title: node.name,
              status: 'NOT_RUN',
              priority,
              tags: node.tags || [],
              sourceRoamUid: node.roamNodeId || undefined,
            },
          })

          result.created++
        } catch (error) {
          result.errors.push(
            `Error processing node "${node.name}": ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        }
      }

      console.log('[TestCaseExtractor] Extraction complete: created', result.created, 'test cases')
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    }

    return result
  }
}
