const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  try {
    // Get the latest repository (from our test)
    const latestRepo = await prisma.repository.findFirst({
      orderBy: { lastSyncAt: 'desc' },
      include: {
        nodes: {
          take: 20,
          orderBy: { createdAt: 'asc' }
        },
        _count: {
          select: { nodes: true }
        }
      }
    })

    if (!latestRepo) {
      console.log('No repositories found')
      return
    }

    console.log('\n=== LATEST SYNC RESULT ===')
    console.log(`Repository: ${latestRepo.name}`)
    console.log(`ID: ${latestRepo.id}`)
    console.log(`Last sync: ${latestRepo.lastSyncAt}`)
    console.log(`Last sync status: ${latestRepo.lastSyncStatus}`)
    console.log(`Total nodes: ${latestRepo._count.nodes}`)
    console.log(`Total test count: ${latestRepo.totalTestCount}`)

    console.log(`\n=== FIRST 20 NODES IN LATEST SYNC ===`)
    for (let i = 0; i < latestRepo.nodes.length; i++) {
      const node = latestRepo.nodes[i]
      console.log(`\n${i + 1}. Node ID: ${node.id}`)
      console.log(`   Name: ${node.name}`)
      console.log(`   Parent ID: ${node.parentId}`)
      console.log(`   Type: ${node.type}`)
      console.log(`   Roam Node ID: ${node.roamNodeId}`)
      console.log(`   Slug: ${node.slug}`)
      console.log(`   Path: ${node.path}`)
    }

  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
