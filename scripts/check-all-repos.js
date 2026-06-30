const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  try {
    // Get all repositories with node counts
    const repos = await prisma.repository.findMany({
      orderBy: { lastSyncAt: 'desc' },
      include: {
        _count: {
          select: { nodes: true }
        }
      }
    })

    console.log('\n=== ALL REPOSITORIES ===')
    for (const repo of repos) {
      console.log(`\n${repo.name}`)
      console.log(`  ID: ${repo.id}`)
      console.log(`  Nodes: ${repo._count.nodes}`)
      console.log(`  Last Sync: ${repo.lastSyncAt}`)
      console.log(`  Status: ${repo.lastSyncStatus}`)
      console.log(`  Total TestCase: ${repo.totalTestCount}`)
    }

  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
