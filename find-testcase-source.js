const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function investigate() {
  try {
    // Get all TestCases with their details
    const testCases = await prisma.testCase.findMany({
      select: {
        id: true,
        title: true,
        projectId: true,
        createdAt: true,
        suites: { select: { suiteId: true } },
        testRuns: { select: { id: true } }
      }
    });

    console.log(`=== All ${testCases.length} TestCases ===`);
    
    // Group by creation date to see if they were batch created
    const byDate = {};
    testCases.forEach(tc => {
      const date = tc.createdAt.toISOString().split('T')[0];
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(tc);
    });

    console.log('\n=== TestCases Grouped by Creation Date ===');
    Object.entries(byDate).forEach(([date, cases]) => {
      console.log(`${date}: ${cases.length} records`);
    });

    // Show unique titles to understand the pattern
    console.log('\n=== Unique Titles ===');
    const uniqueTitles = [...new Set(testCases.map(tc => tc.title))];
    uniqueTitles.slice(0, 10).forEach(title => {
      const count = testCases.filter(tc => tc.title === title).length;
      console.log(`"${title}" (${count})`);
    });

    // Check if any are linked to suites or runs
    const linked = testCases.filter(tc => tc.suites.length > 0 || tc.testRuns.length > 0);
    console.log(`\n=== Usage ===`);
    console.log(`TestCases in suites: ${testCases.filter(tc => tc.suites.length > 0).length}`);
    console.log(`TestCases with runs: ${testCases.filter(tc => tc.testRuns.length > 0).length}`);
    console.log(`Unused TestCases: ${testCases.filter(tc => tc.suites.length === 0 && tc.testRuns.length === 0).length}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

investigate();
