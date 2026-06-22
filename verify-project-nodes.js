const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  try {
    const freshProjectId = 'cmqorivor03id7kgcdbyrpt7c';

    const nodeCount = await prisma.repositoryNode.count({
      where: { projectId: freshProjectId }
    });

    console.log(`Fresh project (cmqorivor03id7kgcdbyrpt7c):`);
    console.log(`  RepositoryNode count: ${nodeCount}`);

    if (nodeCount > 0) {
      const sampleNode = await prisma.repositoryNode.findFirst({
        where: { projectId: freshProjectId },
        select: { name: true, projectId: true }
      });
      console.log(`  Sample: ${sampleNode.name}`);
    }

    const syncLogs = await prisma.syncLog.findMany({
      where: { projectId: freshProjectId },
      select: { action: true, status: true, error: true }
    });

    console.log(`  Sync logs: ${syncLogs.length}`);
    syncLogs.forEach(log => {
      console.log(`    - ${log.action}: ${log.status}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
