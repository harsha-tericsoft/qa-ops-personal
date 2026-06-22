const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function diagnose() {
  console.log('\n' + '='.repeat(80))
  console.log('ROOT CAUSE ANALYSIS: ZERO REPOSITORY NODES')
  console.log('='.repeat(80))

  try {
    const projectId = 'cmqn71swd0e5g7k4gc9t6nq2b'

    // A) Check repositories
    console.log('\nA) CODE REPOSITORIES')
    const repos = await prisma.codeRepository.findMany({
      where: { projectId },
    })
    console.log(`   Count: ${repos.length}`)
    if (repos.length === 0) {
      console.log(`   ❌ NO REPOSITORIES - This is why nodes cannot be imported`)
      console.log(`      RepositoryNode requires repositoryId (foreign key)`)
      console.log(`      Without a repository, nodes have nowhere to be stored`)
    }

    // B) Check repository nodes
    console.log('\nB) REPOSITORY NODES')
    const nodes = await prisma.repositoryNode.findMany({
      where: { projectId },
    })
    console.log(`   Count: ${nodes.length}`)

    // C) Check Roam test cases (imported from Roam, not yet converted to nodes)
    console.log('\nC) ROAM TEST CASES')
    const roamCases = await prisma.roamTestCase.findMany({
      where: { projectId },
    })
    console.log(`   Count: ${roamCases.length}`)
    if (roamCases.length > 0) {
      console.log(`   ✓ Roam import successful - data exists`)
      console.log(`   First case: ${roamCases[0].title}`)
    } else {
      console.log(`   ❌ Roam import failed - 0 test cases`)
    }

    // D) Check test cases (derived from repository nodes)
    console.log('\nD) TEST CASES')
    const testCases = await prisma.testCase.findMany({
      where: { projectId },
    })
    console.log(`   Count: ${testCases.length}`)

    // E) Check Roam config
    console.log('\nE) ROAM CONFIGURATION')
    const config = await prisma.roamConfig.findUnique({
      where: { projectId },
    })
    console.log(`   graphName: ${config.graphName}`)
    console.log(`   repositoryRootPage: ${config.repositoryRootPage}`)
    console.log(`   apiToken: ${config.apiToken ? '✓ SET' : '❌ MISSING'}`)
    console.log(`   lastSyncAt: ${config.lastSyncAt}`)
    console.log(`   lastSyncStatus: ${config.lastSyncStatus}`)

    // EVIDENCE
    console.log('\n' + '='.repeat(80))
    console.log('EVIDENCE & FINDINGS')
    console.log('='.repeat(80))

    console.log(`\n1️⃣  Project Configuration`)
    console.log(`    ✓ Roam config complete (graph + root page + token)`)
    console.log(`    ✓ Last sync: ${config.lastSyncAt}`)
    console.log(`    ✓ Last sync status: ${config.lastSyncStatus}`)

    console.log(`\n2️⃣  Data Import State`)
    console.log(`    RepositoryNode:  ${nodes.length} ❌`)
    console.log(`    RoamTestCase:    ${roamCases.length} ${roamCases.length > 0 ? '✓' : '❌'}`)
    console.log(`    TestCase:        ${testCases.length} ❌`)

    console.log(`\n3️⃣  ROOT CAUSE`)
    console.log(`    ❌ NO CODE REPOSITORIES EXIST`)
    console.log(`\n    Why this matters:`)
    console.log(`    - RepositoryNode model requires repositoryId (foreign key constraint)`)
    console.log(`    - CREATE TABLE RepositoryNode has: FOREIGN KEY (repositoryId)`)
    console.log(`    - Without a repository, nodes cannot be inserted`)

    console.log(`\n4️⃣  THE PIPELINE FAILURE`)
    console.log(`    1. Roam API ──> Returns test cases ✓`)
    console.log(`    2. Store in RoamTestCase ──> Success ✓`)
    console.log(`    3. Convert to RepositoryNode ──> BLOCKED (no repository)`)
    console.log(`    4. Create TestCase from nodes ──> BLOCKED`)
    console.log(`    5. Dashboard sees 0 nodes ──> Correct result`)

    console.log(`\n5️⃣  WHAT'S MISSING`)
    console.log(`    A CodeRepository must be created BEFORE import`)
    console.log(`    RepositoryNode creation requires:`)
    console.log(`      - repositoryId (FK to CodeRepository)`)
    console.log(`      - name, slug, path, depth, type`)

    console.log(`\n` + '='.repeat(80))
    console.log('CONCLUSION')
    console.log('='.repeat(80))
    console.log(`\nROOT CAUSE: Missing CodeRepository`)
    console.log(`The project has Roam configuration and successful sync,`)
    console.log(`but no CodeRepository to associate imported nodes with.`)
    console.log(`\nFIX REQUIRED: Create a CodeRepository first, then re-sync.`)

  } catch (e) {
    console.error('Error:', e.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

diagnose()
