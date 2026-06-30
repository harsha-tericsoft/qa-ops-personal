const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function debugTags() {
  try {
    console.log('\n=== DEBUG: Tag Counts ===\n')

    // Get all projects
    const projects = await prisma.project.findMany({
      select: { id: true, name: true },
      take: 5,
    })

    if (projects.length === 0) {
      console.log('No projects found')
      return
    }

    for (const project of projects) {
      console.log(`\n📁 Project: ${project.name} (${project.id})`)

      // Get test case summary
      const testCaseCount = await prisma.roamTestCase.count({
        where: { projectId: project.id },
      })
      console.log(`  Total RoamTestCases: ${testCaseCount}`)

      // Get all test cases to examine their tags
      const testCases = await prisma.roamTestCase.findMany({
        where: { projectId: project.id },
        select: { id: true, title: true, tags: true },
        take: 10,
      })

      console.log(`\n  📊 Sample test cases (first 10):`)
      for (let i = 0; i < testCases.length; i++) {
        console.log(`    ${i + 1}. "${testCases[i].title.substring(0, 50)}"`)
        console.log(`       Tags: ${JSON.stringify(testCases[i].tags)}`)
      }

      // Count tags
      console.log(`\n  🏷️  Tag Distribution:`)
      const allTestCases = await prisma.roamTestCase.findMany({
        where: { projectId: project.id },
        select: { tags: true },
      })

      const tagCounts = {}
      for (const tc of allTestCases) {
        if (tc.tags && Array.isArray(tc.tags)) {
          for (const tag of tc.tags) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1
          }
        }
      }

      if (Object.keys(tagCounts).length === 0) {
        console.log('    ⚠️  No tags found!')
      } else {
        Object.entries(tagCounts)
          .sort(([, a], [, b]) => b - a)
          .forEach(([tag, count]) => {
            console.log(`    - ${tag}: ${count}`)
          })
      }

      // Check repository nodes
      const nodeCount = await prisma.repositoryNode.count({
        where: { projectId: project.id },
      })
      console.log(`\n  🗂️  RepositoryNodes: ${nodeCount}`)

      const nodesWithTags = await prisma.repositoryNode.findMany({
        where: { projectId: project.id, tags: { hasSome: ['Manual', 'Automated', 'HappyPath', 'Smoke', 'Regression'] } },
        select: { id: true, name: true, tags: true },
        take: 5,
      })

      if (nodesWithTags.length > 0) {
        console.log(`  Sample nodes with tags:`)
        for (const node of nodesWithTags) {
          console.log(`    - "${node.name.substring(0, 50)}" → ${JSON.stringify(node.tags)}`)
        }
      }
    }

    console.log('\n=== END DEBUG ===\n')
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugTags()
