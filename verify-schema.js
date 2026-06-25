const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verify() {
  try {
    // Get sample RoamTestCases
    const roamSample = await prisma.roamTestCase.findMany({
      take: 3,
      select: {
        id: true,
        title: true,
        repositoryNodeId: true,
        projectId: true,
        tags: true,
      }
    });

    console.log('=== Sample RoamTestCases ===');
    console.log(JSON.stringify(roamSample, null, 2));

    // Get sample TestCases
    const testCaseSample = await prisma.testCase.findMany({
      take: 3,
      select: {
        id: true,
        title: true,
        projectId: true,
      }
    });

    console.log('\n=== Sample TestCases ===');
    console.log(JSON.stringify(testCaseSample, null, 2));

    // Get counts
    const counts = await prisma.$queryRaw`
      SELECT 
        (SELECT COUNT(*) FROM "RoamTestCase") as roam_test_cases,
        (SELECT COUNT(*) FROM "TestCase") as test_cases,
        (SELECT COUNT(*) FROM "RepositoryNode") as repository_nodes,
        (SELECT COUNT(*) FROM "Tag") as tags,
        (SELECT COUNT(*) FROM "TagTestCase") as tag_test_cases,
        (SELECT COUNT(DISTINCT "projectId") FROM "RoamTestCase") as roam_projects,
        (SELECT COUNT(DISTINCT "projectId") FROM "TestCase") as test_case_projects
    `;

    console.log('\n=== Database Counts ===');
    console.log(JSON.stringify(counts, null, 2));

    // Check if RoamTestCase has valid repositoryNodeId mappings
    const nodeMapping = await prisma.$queryRaw`
      SELECT 
        rtc.id,
        rtc.title,
        rtc."repositoryNodeId",
        rn.name as node_name,
        rn.type as node_type
      FROM "RoamTestCase" rtc
      LEFT JOIN "RepositoryNode" rn ON rn.id = rtc."repositoryNodeId"
      LIMIT 3
    `;

    console.log('\n=== RoamTestCase → RepositoryNode Mapping ===');
    console.log(JSON.stringify(nodeMapping, null, 2));

    // Check TestCaseNode mappings
    const testCaseNodeMapping = await prisma.$queryRaw`
      SELECT 
        tc.id as test_case_id,
        tc.title,
        tcn."nodeId",
        rn.name as node_name
      FROM "TestCase" tc
      LEFT JOIN "TestCaseNode" tcn ON tcn."testCaseId" = tc.id
      LEFT JOIN "RepositoryNode" rn ON rn.id = tcn."nodeId"
      LIMIT 3
    `;

    console.log('\n=== TestCase → RepositoryNode Mapping ===');
    console.log(JSON.stringify(testCaseNodeMapping, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
