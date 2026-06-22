const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    // Most recently created verification project
    const recentProject = await prisma.project.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, createdAt: true }
    });

    console.log('NEWLY CREATED VERIFICATION PROJECT:');
    console.log(`ID:   ${recentProject.id}`);
    console.log(`Name: ${recentProject.name}`);
    console.log(`Created: ${recentProject.createdAt.toISOString()}\n`);

    // Get counts for this project
    const repositoryNodeCount = await prisma.repositoryNode.count({
      where: { projectId: recentProject.id }
    });

    const testCaseCount = await prisma.testCase.count({
      where: { projectId: recentProject.id }
    });

    const testSuiteCount = await prisma.testSuite.count({
      where: { projectId: recentProject.id }
    });

    const executionCycleCount = await prisma.executionCycle.count({
      where: { projectId: recentProject.id }
    });

    const testRunCount = await prisma.testRun.count({
      where: {
        cycle: {
          projectId: recentProject.id
        }
      }
    });

    // Check if RoamTestCase model exists
    let roamTestCaseCount = null;
    try {
      roamTestCaseCount = await prisma.roamTestCase.count({
        where: { projectId: recentProject.id }
      });
    } catch (e) {
      roamTestCaseCount = 'Model does not exist';
    }

    console.log('COUNTS:');
    console.log(`RepositoryNode count:  ${repositoryNodeCount}`);
    console.log(`RoamTestCase count:    ${roamTestCaseCount}`);
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
