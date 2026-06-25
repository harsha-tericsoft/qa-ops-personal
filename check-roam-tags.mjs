import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get all RoamTestCases with tags
  const all = await prisma.roamTestCase.findMany({
    where: { projectId: 'cmqttt49c000r7kygg73fmuqv' },
    select: { id: true, title: true, tags: true, projectId: true },
    take: 5
  });

  console.log('Sample RoamTestCases:');
  all.forEach(r => {
    console.log(`  ${r.title}`);
    console.log(`    Tags: ${JSON.stringify(r.tags)}`);
  });

  // Count tags
  const testCasesWithTags = await prisma.roamTestCase.findMany({
    where: { projectId: 'cmqttt49c000r7kygg73fmuqv' },
    select: { tags: true }
  });

  const allTags = new Set();
  testCasesWithTags.forEach(tc => {
    tc.tags.forEach(tag => allTags.add(tag));
  });

  console.log(`\nUnique tags in RoamTestCase: ${allTags.size}`);
  console.log('Tags:', Array.from(allTags).slice(0, 10));

  // Check Tag table
  const tagCount = await prisma.tag.count();
  console.log(`\nTags in Tag table: ${tagCount}`);

  // Check TagTestCase
  const tagTestCount = await prisma.tagTestCase.count();
  console.log(`TagTestCase links: ${tagTestCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
