const { PrismaClient } = require('@prisma/client');

async function find() {
  const prisma = new PrismaClient();
  
  try {
    const projects = await prisma.project.findMany({
      include: {
        _count: {
          select: { testCases: true, roamTestCases: true, repositories: true },
        },
      },
    });
    
    console.log('Projects with data:\n');
    projects.forEach(p => {
      console.log(`Project: ${p.name} (${p.id.substring(0, 8)})`);
      console.log(`  TestCases: ${p._count.testCases}`);
      console.log(`  RoamTestCases: ${p._count.roamTestCases}`);
      console.log(`  Repositories: ${p._count.repositories}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

find();
