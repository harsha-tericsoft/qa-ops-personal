const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

(async () => {
  try {
    const result = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count
      FROM "RoamTestCase" rtc
      JOIN "TestCase" tc ON tc.id = rtc.id
    `);

    console.log(result);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();