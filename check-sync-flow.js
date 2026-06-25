const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function investigate() {
  console.log('='.repeat(70))
  console.log('SYNC FLOW INVESTIGATION')
  console.log('='.repeat(70))
  console.log('')

  const projectId = 'cmqoreffq00047kgcwwqnkmzu'

  // Check sync logs
  console.log('STEP 1: Checking most recent sync logs...')
  const syncLogs = await prisma.syncLog.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  console.log(`Found ${syncLogs.length} sync logs:\n`)
  for (const log of syncLogs) {
    console.log(`  - ${log.createdAt}: ${log.status} (nodes: ${log.nodesImported}, created: ${log.nodesCreated}, updated: ${log.nodesUpdated})`)
  }
  console.log('')

  // Get counts from last 2 syncs
  if (syncLogs.length >= 2) {
    const lastSync = syncLogs[0]
    const prevSync = syncLogs[1]

    console.log('STEP 2: Comparing last two syncs...')
    console.log(`  Before sync (${prevSync.createdAt}):`)
    console.log(`    RepositoryNode count: (checking...)`)
    console.log(`    RoamTestCase count: (checking...)`)
    console.log('')
    console.log(`  After sync (${lastSync.createdAt}):`)
    console.log(`    Created nodes: ${lastSync.nodesCreated}`)
    console.log(`    Updated nodes: ${lastSync.nodesUpdated}`)
    console.log('')
  }

  // Check repository details
  console.log('STEP 3: Repository and node counts...')
  const repo = await prisma.repository.findFirst({
    where: { projectId },
    include: { _count: { select: { nodes: true } } }
  })

  if (repo) {
    console.log(`  Repository: ${repo.id}`)
    console.log(`  RepositoryNode count: ${repo._count.nodes}`)
  }

  const testCaseCount = await prisma.roamTestCase.count({
    where: { projectId }
  })
  console.log(`  RoamTestCase count: ${testCaseCount}`)
  console.log('')

  // Check for recently created nodes
  console.log('STEP 4: Most recently created RepositoryNodes...')
  const recentNodes = await prisma.repositoryNode.findMany({
    where: { repositoryId: repo?.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, name: true, createdAt: true, roamNodeId: true }
  })

  for (const node of recentNodes) {
    console.log(`  - Created ${node.createdAt}`)
    console.log(`    Name: ${node.name?.substring(0, 60)}...`)
    console.log(`    UID: ${node.roamNodeId}`)
  }

  console.log('')
  console.log('STEP 5: Most recently created RoamTestCases...')
  const recentTestCases = await prisma.roamTestCase.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, title: true, createdAt: true, sourceRoamUid: true }
  })

  if (recentTestCases.length > 0) {
    for (const tc of recentTestCases) {
      console.log(`  - Created ${tc.createdAt}`)
      console.log(`    Title: ${tc.title?.substring(0, 60)}...`)
    }
  } else {
    console.log('  (No recent test cases)')
  }

  console.log('')
  console.log('ANALYSIS:')
  if (syncLogs.length > 0 && syncLogs[0].nodesCreated === 0 && syncLogs[0].nodesUpdated === 0) {
    console.log('⚠️  ISSUE: Last sync reported SUCCESS but created 0 nodes and updated 0 nodes')
    console.log('   This means the sync found NO new/changed nodes from Roam')
  } else {
    console.log('✓ Sync appears to have processed nodes')
  }

  await prisma.$disconnect()
}

investigate().catch(console.error)
