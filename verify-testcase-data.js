const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  try {
    const projectId = 'cmqorivor03id7kgcdbyrpt7c';

    console.log('VERIFICATION: Test Case Titles in Execution Cycles\n');
    console.log('═'.repeat(70) + '\n');

    // Get execution cycle
    const cycle = await prisma.executionCycle.findFirst({
      where: { projectId },
      select: {
        id: true,
        name: true,
        testRuns: {
          select: {
            id: true,
            status: true,
            testCase: {
              select: {
                id: true,
                title: true
              }
            }
          },
          take: 10
        }
      }
    });

    if (!cycle) {
      console.log('❌ No execution cycle found');
      process.exit(1);
    }

    console.log('EXECUTION CYCLE:');
    console.log(`  Name: ${cycle.name}`);
    console.log(`  Test Runs: ${cycle.testRuns.length}\n`);

    console.log('FIRST 5 TEST RUNS:');
    console.log('─'.repeat(70));

    for (let i = 0; i < Math.min(5, cycle.testRuns.length); i++) {
      const run = cycle.testRuns[i];
      const title = run.testCase?.title;

      console.log(`\n${i + 1}. Test Run ID: ${run.id}`);
      console.log(`   Status: ${run.status}`);
      console.log(`   TestCase ID: ${run.testCase?.id || 'NULL'}`);
      console.log(`   Title: ${title || '(MISSING)'}`);

      if (!title) {
        console.log(`   ❌ FAILURE: Title is missing or undefined`);
      } else if (title === 'undefined') {
        console.log(`   ❌ FAILURE: Title is the string "undefined"`);
      } else {
        console.log(`   ✅ Title present`);
      }
    }

    console.log('\n' + '─'.repeat(70));
    console.log('\nDATABASE VERIFICATION:');
    console.log('─'.repeat(70));

    // SQL-equivalent query verification
    const sqlVerify = await prisma.$queryRaw`
      SELECT 
        ec.id as cycle_id,
        ec.name as cycle_name,
        COUNT(tr.id) as test_run_count,
        COUNT(CASE WHEN tc.title IS NOT NULL THEN 1 END) as runs_with_title,
        COUNT(CASE WHEN tc.title IS NULL THEN 1 END) as runs_without_title
      FROM ExecutionCycle ec
      LEFT JOIN TestRun tr ON ec.id = tr.cycleId
      LEFT JOIN TestCase tc ON tr.testCaseId = tc.id
      WHERE ec.projectId = ${projectId}
      GROUP BY ec.id, ec.name
    `;

    console.log('\nSQL Query Results:');
    sqlVerify.forEach(row => {
      console.log(`  Cycle: ${row.cycle_name}`);
      console.log(`  Total test runs: ${row.test_run_count}`);
      console.log(`  Runs with title: ${row.runs_with_title}`);
      console.log(`  Runs without title: ${row.runs_without_title}`);

      if (row.test_run_count === row.runs_with_title) {
        console.log(`  ✅ All test runs have titles`);
      } else {
        console.log(`  ❌ ${row.runs_without_title} test runs missing titles`);
      }
    });

    console.log('\n' + '═'.repeat(70));
    console.log('VERIFICATION COMPLETE\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
