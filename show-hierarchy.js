const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function showHierarchy() {
  try {
    const projectId = 'cmqoreffq00047kgcwwqnkmzu';

    console.log('1. NODE STATISTICS:');
    const totalNodes = await prisma.repositoryNode.count({
      where: { projectId }
    });
    const nullParent = await prisma.repositoryNode.count({
      where: { projectId, parentId: null }
    });
    const notNullParent = await prisma.repositoryNode.count({
      where: { projectId, parentId: { not: null } }
    });

    console.log(`   Total nodes: ${totalNodes}`);
    console.log(`   parentId IS NULL: ${nullParent}`);
    console.log(`   parentId IS NOT NULL: ${notNullParent}\n`);

    // Get root
    const root = await prisma.repositoryNode.findFirst({
      where: { projectId, parentId: null },
      select: { id: true, name: true }
    });

    console.log('2. HIERARCHY CHAIN FROM ROOT:');
    console.log(`   ${root.name}`);

    // Build down 6 levels
    let currentNodes = [root];
    for (let level = 1; level < 7; level++) {
      const children = await prisma.repositoryNode.findMany({
        where: {
          projectId,
          parentId: { in: currentNodes.map(n => n.id) }
        },
        select: { id: true, name: true },
        take: 1
      });

      if (children.length === 0) break;

      children.forEach(child => {
        console.log(`   → ${child.name}`);
      });

      currentNodes = children;
    }

    console.log();
    console.log(`PROJECT_ID=${projectId}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

showHierarchy();
