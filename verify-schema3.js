const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  try {
    // Check if any TestCase has nodes
    const tcWithNodes = await prisma.testCaseNode.findMany({
      take: 5,
      select: {
        testCaseId: true,
        nodeId: true,
        testCase: { select: { title: true } },
        node: { select: { name: true, type: true } }
      }
    });

    console.log('=== TestCase → RepositoryNode Links ===');
    if (tcWithNodes.length > 0) {
      console.log(JSON.stringify(tcWithNodes, null, 2));
    } else {
      console.log('No TestCaseNode records found!');
    }

    // Check RoamTestCase -> RepositoryNode direct relationship
    const rtcWithNodes = await prisma.roamTestCase.findMany({
      take: 5,
      select: {
        id: true,
        title: true,
        repositoryNodeId: true,
        repositoryNode: { select: { name: true, type: true } }
      }
    });

    console.log('\n=== RoamTestCase → RepositoryNode Links ===');
    console.log(JSON.stringify(rtcWithNodes, null, 2));

    // Count total records
    console.log('\n=== Total Counts ===');
    console.log('RoamTestCases:', await prisma.roamTestCase.count());
    console.log('TestCases:', await prisma.testCase.count());
    console.log('TestCaseNodes:', await prisma.testCaseNode.count());
    console.log('RepositoryNodes:', await prisma.repositoryNode.count());
    console.log('Tags:', await prisma.tag.count());
    console.log('TagTestCases:', await prisma.tagTestCase.count());

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
