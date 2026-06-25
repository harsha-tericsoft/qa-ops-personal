import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking database counts...\n');

  const counts = {
    roamTestCase: await prisma.roamTestCase.count(),
    testCase: await prisma.testCase.count(),
    testRun: await prisma.testRun.count(),
    executionCycle: await prisma.executionCycle.count(),
    testSuite: await prisma.testSuite.count(),
    project: await prisma.project.count(),
  };

  console.log('Model Counts:');
  console.table(counts);

  // Check for projects with mismatched counts
  const projects = await prisma.project.findMany({
    select: { id: true, name: true }
  });

  console.log('\nCounts by Project:');
  for (const project of projects) {
    const [roam, testCase, runs, cycles, suites] = await Promise.all([
      prisma.roamTestCase.count({ where: { projectId: project.id } }),
      prisma.testCase.count({ where: { projectId: project.id } }),
      prisma.testRun.count({ where: { cycle: { projectId: project.id } } }),
      prisma.executionCycle.count({ where: { projectId: project.id } }),
      prisma.testSuite.count({ where: { projectId: project.id } }),
    ]);

    console.log(`\n${project.name}:`);
    console.log(`  RoamTestCase: ${roam}`);
    console.log(`  TestCase: ${testCase}`);
    console.log(`  TestRun: ${runs}`);
    console.log(`  ExecutionCycle: ${cycles}`);
    console.log(`  TestSuite: ${suites}`);

    if (roam !== testCase) {
      console.log(`  ⚠️  MISMATCH: RoamTestCase (${roam}) != TestCase (${testCase})`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
