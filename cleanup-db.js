const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupDatabase() {
  try {
    console.log('=== DATABASE CLEANUP ===\n');

    // Check current state
    const projectCountBefore = await prisma.project.count();
    const repoCountBefore = await prisma.repository.count();
    const nodeCountBefore = await prisma.repositoryNode.count();

    console.log('BEFORE CLEANUP:');
    console.log(`  Projects: ${projectCountBefore}`);
    console.log(`  Repositories: ${repoCountBefore}`);
    console.log(`  RepositoryNodes: ${nodeCountBefore}\n`);

    // Delete all projects (cascades to delete repositories, nodes, etc.)
    const deletedProjects = await prisma.project.deleteMany({});
    console.log(`✅ Deleted ${deletedProjects.count} projects`);

    // Verify cleanup
    const projectCountAfter = await prisma.project.count();
    const repoCountAfter = await prisma.repository.count();
    const nodeCountAfter = await prisma.repositoryNode.count();

    console.log('\nAFTER CLEANUP:');
    console.log(`  Projects: ${projectCountAfter}`);
    console.log(`  Repositories: ${repoCountAfter}`);
    console.log(`  RepositoryNodes: ${nodeCountAfter}\n`);

    console.log('✅ Database cleaned successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDatabase();
