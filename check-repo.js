const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const projectId = 'cmqoreffq00047kgcwwqnkmzu';

    const repo = await prisma.repository.findFirst({
      where: { projectId },
      select: { id: true, name: true, lastSyncStatus: true, _count: { select: { nodes: true } } }
    });

    console.log('Repository Info:');
    console.log(`  ID: ${repo.id}`);
    console.log(`  Name: ${repo.name}`);
    console.log(`  Sync Status: ${repo.lastSyncStatus}`);
    console.log(`  Nodes: ${repo._count.nodes}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

check();
