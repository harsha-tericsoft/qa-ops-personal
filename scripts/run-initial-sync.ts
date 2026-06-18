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

    console.log(`\n🚀 Running initialSync with timing logs...\n`)

    const result = await initialSync(config.projectId)

    console.log(`\n✅ Sync completed:`)
    console.log(`   ${JSON.stringify(result, null, 2)}`)

    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
