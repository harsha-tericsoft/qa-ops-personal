const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const freshProjectId = 'cmqorivor03id7kgcdbyrpt7c';

    const repo = await prisma.repository.findFirst({
      where: { projectId: freshProjectId },
      select: { 
        id: true, 
        name: true, 
        lastSyncStatus: true,
        _count: { select: { nodes: true } }
      }
    });

    if (repo) {
      console.log(`Repository for fresh project:`);
      console.log(`  ID: ${repo.id}`);
      console.log(`  Name: ${repo.name}`);
      console.log(`  Nodes: ${repo._count.nodes}`);
      console.log(`  Last Sync: ${repo.lastSyncStatus}`);
    } else {
      console.log('No repository found for fresh project');
    }

    // Also check the synced project
    const syncedProjectId = 'cmqoreffq00047kgcwwqnkmzu';
    const syncedRepo = await prisma.repository.findFirst({
      where: { projectId: syncedProjectId },
      select: { 
        id: true, 
        name: true, 
        _count: { select: { nodes: true } }
      }
    });

    console.log(`\nRepository for synced project:`);
    console.log(`  ID: ${syncedRepo.id}`);
    console.log(`  Name: ${syncedRepo.name}`);
    console.log(`  Nodes: ${syncedRepo._count.nodes}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

check();
