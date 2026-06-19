#!/usr/bin/env npx tsx

import { prisma } from '@/lib/prisma'
import { initialSync } from '@/lib/roam/sync'

async function main() {
  try {
    // Find a project with RoamConfig
    const config = await prisma.roamConfig.findFirst({
      select: { projectId: true, graphName: true, repositoryRootPage: true },
      orderBy: { updatedAt: 'desc' }
    })

    if (!config) {
      console.log('❌ No RoamConfig found. Please set up a project first.')
      process.exit(1)
    }

    console.log(`\n✅ Found project with RoamConfig:`)
    console.log(`   projectId: ${config.projectId}`)
    console.log(`   graphName: ${config.graphName}`)
    console.log(`   repositoryRootPage: ${config.repositoryRootPage}`)

    // Get repository to check if we need to clear it
    const repo = await prisma.repository.findFirst({
      where: { projectId: config.projectId },
      select: { id: true }
    })

    if (repo) {
      console.log(`\n⚠️ Clearing existing repository data...`)
      // Delete test cases by project
      await prisma.roamTestCase.deleteMany({ where: { projectId: config.projectId } })
      // Delete nodes by repository
      await prisma.repositoryNode.deleteMany({ where: { repositoryId: repo.id } })
      console.log(`✅ Repository cleared`)
    }

    console.log(`\n🚀 Running initialSync with optimization (batch inserts)...\n`)

    const result = await initialSync(config.projectId)

    console.log(`\n✅ Sync completed:`)
    console.log(`   ${JSON.stringify(result, null, 2)}`)

    // Get stats
    const nodes = await prisma.repositoryNode.count({ where: { repositoryId: repo?.id } })
    const tests = await prisma.roamTestCase.count({ where: { projectId: config.projectId } })

    console.log(`\n📊 Final stats:`)
    console.log(`   Total repository nodes: ${nodes}`)
    console.log(`   Total test cases: ${tests}`)

    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
