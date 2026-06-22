const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function importAndVerify() {
  try {
    const projectId = 'cmqorivor03id7kgcdbyrpt7c';

    console.log('3. IMPORT TEST DATA (File Import)\n');

    // Create test data with the same hierarchy as the Roam graph
    const testData = [
      {
        title: 'TestSuite : Kinergy',
        uid: 'root-kinergy',
        children: [
          {
            title: 'TestType/Web',
            uid: 'testtype-web',
            children: [
              {
                title: 'Admin Portal',
                uid: 'admin-portal',
                children: [
                  {
                    title: 'Login',
                    uid: 'login-flow',
                    children: [
                      {
                        title: 'Screen 1',
                        uid: 'screen-1',
                        children: [
                          { title: 'Test Cases', uid: 'test-cases-1' },
                          { title: 'Test:: Verify Input', uid: 'test-verify-input' },
                          { title: 'Test:: Submit Form', uid: 'test-submit-form' },
                        ]
                      },
                      {
                        title: 'Screen 2',
                        uid: 'screen-2',
                        children: [
                          { title: 'Test Cases', uid: 'test-cases-2' },
                          { title: 'Test:: Verify Results', uid: 'test-verify-results' },
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ];

    // Get repository
    let repository = await prisma.repository.findFirst({
      where: { projectId }
    });

    if (!repository) {
      repository = await prisma.repository.create({
        data: {
          projectId,
          name: 'Fresh Project Repository',
          description: 'Repository for fresh project verification'
        }
      });
    }

    console.log(`   Repository: ${repository.name}`);
    console.log(`   Processing ${JSON.stringify(testData).split('uid').length - 1} nodes\n`);

    // Import using the same logic as sync.ts
    const sortedNodes = [];
    let maxDepth = 0;

    function flattenNodes(nodes, parentId = null, depth = 0) {
      for (const node of nodes) {
        sortedNodes.push({
          name: node.title,
          roamNodeId: node.uid,
          parentId: parentId,
          depth: depth,
          text: node.title,
          type: node.children && node.children.length > 0 ? 'FOLDER' : 'FILE'
        });
        maxDepth = Math.max(maxDepth, depth);
        if (node.children) {
          flattenNodes(node.children, node.uid, depth + 1);
        }
      }
    }

    flattenNodes(testData);

    console.log(`   Flattened to ${sortedNodes.length} nodes`);
    console.log(`   Max depth: ${maxDepth}\n`);

    // Deduplicate
    const seen = new Set();
    const deduplicated = [];
    for (const node of sortedNodes) {
      if (!seen.has(node.roamNodeId)) {
        seen.add(node.roamNodeId);
        deduplicated.push(node);
      }
    }

    // Import with depth-level processing
    console.log('4. IMPORTING WITH DEPTH-LEVEL PROCESSING\n');

    const nodesByDepth = new Map();
    for (const node of deduplicated) {
      if (!nodesByDepth.has(node.depth)) {
        nodesByDepth.set(node.depth, []);
      }
      nodesByDepth.get(node.depth).push(node);
    }

    const depths = Array.from(nodesByDepth.keys()).sort((a, b) => a - b);
    const uidToNodeId = new Map();
    const createdNodeIds = new Map();
    let totalCreated = 0;

    for (const depth of depths) {
      const nodesAtDepth = nodesByDepth.get(depth);
      console.log(`   Depth ${depth}: ${nodesAtDepth.length} nodes`);

      const nodesToCreate = [];

      for (const node of nodesAtDepth) {
        let parentNodeId = null;
        if (node.parentId) {
          if (createdNodeIds.has(node.parentId)) {
            parentNodeId = createdNodeIds.get(node.parentId);
          } else if (uidToNodeId.has(node.parentId)) {
            parentNodeId = uidToNodeId.get(node.parentId);
          }
        }

        nodesToCreate.push({
          repositoryId: repository.id,
          projectId,
          name: node.name,
          roamNodeId: node.roamNodeId,
          parentId: parentNodeId,
          depth: node.depth,
          type: node.type,
          slug: node.name.toLowerCase().replace(/[^\w\s-]/g, '').substring(0, 50)
        });
      }

      const created = await prisma.repositoryNode.createMany({
        data: nodesToCreate,
        skipDuplicates: true
      });

      console.log(`   Created: ${created.count} nodes`);
      totalCreated += created.count;

      // Update maps
      const createdNodesWithUids = await prisma.repositoryNode.findMany({
        where: {
          repositoryId: repository.id,
          roamNodeId: { in: nodesToCreate.map(n => n.roamNodeId) }
        },
        select: { id: true, roamNodeId: true }
      });

      for (const createdNode of createdNodesWithUids) {
        if (createdNode.roamNodeId) {
          uidToNodeId.set(createdNode.roamNodeId, createdNode.id);
          createdNodeIds.set(createdNode.roamNodeId, createdNode.id);
        }
      }
    }

    console.log(`\n   ✅ Total created: ${totalCreated} nodes\n`);

    // Show counts
    console.log('VERIFICATION RESULTS:\n');

    const repoNodeCount = await prisma.repositoryNode.count({
      where: { projectId }
    });

    const nullParentCount = await prisma.repositoryNode.count({
      where: { projectId, parentId: null }
    });

    const validParentCount = await prisma.repositoryNode.count({
      where: { projectId, parentId: { not: null } }
    });

    console.log(`RepositoryNode count:   ${repoNodeCount}`);
    console.log(`   - NULL parentId:     ${nullParentCount} (root node)`);
    console.log(`   - Valid parentId:    ${validParentCount}`);
    console.log(`   - Success rate:      ${((validParentCount/repoNodeCount)*100).toFixed(2)}%`);

    // Verify hierarchy chain
    console.log('\n5. HIERARCHY CHAIN VERIFICATION\n');

    const root = await prisma.repositoryNode.findFirst({
      where: { projectId, depth: 0 },
      select: { id: true, name: true }
    });

    console.log(`   ${root.name}`);

    let current = [root];
    const chainNames = [root.name];
    for (let i = 0; i < 4; i++) {
      const children = await prisma.repositoryNode.findMany({
        where: { projectId, parentId: { in: current.map(n => n.id) } },
        select: { id: true, name: true },
        take: 1
      });
      if (children.length === 0) break;
      console.log(`   → ${children[0].name}`);
      chainNames.push(children[0].name);
      current = children;
    }

    // Check for specific nodes
    console.log('\n6. EXPECTED HIERARCHY NODES\n');
    const expectedNames = ['TestType/Web', 'Admin Portal', 'Login', 'Screen 1'];
    for (const name of expectedNames) {
      const node = await prisma.repositoryNode.findFirst({
        where: { projectId, name: { contains: name } }
      });
      const status = node ? '✅' : '❌';
      console.log(`   ${status} ${name}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

importAndVerify();
