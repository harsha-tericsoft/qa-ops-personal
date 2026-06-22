const { PrismaClient } = require('@prisma/client');

async function verifyPool() {
  const prisma = new PrismaClient({
    log: ['error']
  });

  try {
    console.log('  Testing multiple rapid database queries...');
    
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      const count = await prisma.project.count();
      const duration = Date.now() - start;
      console.log(`    Query ${i + 1}: ${duration}ms ✅`);
    }
    
    console.log('\n✅ All queries successful - No pool exhaustion');
    console.log('   Connection pool is healthy\n');
  } catch (error) {
    if (error.message.includes('pool') || error.message.includes('timeout')) {
      console.log(`\n❌ CONNECTION POOL ERROR: ${error.message}\n`);
    } else {
      console.log(`\n❌ Error: ${error.message}\n`);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyPool();
