// Direct test of TestCaseExtractor on existing repository
const { PrismaClient } = require('@prisma/client')

// Import compiled TestCaseExtractor
const { TestCaseExtractor } = require('../lib/roam/test-case-extractor')

const prisma = new PrismaClient()

async function main() {
  try {
    // Get the repository with 3735 nodes
    const repo = await prisma.repository.findUnique({
      where: { id: 'cmr0yox8y000f7ksgipi0z2ci' }
    })

    if (!repo) {
      console.log('Repository not found')
      return
    }

    console.log(`\n=== TESTING EXTRACTION ON REPOSITORY ===`)
    console.log(`Repository: ${repo.name}`)
    console.log(`ID: ${repo.id}`)
    console.log(`Project ID: ${repo.projectId}`)

    // Call TestCaseExtractor
    console.log(`\n=== CALLING TestCaseExtractor.extractTestCases ===\n`)
    const result = await TestCaseExtractor.extractTestCases(repo.id, repo.projectId)

    console.log(`\n=== EXTRACTION RESULT ===`)
    console.log(`Created: ${result.created}`)
    console.log(`Updated: ${result.updated}`)
    console.log(`Skipped: ${result.skipped}`)
    console.log(`Errors: ${result.errors.length}`)
    if (result.errors.length > 0) {
      console.log(`Error details:`, result.errors)
    }

  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
