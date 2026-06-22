const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const projectId = 'cmqoreffq00047kgcwwqnkmzu';

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, createdAt: true }
    });

    console.log('SYNCED VERIFICATION PROJECT:');
    console.log(`ID:   ${project.id}`);
    console.log(`Name: ${project.name}`);
    console.log(`Created: ${project.createdAt.toISOString()}\n`);

    const repositoryNodeCount = await prisma.repositoryNode.count({
      where: { projectId }
    });

    const roamTestCaseCount = await prisma.roamTestCase.count({
      where: { projectId }
    });

    const testCaseCount = await prisma.testCase.count({
      where: { projectId }
    });

    const testSuiteCount = await prisma.testSuite.count({
      where: { projectId }
    });

    const executionCycleCount = await prisma.executionCycle.count({
      where: { projectId }
    });

    const testRunCount = await prisma.testRun.count({
      where: {
        cycle: {
          projectId
        }
      }
    });

    console.log('COUNTS:');
    console.log(`RepositoryNode count:  ${repositoryNodeCount}`);
    console.log(`RoamTestCase count:    ${roamTestCaseCount}`);
    console.log(`TestCase count:        ${testCaseCount}`);
    console.log(`TestSuite count:       ${testSuiteCount}`);
    console.log(`ExecutionCycle count:  ${executionCycleCount}`);
    console.log(`TestRun count:         ${testRunCount}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

check();
