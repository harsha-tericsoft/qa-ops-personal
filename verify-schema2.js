const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  try {
    // Get counts with proper casting
    const counts = await prisma.$queryRaw`
      SELECT 
        CAST(COUNT(*) AS INTEGER) as roam_test_cases
      FROM "RoamTestCase"
    `;
    
    const testCaseCounts = await prisma.$queryRaw`
      SELECT CAST(COUNT(*) AS INTEGER) as test_cases FROM "TestCase"
    `;
    
    const tagCounts = await prisma.$queryRaw`
      SELECT CAST(COUNT(*) AS INTEGER) as tags FROM "Tag"
    `;
    
    const tagTestCaseCounts = await prisma.$queryRaw`
      SELECT CAST(COUNT(*) AS INTEGER) as tag_test_cases FROM "TagTestCase"
    `;

    console.log('=== Database Counts ===');
    console.log('RoamTestCases:', counts[0].roam_test_cases);
    console.log('TestCases:', testCaseCounts[0].test_cases);
    console.log('Tags:', tagCounts[0].tags);
    console.log('TagTestCases:', tagTestCaseCounts[0].tag_test_cases);

    // Check if any TestCase has a direct link to RepositoryNode
    const tcWithNodes = await prisma.$queryRaw`
      SELECT 
        tc.id,
        tc.title,
        COUNT(tcn."nodeId") as node_count
      FROM "TestCase" tc
      LEFT JOIN "TestCaseNode" tcn ON tcn."testCaseId" = tc.id
      GROUP BY tc.id
      LIMIT 5
    `;

    console.log('\n=== TestCase → RepositoryNode Links ===');
    console.log(JSON.stringify(tcWithNodes, null, 2));

    // Check RepositoryNode -> RoamTestCase links
    const rnWithRoam = await prisma.$queryRaw`
      SELECT 
        rn.id,
        rn.name,
        rn.type,
        rtc.id as roam_test_case_id,
        rtc.title as roam_title
      FROM "RepositoryNode" rn
      LEFT JOIN "RoamTestCase" rtc ON rtc."repositoryNodeId" = rn.id
      WHERE rn."deletedAt" IS NULL
      LIMIT 5
    `;

    console.log('\n=== RepositoryNode → RoamTestCase Links ===');
    console.log(JSON.stringify(rnWithRoam, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
