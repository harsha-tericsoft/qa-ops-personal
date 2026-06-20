const { PrismaClient } = require('@prisma/client');

async function trace() {
  const prisma = new PrismaClient();
  
  try {
    // Get the last 3 created suites
    const suites = await prisma.testSuite.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: {
        testCases: {
          select: { testCaseId: true }
        }
      }
    });
    
    console.log('Last 3 created suites:');
    suites.forEach(s => {
      console.log(`
Suite: ${s.name}
ID: ${s.id}
Created: ${s.createdAt}
Test Case Count: ${s.testCases.length}
Selected Method: ${s.selectionMethod}
`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

trace();
