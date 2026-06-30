const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const repo = await prisma.repository.findUnique({
    where: { id: 'cmr0yox8y000f7ksgipi0z2ci' }
  })

  if (repo) {
    console.log(`Project ID for repository: ${repo.projectId}`)
  }

  await prisma.$disconnect()
}

main().catch(console.error)
