const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

(async () => {
  try {
    const result = await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connected');
    console.log(result);
  } catch (e) {
    console.log('❌ Connection failed');
    console.log(e.message);
  } finally {
    await prisma.$disconnect();
  }
})();