const { PrismaClient } = require('@prisma/client');

async function inspect() {
  const prisma = new PrismaClient();

  try {
    const projectId = 'cmqkqw7ap03fy7k8kqwwjn0dk';

    // Get repository structure
    const repo = await prisma.repository.findFirst({
      where: { projectId },
      include: {
        nodes: {
          select: {
            id: true,
            name: true,
            parentId: true,
            path: true,
            type: true,
            depth: true
          },
          orderBy: { depth: 'asc' }
        }
      }
    });

    console.log('Repository: ' + repo.name);
    console.log('Total nodes: ' + repo.nodes.length + '\n');

    // Show hierarchy
    console.log('Hierarchy structure:\n');
    const nodeMap = {};
    repo.nodes.forEach(n => {
      nodeMap[n.id] = n;
      const indent = '  '.repeat(n.depth || 0);
      console.log(indent + '├─ ' + n.name + ' (id: ' + n.id.substring(0, 8) + '...)');
    });

    // Count test cases for each node
    console.log('\n\nTest case counts by node:');
    const topNodes = repo.nodes.filter(n => !n.parentId);

    for (const node of topNodes.slice(0, 5)) {
      const count = await prisma.roamTestCase.count({
        where: { projectId }
      });
      console.log('  ' + node.name + ': (would need recursive count)');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

inspect();
