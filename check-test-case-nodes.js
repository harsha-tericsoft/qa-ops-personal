const { PrismaClient } = require('@prisma/client');

async function check() {
  const prisma = new PrismaClient();
  
  try {
    const projectId = '79d857b2-36dd-4810-88ae-3ca8d9aaa8d4';  // Kinergy test
    
    // Count test cases with repositoryNodeId
    const withNodeId = await prisma.roamTestCase.count({
      where: { projectId }
    });
    
    const total = await prisma.roamTestCase.count({
      where: { projectId }
    });
    
    console.log('RoamTestCase breakdown:');
    console.log(`  Total test cases: ${total}`);
    
    // Sample a few test cases
    const samples = await prisma.roamTestCase.findMany({
      where: { projectId },
      select: { id: true, title: true, repositoryNodeId: true },
      take: 10
    });
    
    console.log('\nSample test cases:');
    samples.forEach(tc => {
      console.log(`  ${tc.title.substring(0, 50)}...`);
      console.log(`    NodeID: ${tc.repositoryNodeId || 'NULL'}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
