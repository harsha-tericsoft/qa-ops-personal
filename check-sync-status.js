const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const projectId = 'cmqorivor03id7kgcdbyrpt7c';

    // Check if nodes are being imported
    const nodeCount = await prisma.repositoryNode.count({
      where: { projectId }
    });

    const syncLogs = await prisma.syncLog.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 3
    });

    console.log(`Nodes in database: ${nodeCount}`);
    console.log(`\nRecent sync logs:`);
    syncLogs.forEach(log => {
      console.log(`  - ${log.action} (${log.status}): ${log.durationMs}ms`);
      if (log.error) console.log(`    Error: ${log.error.substring(0, 100)}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

check();
