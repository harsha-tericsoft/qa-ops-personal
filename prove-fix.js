const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function prove() {
  try {
    // Get project with 3718 nodes (the one that synced successfully)
    const latestProject = await prisma.project.findUnique({
      where: { id: 'cmqoreffq00047kgcwwqnkmzu' },
      select: { id: true, name: true }
    });

    console.log('LATEST PROJECT:');
    console.log(`  ID: ${latestProject.id}`);
    console.log(`  Name: ${latestProject.name}\n`);

    // Query 1: Basic node stats
    console.log('1. NODE STATISTICS:');
    const totalNodes = await prisma.repositoryNode.count({
      where: { projectId: latestProject.id }
    });
    const nullParent = await prisma.repositoryNode.count({
      where: { projectId: latestProject.id, parentId: null }
    });
    const notNullParent = await prisma.repositoryNode.count({
      where: { projectId: latestProject.id, parentId: { not: null } }
    });

    console.log(`  Total nodes: ${totalNodes}`);
    console.log(`  parentId IS NULL: ${nullParent}`);
    console.log(`  parentId IS NOT NULL: ${notNullParent}\n`);

    // Query 2: Show hierarchy chain
    console.log('2. HIERARCHY CHAIN:');

    // Get root
    const root = await prisma.repositoryNode.findFirst({
      where: {
        projectId: latestProject.id,
        name: 'TestSuite : Kinergy'
      },
      select: { id: true, name: true }
    });

    if (root) {
      console.log(`   ${root.name}`);

      // Get TestType/Web
      const testTypeWeb = await prisma.repositoryNode.findFirst({
        where: {
          projectId: latestProject.id,
          parentId: root.id,
          name: { contains: 'TestType/Web' }
        },
        select: { id: true, name: true }
      });

      if (testTypeWeb) {
        console.log(`   → ${testTypeWeb.name}`);

        // Get Admin Portal
        const adminPortal = await prisma.repositoryNode.findFirst({
          where: {
            projectId: latestProject.id,
            parentId: testTypeWeb.id,
            name: { contains: 'Admin Portal' }
          },
          select: { id: true, name: true }
        });

        if (adminPortal) {
          console.log(`   → ${adminPortal.name}`);

          // Get Login
          const login = await prisma.repositoryNode.findFirst({
            where: {
              projectId: latestProject.id,
              parentId: adminPortal.id,
              name: { contains: 'Login' }
            },
            select: { id: true, name: true }
          });

          if (login) {
            console.log(`   → ${login.name}`);

            // Get Screen 1
            const screen1 = await prisma.repositoryNode.findFirst({
              where: {
                projectId: latestProject.id,
                parentId: login.id,
                name: { contains: 'Screen 1' }
              },
              select: { id: true, name: true }
            });

            if (screen1) {
              console.log(`   → ${screen1.name}`);

              // Get Test Cases under Screen 1
              const testCases = await prisma.repositoryNode.findFirst({
                where: {
                  projectId: latestProject.id,
                  parentId: screen1.id,
                  name: { contains: 'Test' }
                },
                select: { id: true, name: true }
              });

              if (testCases) {
                console.log(`   → ${testCases.name}`);

                // Get a test under Test Cases
                const test = await prisma.repositoryNode.findFirst({
                  where: {
                    projectId: latestProject.id,
                    parentId: testCases.id
                  },
                  select: { id: true, name: true },
                  take: 1
                });

                if (test) {
                  console.log(`   → ${test.name}\n`);
                }
              }
            }
          }
        }
      }
    }

    // Output project ID for next steps
    console.log(`PROJECT_ID=${latestProject.id}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

prove();
