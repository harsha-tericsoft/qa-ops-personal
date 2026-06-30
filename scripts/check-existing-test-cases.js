const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  try {
    const projectId = 'cmqwc4sb10000ib04b74bgtxs' // The project for this repository
    const repoId = 'cmr0yox8y000f7ksgipi0z2ci'

    // Check if any RoamTestCase records exist for this project
    const existingTestCases = await prisma.roamTestCase.findMany({
      where: { projectId },
      select: {
        id: true,
        repositoryNodeId: true,
        title: true,
        sourceRoamUid: true
      },
      take: 20
    })

    console.log(`\n=== EXISTING RoamTestCase RECORDS FOR PROJECT ===`)
    console.log(`Project ID: ${projectId}`)
    console.log(`Total RoamTestCase records: ${await prisma.roamTestCase.count({ where: { projectId } })}`)

    if (existingTestCases.length > 0) {
      console.log(`\nFirst 20 existing test cases:`)
      for (const tc of existingTestCases) {
        console.log(`  - ${tc.id}: "${tc.title.substring(0, 60)}" (nodeId: ${tc.repositoryNodeId.substring(0, 12)}...)`)
      }
    } else {
      console.log(`No existing RoamTestCase records found.`)
    }

    // Check: Are there RepositoryNode records for test cases that we found?
    console.log(`\n=== LINKING RepositoryNode TO RoamTestCase ===`)
    
    const testNodeIds = await prisma.repositoryNode.findMany({
      where: {
        repositoryId: repoId,
        name: {
          startsWith: 'Test::'
        }
      },
      select: { id: true },
      take: 5
    })

    console.log(`Found ${testNodeIds.length} test case nodes.`)

    for (const node of testNodeIds) {
      const linkedTestCase = await prisma.roamTestCase.findFirst({
        where: { repositoryNodeId: node.id }
      })

      console.log(`\nRepositoryNode: ${node.id.substring(0, 12)}...`)
      if (linkedTestCase) {
        console.log(`  ✓ Linked to RoamTestCase: ${linkedTestCase.id}`)
      } else {
        console.log(`  ✗ NOT linked to any RoamTestCase`)
      }
    }

  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
