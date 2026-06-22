const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const projectId = 'cmqoreffq00047kgcwwqnkmzu';

    // Check repositories
    const repo = await prisma.repository.findFirst({
      where: { projectId },
      select: { id: true, name: true, totalTestCount: true }
    });

    console.log('Repository:');
    console.log(`  Name: ${repo.name}`);
    console.log(`  Total Test Count (metadata): ${repo.totalTestCount}`);

    // Check if test cases were extracted
    const testCases = await prisma.testCase.findMany({
      where: { projectId },
      select: { id: true, title: true },
      take: 5
    });

    console.log(`\nTest Cases found: ${testCases.length}`);
    testCases.forEach(tc => {
      console.log(`  - ${tc.title}`);
    });

    // Check test suites
    const suites = await prisma.testSuite.findMany({
      where: { projectId },
      select: { id: true, name: true },
      take: 5
    });

    console.log(`\nTest Suites found: ${suites.length}`);
    suites.forEach(s => {
      console.log(`  - ${s.name}`);
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
