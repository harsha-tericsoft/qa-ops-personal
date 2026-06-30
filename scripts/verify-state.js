const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  try {
    // Get repository count
    const repoCount = await prisma.repository.count()

    // Get latest repository
    const latestRepo = await prisma.repository.findFirst({
      orderBy: { lastSyncAt: 'desc' },
      include: {
        _count: {
          select: { nodes: true }
        }
      }
    })

    // Get test case count
    const testCaseCount = await prisma.roamTestCase.count()

    console.log('\n=== CURRENT DATABASE STATE ===')
    console.log(`Total Repositories: ${repoCount}`)
    
    if (latestRepo) {
      console.log(`\nLatest Repository:`)
      console.log(`  Name: ${latestRepo.name}`)
      console.log(`  ID: ${latestRepo.id}`)
      console.log(`  RepositoryNode Count: ${latestRepo._count.nodes}`)
      console.log(`  Last Sync Status: ${latestRepo.lastSyncStatus}`)
      console.log(`  Last Sync Time: ${latestRepo.lastSyncAt}`)
      console.log(`  Total TestCase Count (project-wide): ${latestRepo.totalTestCount}`)
    }

    console.log(`\nTotal RoamTestCase Records (all projects): ${testCaseCount}`)

  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
