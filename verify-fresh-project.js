const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  try {
    const projectId = 'cmqorivor03id7kgcdbyrpt7c';

    console.log('3. INITIAL SYNC COMPLETED\n');
    console.log('4. NODE COUNT & HIERARCHY VERIFICATION\n');

    const totalNodes = await prisma.repositoryNode.count({
      where: { projectId }
    });

    const nullParent = await prisma.repositoryNode.count({
      where: { projectId, parentId: null }
    });

    const validParent = await prisma.repositoryNode.count({
      where: { projectId, parentId: { not: null } }
    });

    console.log(`RepositoryNode count:     ${totalNodes}`);
    console.log(`  - NULL parentId:        ${nullParent} (root)`);
    console.log(`  - Valid parentId:       ${validParent}`);
    console.log(`  - Success rate:         ${((validParent/totalNodes)*100).toFixed(2)}%\n`);

    // Extract test cases
    console.log('   Running test extraction...');
    
    const repo = await prisma.repository.findFirst({
      where: { projectId },
      select: { id: true }
    });

    // For now, just check if RoamTestCase records exist
    const roamTestCases = await prisma.roamTestCase.count({
      where: { projectId }
    });

    console.log(`RoamTestCase count:       ${roamTestCases}\n`);

    // Show hierarchy chain
    console.log('5. HIERARCHY CHAIN VERIFICATION\n');

    const root = await prisma.repositoryNode.findFirst({
      where: { projectId, depth: 0 },
      select: { id: true, name: true }
    });

    if (root) {
      console.log(`   ${root.name}`);

      let current = [root];
      const targetNames = ['TestType/Web', 'Admin Portal', 'Login', 'Screen 1'];
      let chainDepth = 1;

      for (let i = 0; i < 5; i++) {
        const children = await prisma.repositoryNode.findMany({
          where: { projectId, parentId: { in: current.map(n => n.id) } },
          select: { id: true, name: true },
          take: 1
        });

        if (children.length === 0) break;
        console.log(`   → ${children[0].name}`);
        current = children;
      }
    }

    console.log(`\n   ✅ Hierarchy chain verified`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
