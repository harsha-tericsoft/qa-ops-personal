const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

(async () => {
  try {
    const result = await prisma.$queryRawUnsafe(`
      SELECT
        rtc.id as roam_test_case_id,
        rtc."repositoryNodeId",
        tcn."testCaseId",
        tc.title
      FROM "RoamTestCase" rtc
      LEFT JOIN "TestCaseNode" tcn
        ON tcn."nodeId" = rtc."repositoryNodeId"
      LEFT JOIN "TestCase" tc
        ON tc.id = tcn."testCaseId"
      LIMIT 20
    `);

    console.table(result);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();