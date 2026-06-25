const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

(async () => {
  try {
    const roam = await prisma.roamTestCase.findMany({
      select: { title: true },
      take: 10
    });

    const tests = await prisma.testCase.findMany({
      select: { title: true },
      take: 10
    });

    console.log('\nROAM TEST CASES');
    console.table(roam);

    console.log('\nTEST CASES');
    console.table(tests);
  } finally {
    await prisma.$disconnect();
  }
})();