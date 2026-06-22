const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function step1() {
  try {
    const projectId = 'cmqorivor03id7kgcdbyrpt7c';

    console.log('1. VERIFY ROAM CONFIGURATION\n');

    const config = await prisma.roamConfig.findUnique({
      where: { projectId }
    });

    if (config) {
      console.log('✅ Configuration exists:');
      console.log(`   Graph: ${config.graphName}`);
      console.log(`   Root Page: ${config.repositoryRootPage}`);
      console.log(`   API Token: ${config.apiToken ? 'Set' : 'Not set'}`);
    } else {
      console.log('❌ No configuration found');
      console.log('\n2. CONFIGURE ROAM SETTINGS\n');
      
      const newConfig = await prisma.roamConfig.create({
        data: {
          projectId,
          graphName: 'Project_Kinergy',
          repositoryRootPage: 'TestSuite : Kinergy',
          apiToken: 'roam-graph-local-token-test-verification',
          lastSyncStatus: 'NEVER'
        }
      });

      console.log('✅ Configuration created:');
      console.log(`   Graph: ${newConfig.graphName}`);
      console.log(`   Root Page: ${newConfig.repositoryRootPage}`);
    }

    console.log(`\nPROJECT_ID=${projectId}`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

step1();
