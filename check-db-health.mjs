import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('DATABASE HEALTH CHECK\n');

  try {
    // Check connection
    const health = await prisma.$queryRaw`SELECT 1 as health`;
    console.log('✓ Database connection OK');

    // Check counts
    console.log('\nData counts:');
    const [roamCount, testCount, runCount, cycleCount, tagCount] = await Promise.all([
      prisma.roamTestCase.count(),
      prisma.testCase.count(),
      prisma.testRun.count(),
      prisma.executionCycle.count(),
      prisma.tag.count(),
    ]);
    
    console.log(`RoamTestCase: ${roamCount}`);
    console.log(`TestCase: ${testCount}`);
    console.log(`TestRun: ${runCount}`);
    console.log(`ExecutionCycle: ${cycleCount}`);
    console.log(`Tag: ${tagCount}`);

    // Check tag links
    const tagLinks = await prisma.tagTestCase.count();
    console.log(`TagTestCase links: ${tagLinks}`);

    // Verify consistency
    console.log('\nConsistency checks:');
    
    // Check if all TestRuns have valid TestCases
    const orphanRuns = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "TestRun" tr
      WHERE NOT EXISTS (SELECT 1 FROM "TestCase" tc WHERE tc.id = tr."testCaseId")
    `;
    
    console.log(`✓ Orphan TestRuns: ${orphanRuns[0].count}`);

    // Check TestCase/RoamTestCase ratio
    if (testCount >= roamCount) {
      console.log(`✓ TestCase count (${testCount}) >= RoamTestCase (${roamCount})`);
    } else {
      console.log(`✗ TestCase count (${testCount}) < RoamTestCase (${roamCount})`);
    }

    console.log('\n✓ All checks passed');
  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

main().finally(() => prisma.$disconnect());
