const { PrismaClient } = require('@prisma/client');

async function check() {
  const prisma = new PrismaClient();
  
  try {
    // Find all Kinergy projects
    const kinergy = await prisma.project.findMany({
      where: { name: { contains: 'Kinergy' } },
      include: {
        _count: { select: { roamTestCases: true, repositories: true } }
      }
    });
    
    console.log('Kinergy Projects:');
    kinergy.forEach(p => {
      console.log(`  ID: ${p.id}`);
      console.log(`  Name: ${p.name}`);
      console.log(`  RoamTestCases: ${p._count.roamTestCases}`);
      console.log(`  Repositories: ${p._count.repositories}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
