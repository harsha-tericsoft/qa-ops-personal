const { PrismaClient } = require('@prisma/client');

async function setup() {
  const prisma = new PrismaClient();
  
  try {
    // Create or get test user
    const user = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {},
      create: {
        email: 'test@example.com',
        password: 'hashed_password',
        name: 'Test User',
        role: 'LEAD',
      },
    });
    
    console.log('Test user:', user.id, user.email, user.role);
    
    // Get a project
    const project = await prisma.project.findFirst();
    console.log('Project:', project?.id, project?.name);
    
    // Get repository structure
    const repo = await prisma.repository.findFirst({
      where: { projectId: project?.id },
      include: {
        nodes: {
          where: { parentId: null }, // Root nodes only
          take: 5,
        },
      },
    });
    
    console.log('Repository nodes:');
    if (repo?.nodes) {
      repo.nodes.forEach(n => {
        console.log(`  - ${n.name} (id: ${n.id.substring(0, 8)}...)`);
      });
    }
    
    // Get test cases
    const testCases = await prisma.testCase.findMany({
      where: { projectId: project?.id },
      take: 5,
    });
    
    console.log(`\nTest cases available: ${testCases.length}`);
    testCases.slice(0, 3).forEach(tc => {
      console.log(`  - ${tc.title.substring(0, 50)}...`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

setup();
