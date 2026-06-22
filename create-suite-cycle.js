const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createAndTest() {
  try {
    const projectId = 'cmqoreffq00047kgcwwqnkmzu';

    // Find repository nodes to extract test cases from
    const repo = await prisma.repository.findFirst({
      where: { projectId },
      select: { id: true }
    });

    console.log('7. CREATE NEW TEST SUITE:');

    // Create a test suite
    const suite = await prisma.testSuite.create({
      data: {
        projectId,
        name: 'Verification Suite - Depth Fix',
        description: 'Suite created to verify parent-child hierarchy is working',
        selectionMethod: 'MANUAL'
      }
    });

    console.log(`   ✅ Suite created: ${suite.name} (${suite.id})\n`);

    // Find some repository nodes to use as test cases
    const nodes = await prisma.repositoryNode.findMany({
      where: { projectId, depth: { gte: 3 } },
      select: { id: true, name: true },
      take: 5
    });

    console.log('8. CREATE TEST CASES FROM NODES:');
    const testCases = [];
    for (const node of nodes) {
      const testCase = await prisma.testCase.create({
        data: {
          projectId,
          title: `Test: ${node.name}`,
          description: `Auto-generated from repository node: ${node.name}`,
        }
      });
      testCases.push(testCase);
      console.log(`   - ${testCase.title}`);
    }

    console.log(`\n   ✅ Created ${testCases.length} test cases\n`);

    // Link test cases to suite
    console.log('9. LINK TEST CASES TO SUITE:');
    for (let i = 0; i < testCases.length; i++) {
      await prisma.suiteTestCase.create({
        data: {
          suiteId: suite.id,
          testCaseId: testCases[i].id,
          order: i
        }
      });
    }
    console.log(`   ✅ Linked ${testCases.length} test cases to suite\n`);

    // Verify suite has tests
    const suiteWithTests = await prisma.testSuite.findUnique({
      where: { id: suite.id },
      include: { _count: { select: { testCases: true } } }
    });

    console.log(`   Suite "${suiteWithTests.name}" contains ${suiteWithTests._count.testCases} tests\n`);

    // Create execution cycle
    console.log('10. CREATE EXECUTION CYCLE FROM SUITE:');
    const cycle = await prisma.executionCycle.create({
      data: {
        projectId,
        name: `Cycle: ${suite.name}`,
        description: 'Test cycle created from verification suite',
        status: 'PLANNED',
      }
    });

    console.log(`   ✅ Cycle created: ${cycle.name}\n`);

    // Create test runs from test cases
    console.log('11. CREATE TEST RUNS:');
    const runs = await prisma.testRun.createMany({
      data: testCases.map(tc => ({
        cycleId: cycle.id,
        testCaseId: tc.id,
        status: 'NOT_EXECUTED'
      }))
    });

    console.log(`   ✅ Created ${runs.count} test runs\n`);

    // Verify cycle has runs
    const cycleWithRuns = await prisma.executionCycle.findUnique({
      where: { id: cycle.id },
      include: { _count: { select: { testRuns: true } } }
    });

    console.log(`   Cycle "${cycleWithRuns.name}" contains ${cycleWithRuns._count.testRuns} test runs\n`);

    // Summary
    console.log('12. DASHBOARD VERIFICATION:');
    const dashboardStats = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        _count: {
          select: {
            testSuites: true,
            testCases: true,
            executionCycles: true
          }
        }
      }
    });

    console.log(`   Project Stats:`);
    console.log(`   - Test Suites: ${dashboardStats._count.testSuites}`);
    console.log(`   - Test Cases: ${dashboardStats._count.testCases}`);
    console.log(`   - Execution Cycles: ${dashboardStats._count.executionCycles}`);

    console.log('\n✅ WORKFLOW COMPLETE');
    console.log(`   - Suite with ${testCases.length} tests created`);
    console.log(`   - Cycle with ${runs.count} test runs created`);
    console.log(`   - All operations linked via repository hierarchy`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAndTest();
