const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  try {
    // Get a specific test case node (node 3 from the list)
    const testNode = await prisma.repositoryNode.findUnique({
      where: { id: 'cmr0yvkbk005...' }, // Will fail, so let's use the Roam UID instead
    }).catch(() => null)

    // Get by Roam UID instead
    const repoId = 'cmr0yox8y000f7ksgipi0z2ci'
    const testNodes = await prisma.repositoryNode.findMany({
      where: {
        repositoryId: repoId,
        roamNodeId: 'iXsNX118g'
      }
    })

    if (testNodes.length > 0) {
      const node = testNodes[0]
      console.log('\n=== ANALYZING TEST CASE NODE ===')
      console.log(`Node ID: ${node.id}`)
      console.log(`Roam UID: ${node.roamNodeId}`)
      console.log(`Name: "${node.name}"`)
      console.log(`Tags: ${JSON.stringify(node.tags)}`)
      console.log(`Type: ${node.type}`)
      console.log(`Depth: ${node.depth}`)

      // Now simulate TestCaseExtractor.isTestCaseNode() logic
      console.log('\n=== TESTING AGAINST TestCaseExtractor.isTestCaseNode() ===')
      
      const text = node.name
      const tags = node.tags || []
      
      console.log(`Input text: "${text}"`)
      console.log(`Input tags: ${JSON.stringify(tags)}`)

      // Strip markdown formatting for pattern matching (as per TestCaseExtractor)
      const cleanText = text.replace(/^\*+\s*/, '').trim()
      console.log(`\nCleaned text: "${cleanText}"`)

      // Check condition 1: Starts with Test:: or Test:
      const startsWithTestMarker = cleanText.startsWith('Test::') || cleanText.startsWith('Test:')
      console.log(`\nCondition 1 - Starts with "Test::" or "Test:"`)
      console.log(`  Result: ${startsWithTestMarker}`)
      console.log(`  Reason: ${startsWithTestMarker ? 'YES - text starts with "Test::"' : 'NO'}`)

      // Check condition 2: BDD patterns
      const hasBDDPattern = cleanText.includes('When ') || cleanText.includes('Then ') || cleanText.includes('Given ')
      console.log(`\nCondition 2 - Contains BDD pattern (When/Then/Given)`)
      console.log(`  Result: ${hasBDDPattern}`)
      console.log(`  Reason: ${hasBDDPattern ? 'YES - contains BDD pattern' : 'NO'}`)

      // Check condition 3: Tags
      const hasTestTag = tags.some(t => ['Manual', 'Automation', 'Automated'].includes(t))
      console.log(`\nCondition 3 - Has test tag (Manual/Automation/Automated)`)
      console.log(`  Tags to check: ["Manual", "Automation", "Automated"]`)
      console.log(`  Actual tags: ${JSON.stringify(tags)}`)
      console.log(`  Result: ${hasTestTag}`)
      console.log(`  Reason: ${hasTestTag ? `YES - contains tag: ${tags.find(t => ['Manual', 'Automation', 'Automated'].includes(t))}` : 'NO - no matching tags'}`)

      // Final decision
      const isTestCase = startsWithTestMarker || hasBDDPattern || hasTestTag
      console.log(`\n=== FINAL DECISION ===`)
      console.log(`isTestCase: ${isTestCase}`)
      console.log(`Should be extracted: ${isTestCase ? 'YES ✓' : 'NO ✗'}`)
    }

  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
