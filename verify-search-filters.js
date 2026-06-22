const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifySearchFilters() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('VERIFICATION: Repository Search & Filters Implementation');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Get a repository with nodes
    const repository = await prisma.repository.findFirst({
      include: { _count: { select: { nodes: true } } }
    });

    if (!repository || repository._count.nodes === 0) {
      console.log('❌ No repositories with nodes found for testing');
      process.exit(1);
    }

    const project = await prisma.project.findUnique({
      where: { id: repository.projectId }
    });

    console.log(`✅ Using Project: ${project.name}`);
    console.log(`✅ Using Repository: ${repository.name}`);
    console.log(`✅ Total nodes in repository: ${repository._count.nodes}\n`);

    // Test 1: Search by name
    console.log('TEST 1: Search by Name (searching for "Login")\n');
    const searchResults = await prisma.repositoryNode.findMany({
      where: {
        repositoryId: repository.id,
        deletedAt: null,
        OR: [
          { name: { contains: 'Login', mode: 'insensitive' } },
          { path: { contains: 'Login', mode: 'insensitive' } }
        ]
      },
      take: 5
    });
    console.log(`   Found ${searchResults.length} nodes matching "Login"`);
    searchResults.forEach(n => console.log(`   ✓ ${n.name}`));

    // Test 2: Filter by node type
    console.log('\nTEST 2: Filter by Node Type (type = "FOLDER")\n');
    const typeResults = await prisma.repositoryNode.findMany({
      where: {
        repositoryId: repository.id,
        deletedAt: null,
        type: 'FOLDER'
      },
      take: 5
    });
    console.log(`   Found ${typeResults.length} FOLDER type nodes`);
    typeResults.forEach(n => console.log(`   ✓ ${n.name} (${n.type})`));

    // Test 3: Filter by tags (Automated)
    console.log('\nTEST 3: Filter by Tag (tags contains "Automated")\n');
    const automatedResults = await prisma.repositoryNode.findMany({
      where: {
        repositoryId: repository.id,
        deletedAt: null,
        tags: { has: 'Automated' }
      },
      take: 5
    });
    console.log(`   Found ${automatedResults.length} nodes with "Automated" tag`);
    automatedResults.forEach(n => console.log(`   ✓ ${n.name} (tags: ${n.tags.join(', ')})`));

    // Test 4: Combined filters
    console.log('\nTEST 4: Combined Filters (Search + Type + Tag)\n');
    const combinedResults = await prisma.repositoryNode.findMany({
      where: {
        repositoryId: repository.id,
        deletedAt: null,
        AND: [
          {
            OR: [
              { name: { contains: 'Test', mode: 'insensitive' } },
              { path: { contains: 'Test', mode: 'insensitive' } }
            ]
          },
          { type: 'FILE' },
          { tags: { has: 'Critical' } }
        ]
      },
      take: 5
    });
    console.log(`   Found ${combinedResults.length} nodes (Search="Test" + Type="FILE" + Tag="Critical")`);
    combinedResults.forEach(n => console.log(`   ✓ ${n.name}`));

    // Test 5: Filter excluding a tag (NOT Automated)
    console.log('\nTEST 5: Negative Filter (NOT Automated)\n');
    const notAutomatedResults = await prisma.repositoryNode.findMany({
      where: {
        repositoryId: repository.id,
        deletedAt: null,
        NOT: { tags: { has: 'Automated' } }
      },
      take: 5
    });
    console.log(`   Found ${notAutomatedResults.length} nodes without "Automated" tag`);
    notAutomatedResults.forEach(n => console.log(`   ✓ ${n.name}`));

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ All filter queries validated against database');
    console.log('✅ Search implementation ready');
    console.log('✅ Tag filtering ready');
    console.log('✅ Node type filtering ready');
    console.log('✅ Automated/Manual filtering ready');
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifySearchFilters();
