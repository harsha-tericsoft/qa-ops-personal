const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  try {
    // Get repositories
    const repos = await prisma.repository.findMany({
      include: {
        _count: {
          select: { nodes: true }
        }
      }
    })

    console.log('\n=== REPOSITORIES ===')
    for (const repo of repos) {
      console.log(`Repository: ${repo.name}`)
      console.log(`  ID: ${repo.id}`)
      console.log(`  Node count: ${repo._count.nodes}`)
      console.log(`  Last sync: ${repo.lastSyncAt}`)
      console.log(`  Last sync status: ${repo.lastSyncStatus}`)
      console.log(`  Total test count: ${repo.totalTestCount}`)
    }

    // Get test cases
    const testCases = await prisma.roamTestCase.findMany()
    console.log(`\n=== ROAM TEST CASES ===`)
    console.log(`Total test cases: ${testCases.length}`)

    // Get first 5 repository nodes
    const nodes = await prisma.repositoryNode.findMany({
      take: 5,
      orderBy: { createdAt: 'asc' }
    })

    console.log(`\n=== FIRST 5 REPOSITORY NODES ===`)
    for (const node of nodes) {
      console.log(`Node: ${node.id}`)
      console.log(`  Name: ${node.name}`)
      console.log(`  Parent ID: ${node.parentId}`)
      console.log(`  Type: ${node.type}`)
      console.log(`  Roam Node ID: ${node.roamNodeId}`)
    }

  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
