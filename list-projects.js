const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function list() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      select: { 
        id: true, 
        name: true, 
        createdAt: true,
        _count: { select: { repositories: true } }
      }
    });

    console.log('ALL PROJECTS:');
    for (const p of projects) {
      const nodeCount = await prisma.repositoryNode.count({
        where: { projectId: p.id }
      });
      console.log(`  ${p.name}`);
      console.log(`    ID: ${p.id}`);
      console.log(`    Nodes: ${nodeCount}`);
      console.log(`    Created: ${p.createdAt.toISOString()}\n`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

list();
