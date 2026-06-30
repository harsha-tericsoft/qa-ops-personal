const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  try {
    // Get the repository with 3735 nodes
    const repoId = 'cmr0yox8y000f7ksgipi0z2ci'

    // Query 1: Find nodes starting with "Test::"
    console.log('\n=== SEARCHING FOR NODES STARTING WITH "Test::" ===')
    const nodesStartingWithTest = await prisma.repositoryNode.findMany({
      where: {
        repositoryId: repoId,
        name: {
          startsWith: 'Test::'
        }
      },
      take: 20,
      select: {
        id: true,
        roamNodeId: true,
        name: true,
        parentId: true,
        depth: true,
        order: true,
        type: true,
        tags: true,
        slug: true,
        description: true
      }
    })

    console.log(`Found ${nodesStartingWithTest.length} nodes starting with "Test::"`)

    if (nodesStartingWithTest.length > 0) {
      console.log('\n=== FIRST 20 NODES WITH "Test::" PREFIX ===')
      for (let i = 0; i < nodesStartingWithTest.length; i++) {
        const node = nodesStartingWithTest[i]
        console.log(`\n${i + 1}. Node ID: ${node.id.substring(0, 12)}...`)
        console.log(`   Roam UID: ${node.roamNodeId}`)
        console.log(`   Title: "${node.name.substring(0, 100)}"`)
        console.log(`   Parent ID: ${node.parentId ? node.parentId.substring(0, 12) + '...' : 'null'}`)
        console.log(`   Depth: ${node.depth}`)
        console.log(`   Order: ${node.order}`)
        console.log(`   Type: ${node.type}`)
        console.log(`   Tags: ${JSON.stringify(node.tags)}`)
        console.log(`   Slug: ${node.slug}`)
      }
    } else {
      // Query 2: If no prefix match, search for contains
      console.log('\nNo nodes starting with "Test::" found. Searching for nodes CONTAINING "Test::"...')
      
      const nodesContainingTest = await prisma.repositoryNode.findMany({
        where: {
          repositoryId: repoId,
          name: {
            contains: 'Test::'
          }
        },
        take: 20,
        select: {
          id: true,
          roamNodeId: true,
          name: true,
          parentId: true,
          depth: true,
          order: true,
          type: true,
          tags: true,
          slug: true
        }
      })

      console.log(`Found ${nodesContainingTest.length} nodes containing "Test::"`)
      
      if (nodesContainingTest.length > 0) {
        console.log('\n=== FIRST 20 NODES CONTAINING "Test::" ===')
        for (let i = 0; i < nodesContainingTest.length; i++) {
          const node = nodesContainingTest[i]
          console.log(`\n${i + 1}. Node ID: ${node.id.substring(0, 12)}...`)
          console.log(`   Roam UID: ${node.roamNodeId}`)
          console.log(`   Title: "${node.name.substring(0, 100)}"`)
          console.log(`   Parent ID: ${node.parentId ? node.parentId.substring(0, 12) + '...' : 'null'}`)
          console.log(`   Depth: ${node.depth}`)
          console.log(`   Order: ${node.order}`)
          console.log(`   Type: ${node.type}`)
          console.log(`   Tags: ${JSON.stringify(node.tags)}`)
        }
      } else {
        console.log('\n⚠️  NO NODES FOUND CONTAINING "Test::" AT ALL')
        console.log('This suggests the prefix is being stripped during import.')
      }
    }

    // Query 3: Sample of all nodes to see what text patterns exist
    console.log('\n\n=== SAMPLING FIRST 50 NODES (ANY TEXT PATTERN) ===')
    const sampleNodes = await prisma.repositoryNode.findMany({
      where: { repositoryId: repoId },
      take: 50,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        tags: true,
        type: true
      }
    })

    for (let i = 0; i < sampleNodes.length; i++) {
      const node = sampleNodes[i]
      console.log(`${i + 1}. "${node.name.substring(0, 70)}" | Tags: ${JSON.stringify(node.tags)} | Type: ${node.type}`)
    }

  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
