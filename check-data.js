const { PrismaClient } = require('@prisma/client');

async function check() {
  const prisma = new PrismaClient();
  
  try {
    const project = await prisma.project.findFirst();
    console.log('Project ID:', project.id);
    
    // Check RoamTestCase
    const roamCount = await prisma.roamTestCase.count({
      where: { projectId: project.id },
    });
    console.log('RoamTestCase count:', roamCount);
    
    // Check TestCase
    const testCaseCount = await prisma.testCase.count({
      where: { projectId: project.id },
    });
    console.log('TestCase count:', testCaseCount);
    
    // Get actual test cases
    const testCases = await prisma.roamTestCase.findMany({
      where: { projectId: project.id },
      take: 3,
      include: { repositoryNode: { select: { name: true } } },
    });
    
    console.log('\nFirst 3 RoamTestCases:');
    testCases.forEach(tc => {
      console.log(`  ID: ${tc.id.substring(0, 8)}... Title: ${tc.title.substring(0, 50)}`);
    });
    
    // Check repository structure
    const repo = await prisma.repository.findFirst({
      where: { projectId: project.id },
    });
    
    const rootNodes = await prisma.repositoryNode.findMany({
      where: { repositoryId: repo?.id, parentId: null },
      take: 3,
    });
    
    console.log('\nRoot repository nodes:');
    rootNodes.forEach(n => {
      console.log(`  ${n.name.substring(0, 60)}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
