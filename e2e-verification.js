const http = require('http');
const https = require('https');

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
    console.log('🚀 E2E VERIFICATION WORKFLOW\n');
    console.log('Step 1: Create fresh project');
    console.log('=============================\n');

    // Create project
    const projectRes = await makeRequest('POST', '/api/projects', {
      name: 'Test Project - Fresh',
      description: 'Fresh project for depth-fix verification',
    });

    if (!projectRes.data || !projectRes.data.id) {
      throw new Error(`Failed to create project: ${projectRes.status} - ${projectRes.raw}`);
    }

    const projectId = projectRes.data.id;
    console.log(`✅ Project created: ${projectId}\n`);

    console.log('Step 2: Configure Roam settings');
    console.log('================================\n');

    // Configure Roam - using local API token
    const configRes = await makeRequest('POST', '/api/roam/config', {
      projectId: projectId,
      graphName: 'Project_Kinergy',
      apiToken: 'roam-graph-local-token-test-token-12345',
      repositoryRootPage: 'TestSuite : Kinergy',
    }, 5);

    if (!configRes.data || !configRes.data.success) {
      throw new Error(`Failed to configure Roam: ${configRes.status} - ${configRes.raw}`);
    }

    console.log(`✅ Roam configured for project ${projectId}\n`);

    console.log('Step 3: Test Roam connection');
    console.log('=============================\n');

    const testRes = await makeRequest('POST', `/api/roam/test-connection`, {}, 5);
    console.log(`Connection test: ${testRes.data?.success ? '✅ Success' : '❌ Failed'}`);
    if (testRes.data?.details) {
      console.log(`  Details: ${testRes.data.details}\n`);
    }

    console.log('Step 4: Run Initial Sync');
    console.log('========================\n');

    const syncStartTime = Date.now();
    const syncRes = await makeRequest('POST', `/api/roam/sync`, {
      projectId: projectId,
      syncType: 'initial'
    }, 10);

    if (!syncRes.data) {
      console.error(`❌ Sync request failed: ${syncRes.status}`);
      console.error(`Response: ${syncRes.raw}`);
      throw new Error('Sync failed');
    }

    const syncDuration = Date.now() - syncStartTime;
    console.log(`Sync Status: ${syncRes.data.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Duration: ${syncDuration}ms`);
    console.log(`Nodes Added: ${syncRes.data.nodesAdded}`);
    if (syncRes.data.error) {
      console.log(`Error: ${syncRes.data.error}`);
    }
    console.log(`Message: ${syncRes.data.message}\n`);

    if (!syncRes.data.success) {
      throw new Error(`Initial Sync failed: ${syncRes.data.error}`);
    }

    console.log('Step 5: Verify database state');
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
      console.log(`NULL percentage: ${((nodesWithNullParent / totalNodes) * 100).toFixed(2)}%`);
    }

    console.log('\nNodes by Depth:');
    nodesByDepth.forEach(d => {
      console.log(`  Depth ${d.depth}: ${d._count.id} nodes`);
    });

    // Sample nodes to verify hierarchy
    console.log('\nSample nodes (first 5):');
    const sampleNodes = await prisma.repositoryNode.findMany({
      take: 5,
      select: { id: true, name: true, depth: true, parentId: true, roamNodeId: true }
    });
    sampleNodes.forEach((n, i) => {
      console.log(`  ${i + 1}. ${n.name} (depth=${n.depth}, parentId=${n.parentId ? '✓' : '✗'})`);
    });

    await prisma.$disconnect();

    console.log('\n✅ E2E VERIFICATION COMPLETE!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

runE2EVerification();
