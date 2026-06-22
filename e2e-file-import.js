const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(method, path, body = null, retries = 3) {
  return new Promise((resolve, reject) => {
    const attemptRequest = (attemptsLeft) => {
      const url = new URL(BASE_URL + path);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const jsonData = data ? JSON.parse(data) : null;
            resolve({ status: res.statusCode, data: jsonData, raw: data });
          } catch (e) {
            resolve({ status: res.statusCode, data: null, raw: data });
          }
        });
      });

      req.on('error', (err) => {
        if (attemptsLeft > 0) {
          console.log(`  ⚠️  Retry ${retries - attemptsLeft + 1}/${retries}: ${err.message}`);
          setTimeout(() => attemptRequest(attemptsLeft - 1), 1000);
        } else {
          reject(err);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        if (attemptsLeft > 0) {
          console.log(`  ⚠️  Timeout retry ${retries - attemptsLeft + 1}/${retries}`);
          setTimeout(() => attemptRequest(attemptsLeft - 1), 1000);
        } else {
          reject(new Error('Request timeout after retries'));
        }
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    };

    attemptRequest(retries);
  });
}

async function runE2EVerification() {
  try {
    console.log('🚀 E2E VERIFICATION WORKFLOW - FILE IMPORT\n');
    console.log('Step 1: Create fresh project');
    console.log('=============================\n');

    // Create project
    const projectRes = await makeRequest('POST', '/api/projects', {
      name: 'Test Project - Depth Fix Verification',
      description: 'Fresh project for parent-child hierarchy verification',
    });

    if (!projectRes.data || !projectRes.data.id) {
      throw new Error(`Failed to create project: ${projectRes.status} - ${projectRes.raw}`);
    }

    const projectId = projectRes.data.id;
    console.log(`✅ Project created: ${projectId}\n`);

    console.log('Step 2: Prepare test data');
    console.log('========================\n');

    // Create a hierarchical test dataset that tests the depth-level fix
    // Root (depth 0) -> Child1 (depth 1) -> Grandchild1 (depth 2) -> Great-grandchild (depth 3)
    const testData = [
      {
        title: 'Root Node',
        uid: 'root-001',
        children: [
          {
            title: 'Login',
            uid: 'login-001',
            children: [
              {
                title: 'Screen 1',
                uid: 'screen1-001',
                children: [
                  { title: 'Step 1', uid: 'step1-001' },
                  { title: 'Step 2', uid: 'step2-001' },
                ],
              },
              {
                title: 'Screen 2',
                uid: 'screen2-001',
                children: [
                  { title: 'Validation', uid: 'valid-001' },
                ],
              },
            ],
          },
          {
            title: 'Signup',
            uid: 'signup-001',
            children: [
              {
                title: 'Form',
                uid: 'form-001',
                children: [
                  { title: 'Email Field', uid: 'email-001' },
                  { title: 'Password Field', uid: 'pass-001' },
                ],
              },
            ],
          },
        ],
      },
    ];

    console.log(`✅ Created test data with ${JSON.stringify(testData).split('uid').length - 1} nodes\n`);

    console.log('Step 3: Import test data via file import');
    console.log('======================================\n');

    const importRes = await makeRequest('POST', '/api/roam/import', {
      projectId: projectId,
      data: testData
    }, 5);

    if (!importRes.data) {
      throw new Error(`Import failed: ${importRes.status} - ${importRes.raw}`);
    }

    console.log(`Import Status: ${importRes.data.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Nodes Added: ${importRes.data.added}`);
    console.log(`Nodes Updated: ${importRes.data.updated}`);
    console.log(`Nodes Skipped: ${importRes.data.skipped}`);
    if (importRes.data.errors && importRes.data.errors.length > 0) {
      console.log(`Errors: ${importRes.data.errors.join(', ')}`);
    }
    console.log();

    if (!importRes.data.success && importRes.data.errors && importRes.data.errors.length > 0) {
      throw new Error(`Import failed: ${importRes.data.errors[0]}`);
    }

    console.log('Step 4: Verify database state');
    console.log('==============================\n');

    // Query database for node statistics
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const totalNodes = await prisma.repositoryNode.count();
    const nodesWithParentId = await prisma.repositoryNode.count({
      where: { parentId: { not: null } }
    });
    const nodesWithNullParent = await prisma.repositoryNode.count({
      where: { parentId: null }
    });

    const nodesByDepth = await prisma.repositoryNode.groupBy({
      by: ['depth'],
      _count: { id: true },
      orderBy: { depth: 'asc' }
    });

    console.log(`Total Nodes Imported: ${totalNodes}`);
    console.log(`Nodes with parentId NOT NULL: ${nodesWithParentId}`);
    console.log(`Nodes with parentId NULL: ${nodesWithNullParent}`);
    if (totalNodes > 0) {
      const nullPercentage = ((nodesWithNullParent / totalNodes) * 100).toFixed(2);
      console.log(`NULL percentage: ${nullPercentage}%`);
      console.log(`\n${nullPercentage === '0.00' ? '✅ PASS' : '❌ FAIL'}: Expected 0% NULL, got ${nullPercentage}%`);
    }

    console.log('\nNodes by Depth:');
    nodesByDepth.forEach(d => {
      console.log(`  Depth ${d.depth}: ${d._count.id} nodes`);
    });

    // Sample nodes to verify hierarchy
    console.log('\nSample nodes (first 10 in creation order):');
    const sampleNodes = await prisma.repositoryNode.findMany({
      take: 10,
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, depth: true, parentId: true, roamNodeId: true }
    });
    sampleNodes.forEach((n, i) => {
      const parentStatus = n.parentId ? `✓ (${n.parentId.substring(0, 8)}...)` : '✗ NULL';
      console.log(`  ${i + 1}. ${n.name.padEnd(20)} depth=${n.depth} parent=${parentStatus}`);
    });

    // Check parent-child hierarchy integrity
    console.log('\nParent-Child Hierarchy Validation:');
    const allNodes = await prisma.repositoryNode.findMany({
      select: { id: true, name: true, depth: true, parentId: true }
    });

    // Build parent map
    const nodeMap = new Map(allNodes.map(n => [n.id, n]));

    let hierarchyValid = true;
    let validationIssues = 0;
    for (const node of allNodes) {
      if (node.parentId) {
        const parent = nodeMap.get(node.parentId);
        if (!parent) {
          console.log(`  ❌ ORPHAN: "${node.name}" (depth=${node.depth}) has invalid parentId=${node.parentId}`);
          validationIssues++;
          hierarchyValid = false;
        } else if (parent.depth >= node.depth) {
          console.log(`  ❌ DEPTH VIOLATION: "${node.name}" (depth=${node.depth}) has parent "${parent.name}" at same/greater depth (${parent.depth})`);
          validationIssues++;
          hierarchyValid = false;
        }
      } else if (node.depth > 0) {
        console.log(`  ⚠️  ROOT AT DEPTH: "${node.name}" has no parent but depth=${node.depth}`);
      }
    }

    if (hierarchyValid) {
      console.log(`  ✅ All parent-child relationships are valid!`);
    } else {
      console.log(`  ❌ ${validationIssues} hierarchy validation issues found`);
    }

    await prisma.$disconnect();

    console.log('\n' + '='.repeat(50));
    console.log('✅ E2E VERIFICATION COMPLETE!');
    console.log('='.repeat(50));

    if (nodesWithNullParent === 0 && hierarchyValid) {
      console.log('\n🎉 DEPTH-FIX VERIFICATION: PASSED');
      console.log('   - All nodes have correct parent references');
      console.log('   - No orphaned nodes');
      console.log('   - Hierarchy integrity confirmed');
    } else {
      console.log('\n❌ DEPTH-FIX VERIFICATION: FAILED');
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

runE2EVerification();
