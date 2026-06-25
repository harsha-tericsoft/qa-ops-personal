import { prisma } from './lib/prisma'

async function main() {
  const projectCount = await prisma.project.count()
  const repoCount = await prisma.repository.count()
  const repoNodeCount = await prisma.repositoryNode.count()
  const roamTestCaseCount = await prisma.roamTestCase.count()
  const testCaseCount = await prisma.testCase.count()
  const testCaseNodeCount = await prisma.testCaseNode.count()
  const tagCount = await prisma.tag.count()
  const suiteCount = await prisma.testSuite.count()
  const cycleCount = await prisma.executionCycle.count()

  console.log('=== DATA SUMMARY ===')
  console.log(`Projects: ${projectCount}`)
  console.log(`Repositories: ${repoCount}`)
  console.log(`RepositoryNodes: ${repoNodeCount}`)
  console.log(`RoamTestCases: ${roamTestCaseCount}`)
  console.log(`TestCases: ${testCaseCount}`)
  console.log(`TestCaseNodes: ${testCaseNodeCount}`)
  console.log(`Tags: ${tagCount}`)
  console.log(`TestSuites: ${suiteCount}`)
  console.log(`ExecutionCycles: ${cycleCount}`)

  // Get first project
  const firstProject = await prisma.project.findFirst()
  if (firstProject) {
    console.log(`\n=== FIRST PROJECT ===`)
    console.log(`ID: ${firstProject.id}`)
    console.log(`Name: ${firstProject.name}`)

    // Get its repo
    const repo = await prisma.repository.findFirst({
      where: { projectId: firstProject.id }
    })
    if (repo) {
      console.log(`\nRepository: ${repo.name}`)
    }
  }

  await prisma.$disconnect()
  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
