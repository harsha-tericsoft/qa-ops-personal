import { exec } from 'child_process';
import { promisify } from 'util';
import { prisma } from '@/lib/prisma';

const execAsync = promisify(exec);

export async function syncViaMCPSimple(projectId: string, graphName: string) {
  // Search for Test:: nodes
  const { stdout } = await execAsync(
    `roam search --graph "${graphName}" --query="Test::"`,
    { timeout: 30000 }
  );

  const searchResult = JSON.parse(stdout);

  // Get or create repository
  let repo = await prisma.repository.findFirst({ where: { projectId } });
  if (!repo) {
    repo = await prisma.repository.create({
      data: { projectId, name: 'Roam Sync', description: 'MCP' },
    });
  }

  let imported = 0;
  const errors: string[] = [];

  for (const result of (searchResult.results || []).slice(0, 31)) {
    try {
      const uid = result.uid;
      const md = result.markdown || '';
      const match = md.match(/\*\*Test::\s*\*?\*?([^#\n]+)/);
      const title = match ? match[1].trim() : `Test ${uid}`;

      // Find or create node in this project
      let node = await prisma.repositoryNode.findUnique({
        where: {
          repositoryId_roamNodeId: {
            repositoryId: repo.id,
            roamNodeId: uid,
          }
        },
      }).catch(() => null);

      if (node && node.projectId !== projectId) {
        // Node exists but for different project - create a separate one
        node = await prisma.repositoryNode.create({
          data: {
            roamNodeId: `${uid}_${projectId.substring(0, 8)}`,
            repositoryId: repo.id,
            projectId,
            name: title,
            slug: uid,
            path: `/${uid}`,
            type: 'FILE',
            syncedAt: new Date(),
          },
        });
      } else if (!node) {
        // Create new node
        node = await prisma.repositoryNode.create({
          data: {
            roamNodeId: uid,
            repositoryId: repo.id,
            projectId,
            name: title,
            slug: uid,
            path: `/${uid}`,
            type: 'FILE',
            syncedAt: new Date(),
          },
        });
      } else {
        // Update existing node
        await prisma.repositoryNode.update({
          where: { id: node.id },
          data: { name: title, syncedAt: new Date() },
        });
      }

      // Create or update test case
      const roamTestCase = await prisma.roamTestCase.upsert({
        where: { repositoryNodeId: node.id },
        update: { title, status: 'NOT_RUN' },
        create: {
          projectId,
          repositoryNodeId: node.id,
          title,
          status: 'NOT_RUN',
          sourceRoamUid: uid,
        },
      });

      // Also create or update generic TestCase for suite compatibility
      await prisma.testCase.upsert({
        where: { id: roamTestCase.id }, // Use same ID for easy linking
        update: { title },
        create: {
          id: roamTestCase.id,
          projectId,
          title,
          description: `Imported from Roam: ${uid}`,
        },
      }).catch(() => null); // Ignore if ID already exists

      imported++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(msg);
    }
  }

  return { imported, total: searchResult.total, errors: errors.slice(0, 2) };
}
