const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function recordBaseline() {
  console.log('='.repeat(70))
  console.log('STEP 1: BASELINE COUNTS')
  console.log('='.repeat(70))
  console.log('')

  const projectId = 'cmqoreffq00047kgcwwqnkmzu'

  const repoNodeCount = await prisma.repositoryNode.count()
  const testCaseCount = await prisma.roamTestCase.count()

  console.log(`RepositoryNode count: ${repoNodeCount}`)
  console.log(`RoamTestCase count: ${testCaseCount}`)
  console.log('')

  // Get most recent test case
  const lastTestCase = await prisma.roamTestCase.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { title: true, createdAt: true, sourceRoamUid: true }
  })

  console.log('Most recent test case:')
  console.log(`  Title: ${lastTestCase?.title?.substring(0, 80)}...`)
  console.log(`  Created: ${lastTestCase?.createdAt}`)
  console.log(`  UID: ${lastTestCase?.sourceRoamUid}`)
  console.log('')

  await prisma.$disconnect()
  return { repoNodeCount, testCaseCount }
}

recordBaseline().catch(console.error)
