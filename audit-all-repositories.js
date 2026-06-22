const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function auditAllRepositories() {
  console.log('=== AUDIT ALL REPOSITORIES ===\n');

  try {
    // 1. Get all repositories with their projects
    console.log('1. Fetching all repositories...\n');
    const repositories = await prisma.repository.findMany({
      include: {
        project: {
          select: { id: true, name: true }
        }
      }
    });

    console.log(`Total repositories: ${repositories.length}\n`);

    // 2. For each repository, count nodes by parentId status
    console.log('2. Analyzing node hierarchy status:\n');
    console.log('Repository ID | Repository Name | Project Name | Total Nodes | NULL parentId | NOT NULL parentId | Ratio (NULL/Total)');
    console.log('='.repeat(140));

    const repositoryStats = [];

    for (const repo of repositories) {
      const totalNodes = await prisma.repositoryNode.count({
        where: { repositoryId: repo.id }
      });

      const nullParentNodes = await prisma.repositoryNode.count({
        where: {
          repositoryId: repo.id,
          parentId: null
        }
      });

      const notNullParentNodes = totalNodes - nullParentNodes;
      const ratio = totalNodes > 0 ? ((nullParentNodes / totalNodes) * 100).toFixed(1) : '0.0';

      repositoryStats.push({
        id: repo.id,
        name: repo.name,
        projectName: repo.project?.name || '(unknown)',
        totalNodes,
        nullParent: nullParentNodes,
        notNullParent: notNullParentNodes,
        nullRatio: parseFloat(ratio)
      });

      const repoId = repo.id.substring(0, 8);
      const repoName = repo.name.substring(0, 35).padEnd(35);
      const projName = (repo.project?.name || '(unknown)').substring(0, 25).padEnd(25);

      console.log(`${repoId}... | ${repoName} | ${projName} | ${String(totalNodes).padStart(11)} | ${String(nullParentNodes).padStart(13)} | ${String(notNullParentNodes).padStart(17)} | ${ratio}%`);
    }

    console.log('\n');

    // 3. Analyze the data
    console.log('3. Analysis:\n');

    const allNullRepos = repositoryStats.filter(r => r.nullRatio === 100);
    const partialNullRepos = repositoryStats.filter(r => r.nullRatio > 0 && r.nullRatio < 100);
    const noNullRepos = repositoryStats.filter(r => r.nullRatio === 0);

    console.log(`Repositories with 100% NULL parentId (fully broken): ${allNullRepos.length}`);
    allNullRepos.forEach(r => {
      console.log(`  - ${r.name} (${r.totalNodes} nodes)`);
    });

    console.log(`\nRepositories with some NULL parentId (partially broken): ${partialNullRepos.length}`);
    partialNullRepos.forEach(r => {
      console.log(`  - ${r.name} (${r.nullParent}/${r.totalNodes} = ${r.nullRatio}%)`);
    });

    console.log(`\nRepositories with 0% NULL parentId (fully working): ${noNullRepos.length}`);
    noNullRepos.forEach(r => {
      console.log(`  - ${r.name} (${r.totalNodes} nodes)`);
    });

    console.log('\n');

    // 4. Determine if issue is new pipeline or old
    console.log('4. Root Cause Assessment:\n');

    if (allNullRepos.length > 0) {
      console.log(`⚠️  CRITICAL: ${allNullRepos.length} repository(ies) have ALL nodes with NULL parentId`);
      console.log('   This indicates a systemic problem in the sync pipeline.\n');

      // Check if these are all from recent syncs
      const brokenRepos = allNullRepos.map(r => r.name);
      console.log('   Broken repositories:');
      brokenRepos.forEach(name => console.log(`     - ${name}`));

      // Try to determine if these are from the new pipeline
      if (allNullRepos.some(r => r.projectName.includes('new Test project'))) {
        console.log('\n   ⚠️  New test projects ARE affected by NULL parentId issue');
      }

      if (allNullRepos.length > 1 || allNullRepos[0].totalNodes > 1000) {
        console.log('\n   🔴 CONCLUSION: Issue affects multiple repositories or large imports');
        console.log('      This is NOT limited to one project - it\'s a pipeline-wide problem');
      }
    }

    if (noNullRepos.length > 0) {
      console.log(`✅ ${noNullRepos.length} repository(ies) have correct parent-child relationships`);
      console.log('   These were likely imported with an older (working) sync pipeline.\n');

      // Show when the working repos were created
      for (const repo of noNullRepos) {
        const repoRecord = repositories.find(r => r.id === repo.id);
        if (repoRecord) {
          console.log(`   ${repo.name} - Created: ${repoRecord.createdAt?.toISOString()?.split('T')[0] || '(unknown)'}`);
        }
      }
    }

    console.log('\n');

    // 5. Why do existing projects still work?
    console.log('5. Why Existing Projects Still Partially Work:\n');

    if (noNullRepos.length > 0) {
      console.log('   Existing projects work because:');
      console.log('   - They were imported BEFORE the sync pipeline regression');
      console.log('   - Their parent-child relationships were correctly set');
      console.log('   - Application code can traverse the hierarchy using existing parentId values');
      console.log('   - As long as no UPDATE occurs, the old data remains intact\n');

      console.log('   What happens if you click "Refresh Sync" on a working project:');
      console.log('   ❓ New nodes added during refresh would also get parentId = NULL');
      console.log('   ❓ This would corrupt the previously-working hierarchy');
    }

    if (partialNullRepos.length > 0) {
      console.log('\n   Partially broken repositories show a mixed state:');
      partialNullRepos.forEach(r => {
        console.log(`   - ${r.name}: ${r.notNullParent} working, ${r.nullParent} broken`);
        console.log(`     This suggests an UPDATE or incremental import that added broken nodes`);
      });
    }

    console.log('\n');

    // 6. Summary table
    console.log('6. Summary:\n');
    console.log('   Status | Count | Implication');
    console.log('   ------|-------|-------------------------------------------');
    console.log(`   100% NULL | ${allNullRepos.length} | Fresh imports are completely broken`);
    console.log(`   Partial NULL | ${partialNullRepos.length} | Incremental updates mixed broken nodes with working`);
    console.log(`   0% NULL | ${noNullRepos.length} | Old imports still work (no recent syncs)`);
    console.log('');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

auditAllRepositories();
