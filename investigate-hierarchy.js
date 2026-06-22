const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function investigate() {
  console.log('=== REPOSITORY HIERARCHY INVESTIGATION ===\n');

  try {
    // 1. Find the project
    console.log('1. Finding project "This is new Test project"...\n');
    const project = await prisma.project.findFirst({
      where: {
        name: {
          contains: 'new Test project',
          mode: 'insensitive'
        }
      }
    });

    if (!project) {
      console.log('❌ Project not found');
      const allProjects = await prisma.project.findMany({ select: { id: true, name: true } });
      console.log('Available projects:');
      allProjects.forEach(p => console.log(`  - ${p.name}`));
      process.exit(1);
    }

    console.log(`✅ Found project: ${project.name}`);
    console.log(`   Project ID: ${project.id}\n`);

    // 2. Get repository for this project
    console.log('2. Finding repository for this project...\n');
    const repository = await prisma.repository.findFirst({
      where: { projectId: project.id }
    });

    if (!repository) {
      console.log('❌ No repository found for this project');
      process.exit(1);
    }

    console.log(`✅ Found repository: ${repository.name}`);
    console.log(`   Repository ID: ${repository.id}\n`);

    // 3. Get RepositoryNode statistics
    console.log('3. Repository node statistics...\n');
    const nodeCount = await prisma.repositoryNode.count({
      where: { repositoryId: repository.id }
    });
    console.log(`   Total nodes: ${nodeCount}`);

    // Get root nodes (parentId = null)
    const rootNodes = await prisma.repositoryNode.findMany({
      where: { repositoryId: repository.id, parentId: null },
      select: { id: true, name: true, roamNodeId: true, depth: true }
    });
    console.log(`   Root nodes: ${rootNodes.length}`);
    rootNodes.forEach(n => console.log(`     - ${n.name} (depth: ${n.depth})`));
    console.log('');

    // 4. Get first level children
    console.log('4. First level children under root...\n');
    const firstLevel = await prisma.repositoryNode.findMany({
      where: {
        repositoryId: repository.id,
        parentId: rootNodes[0]?.id
      },
      select: { id: true, name: true, depth: true, type: true }
    });
    console.log(`   Count: ${firstLevel.length}`);
    firstLevel.slice(0, 10).forEach(n => console.log(`     - ${n.name} (type: ${n.type}, depth: ${n.depth})`));
    console.log('');

    // 5. Show 20 sample rows with requested columns
    console.log('5. Sample RepositoryNode rows (20 rows):\n');
    const sampleNodes = await prisma.repositoryNode.findMany({
      where: { repositoryId: repository.id },
      select: {
        id: true,
        name: true,
        depth: true,
        parentId: true,
        roamNodeId: true,
        type: true,
        path: true
      },
      take: 20
    });

    console.log('   ID | Name | Depth | ParentId | RoamNodeId | Type | Path');
    console.log('   ' + '='.repeat(120));
    sampleNodes.forEach(row => {
      const id = row.id.substring(0, 8);
      const parentId = row.parentId ? row.parentId.substring(0, 8) : 'null';
      const roamId = row.roamNodeId || 'null';
      const name = row.name.substring(0, 40).padEnd(40);
      const path = row.path ? row.path.substring(0, 60) : '(no path)';
      console.log(`   ${id} | ${name} | ${row.depth} | ${parentId} | ${roamId} | ${row.type} | ${path}`);
    });
    console.log('');

    // 6. Check hierarchy structure at different levels
    console.log('6. Hierarchy structure analysis:\n');

    // Get nodes by depth
    const nodesByDepth = {};
    const allNodes = await prisma.repositoryNode.findMany({
      where: { repositoryId: repository.id },
      select: { depth: true, name: true, parentId: true }
    });

    allNodes.forEach(n => {
      if (!nodesByDepth[n.depth]) nodesByDepth[n.depth] = 0;
      nodesByDepth[n.depth]++;
    });

    console.log('   Nodes by depth:');
    Object.keys(nodesByDepth).sort((a, b) => a - b).forEach(depth => {
      console.log(`     Depth ${depth}: ${nodesByDepth[depth]} nodes`);
    });
    console.log('');

    // 7. Look for TestType/API and TestType/Web_E2E
    console.log('7. Searching for "TestType" nodes...\n');
    const testTypeNodes = await prisma.repositoryNode.findMany({
      where: {
        repositoryId: repository.id,
        name: { contains: 'TestType', mode: 'insensitive' }
      },
      select: { id: true, name: true, depth: true, parentId: true, path: true }
    });
    console.log(`   Found ${testTypeNodes.length} nodes matching "TestType":`);
    testTypeNodes.forEach(n => {
      console.log(`     - ${n.name} (depth: ${n.depth})`);
      console.log(`       Path: ${n.path}`);
    });
    console.log('');

    // 8. Look for Login, Screen 1, Screen 2
    console.log('8. Searching for "Login" and "Screen" nodes...\n');
    const loginNodes = await prisma.repositoryNode.findMany({
      where: {
        repositoryId: repository.id,
        OR: [
          { name: { contains: 'Login', mode: 'insensitive' } },
          { name: { contains: 'Screen', mode: 'insensitive' } }
        ]
      },
      select: { id: true, name: true, depth: true, parentId: true, path: true }
    });
    console.log(`   Found ${loginNodes.length} nodes matching "Login" or "Screen":`);
    loginNodes.slice(0, 15).forEach(n => {
      console.log(`     - ${n.name} (depth: ${n.depth})`);
      console.log(`       Path: ${n.path}`);
    });
    console.log('');

    // 9. Analyze Test Case extraction
    console.log('9. Test case analysis...\n');
    const testCases = await prisma.roamTestCase.findMany({
      where: { repositoryId: repository.id },
      select: { id: true, title: true, uid: true, description: true },
      take: 10
    });
    console.log(`   Total test cases in DB: ${await prisma.roamTestCase.count({ where: { repositoryId: repository.id } })}`);
    console.log(`   Sample test cases:`);
    testCases.forEach(tc => {
      console.log(`     - ${tc.title ? tc.title.substring(0, 60) : '(no title)'}`);
    });
    console.log('');

    // 10. Check Roam config
    console.log('10. Roam configuration for this project...\n');
    const roamConfig = await prisma.roamConfig.findUnique({
      where: { projectId: project.id }
    });
    if (roamConfig) {
      console.log(`   Graph: ${roamConfig.graphName}`);
      console.log(`   Root page: ${roamConfig.repositoryRootPage}`);
      console.log(`   Test case page: ${roamConfig.testCaseRootPage || 'not set'}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

investigate();
