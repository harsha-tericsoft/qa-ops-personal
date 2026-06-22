const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function diagnose() {
  console.log('\n' + '='.repeat(80))
  console.log('FRESH PROJECT IMPORT DIAGNOSIS')
  console.log('='.repeat(80))

  try {
    // Step 1: Find the project
    console.log('\n1️⃣ VERIFY PROJECT CONFIGURATION')
    const project = await prisma.project.findFirst({
      where: { name: 'my test project' },
      include: { roamConfig: true, codeRepositories: true },
    })

    if (!project) {
      console.log('❌ Project "my test project" NOT FOUND')
      const allProjects = await prisma.project.findMany()
      console.log('\nAvailable projects:')
      allProjects.forEach(p => console.log(`  - ${p.name} (${p.id})`))
      process.exit(1)
    }

    console.log(`✓ Project found: ${project.name}`)
    console.log(`  ID: ${project.id}`)

    // Step 2: Check Roam config
    console.log('\n2️⃣ VERIFY ROAM CONFIGURATION')
    
    if (!project.roamConfig) {
      console.log('❌ roamConfig NOT SET')
      process.exit(1)
    }

    const config = project.roamConfig
    console.log(`✓ roamConfig exists`)
    console.log(`  graphName: ${config.graphName || '❌ NULL'}`)
    console.log(`  repositoryRootPage: ${config.repositoryRootPage || '❌ NULL'}`)
    console.log(`  hasApiToken: ${config.apiToken ? '✓ YES' : '❌ NO'}`)
    console.log(`  lastSyncAt: ${config.lastSyncAt || 'never'}`)
    console.log(`  lastSyncStatus: ${config.lastSyncStatus || 'unknown'}`)

    if (!config.graphName || !config.repositoryRootPage || !config.apiToken) {
      console.log('\n❌ CONFIGURATION INCOMPLETE - Cannot proceed with sync')
      process.exit(1)
    }

    // Step 3: Check repositories
    console.log('\n3️⃣ VERIFY REPOSITORY CONFIGURATION')
    
    if (project.codeRepositories.length === 0) {
      console.log('❌ NO CODE REPOSITORIES CONFIGURED')
      process.exit(1)
    }

    const repo = project.codeRepositories[0]
    console.log(`✓ Repository exists`)
    console.log(`  Name: ${repo.name}`)
    console.log(`  ID: ${repo.id}`)

    // Step 4: Check current state
    console.log('\n4️⃣ CHECK CURRENT IMPORT STATE')
    
    const repoNodes = await prisma.repositoryNode.findMany({
      where: { projectId: project.id },
    })
    console.log(`RepositoryNode count: ${repoNodes.length}`)

    const roamTestCases = await prisma.roamTestCase.findMany({
      where: { projectId: project.id },
    })
    console.log(`RoamTestCase count: ${roamTestCases.length}`)

    // Step 5: Check if there are any test cases at all
    console.log('\n5️⃣ CHECK TEST CASE DATA')
    
    const allTestCases = await prisma.testCase.findMany({
      where: { projectId: project.id },
    })
    console.log(`TestCase count: ${allTestCases.length}`)

    // Summary
    console.log('\n' + '='.repeat(80))
    console.log('DIAGNOSTIC SUMMARY')
    console.log('='.repeat(80))

    console.log(`\nProject: ${project.name}`)
    console.log(`Configuration Status:`)
    console.log(`  graphName:           ${config.graphName ? '✓' : '✗'}`)
    console.log(`  repositoryRootPage:  ${config.repositoryRootPage ? '✓' : '✗'}`)
    console.log(`  apiToken:            ${config.apiToken ? '✓' : '✗'}`)
    
    console.log(`\nImport Status:`)
    console.log(`  RepositoryNode:      ${repoNodes.length} nodes`)
    console.log(`  RoamTestCase:        ${roamTestCases.length} cases`)
    console.log(`  TestCase:            ${allTestCases.length} cases`)

    if (repoNodes.length === 0 && config.graphName && config.repositoryRootPage && config.apiToken) {
      console.log(`\n⚠️  ISSUE: Configuration is complete but RepositoryNode count is 0`)
      console.log(`   Next step: Run manual sync to get detailed logs`)
    }

  } catch (e) {
    console.error('Error:', e.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

diagnose()
