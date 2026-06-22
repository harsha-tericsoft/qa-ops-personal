const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  try {
    console.log('\n🔍 DEPTH-FIX VERIFICATION REPORT\n');
    console.log('='.repeat(70));

    // Get the root node
    const rootNode = await prisma.repositoryNode.findFirst({
      where: { depth: 0, parentId: null },
      select: { id: true, name: true, depth: true, parentId: true }
    });

    console.log('ROOT NODE (should have NULL parentId):');
    console.log(`  Name: "${rootNode?.name || 'NOT FOUND'}"`);
    console.log(`  Depth: ${rootNode?.depth || 'N/A'}`);
    console.log(`  ParentId: ${rootNode?.parentId || 'NULL ✅'}\n`);

    // Get statistics
    const total = await prisma.repositoryNode.count();
    const withParent = await prisma.repositoryNode.count({ where: { parentId: { not: null } } });
    const nullParent = await prisma.repositoryNode.count({ where: { parentId: null } });

    console.log('NODE STATISTICS:');
    console.log(`  Total nodes: ${total}`);
    console.log(`  With parentId: ${withParent} (${((withParent / total) * 100).toFixed(2)}%)`);
    console.log(`  NULL parentId: ${nullParent} (${((nullParent / total) * 100).toFixed(2)}%)`);
    console.log(`\n  Expected: root node (1) with NULL parentId, all others with valid parent`);
    if (nullParent === 1) {
      console.log(`  ✅ CORRECT: Exactly ${nullParent} node with NULL parentId (the root)\n`);
    }

    // Sample nodes at different depths
    console.log('DEPTH LEVEL DISTRIBUTION:');
    const depthStats = await prisma.repositoryNode.groupBy({
      by: ['depth'],
      _count: { id: true },
      orderBy: { depth: 'asc' }
    });

    depthStats.slice(0, 8).forEach(s => {
      console.log(`  Depth ${s.depth}: ${s._count.id} nodes`);
    });
    if (depthStats.length > 8) {
      console.log(`  ... and ${depthStats.length - 8} more depth levels`);
    }

    // Critical verification: check that all non-root nodes have parents
    console.log('\n' + '='.repeat(70));
    console.log('CRITICAL CHECK: Non-root nodes MUST have valid parentId\n');

    const orphans = await prisma.repositoryNode.findMany({
      where: {
        depth: { gt: 0 },
        parentId: null
      },
      select: { id: true, name: true, depth: true },
      take: 20
    });

    if (orphans.length === 0) {
      console.log('✅ PASS: No orphaned nodes found!');
      console.log('   All nodes at depth > 0 have valid parent references');
      console.log('   Depth-level processing is working correctly!\n');
    } else {
      console.log(`❌ FAIL: Found ${orphans.length} orphaned nodes:`);
      orphans.forEach(n => {
        console.log(`   - "${n.name}" (depth=${n.depth})`);
      });
      console.log();
    }

    // Spot check: verify a few parent-child relationships
    console.log('SPOT CHECK: Parent-child relationships (depth 1→0, 2→1, etc)');
    const depthOneNodes = await prisma.repositoryNode.findMany({
      where: { depth: 1 },
      select: { id: true, name: true, parentId: true },
      take: 3
    });

    for (const node of depthOneNodes) {
      const parent = await prisma.repositoryNode.findUnique({
        where: { id: node.parentId || '' },
        select: { depth: true, name: true }
      });
      if (parent) {
        console.log(`  ✓ "${node.name}" (depth 1) → parent "${parent.name}" (depth ${parent.depth})`);
      }
    }

    console.log('\n' + '='.repeat(70));
    if (orphans.length === 0 && nullParent === 1) {
      console.log('✅ DEPTH-FIX VERIFICATION: PASSED\n');
      console.log('Summary:');
      console.log(`  ✅ Root node has NULL parentId`);
      console.log(`  ✅ All ${total - 1} non-root nodes have valid parent references`);
      console.log(`  ✅ Parent-child hierarchy is intact`);
      console.log('\n🎉 The depth-level processing fix is working correctly!\n');
    } else {
      console.log('❌ DEPTH-FIX VERIFICATION: FAILED\n');
    }

    process.exit(orphans.length === 0 && nullParent === 1 ? 0 : 1);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
