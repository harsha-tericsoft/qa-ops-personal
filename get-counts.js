const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getCounts() {
  try {
    const projectId = 'cmqoreffq00047kgcwwqnkmzu';

    // Find Login node
    const login = await prisma.repositoryNode.findFirst({
      where: {
        projectId,
        name: { contains: 'Login' }
      },
      select: { id: true, name: true }
    });

    console.log('6. TEST COUNTS:');
    if (login) {
      console.log(`   Under Login:`);
      const loginChildren = await prisma.repositoryNode.count({
        where: { projectId, parentId: login.id }
      });
      console.log(`   - Direct children: ${loginChildren}`);

      // Find Screen 1 under Login
      const screen1 = await prisma.repositoryNode.findFirst({
        where: {
          projectId,
          parentId: login.id,
          name: { contains: 'Screen' }
        },
        select: { id: true, name: true }
      });

      if (screen1) {
        console.log(`\n   Under Screen 1:`);
        const screen1Children = await prisma.repositoryNode.count({
          where: { projectId, parentId: screen1.id }
        });
        console.log(`   - Direct children: ${screen1Children}`);
      }
    }

    // Get total test cases
    const testSuites = await prisma.testSuite.count({
      where: { projectId }
    });
    console.log(`\n   Total Test Suites: ${testSuites}`);

    const testCases = await prisma.testCase.count({
      where: { projectId }
    });
    console.log(`   Total Test Cases: ${testCases}`);

    const executionCycles = await prisma.executionCycle.count({
      where: { projectId }
    });
    console.log(`   Total Execution Cycles: ${executionCycles}`);

    // Skip test runs - don't have projectId directly
    console.log(`   Total Test Runs: (query after creating cycles)`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

getCounts();
