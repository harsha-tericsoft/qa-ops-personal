const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

function executeCommand(command, content, uid) {
  return new Promise((resolve, reject) => {
    const args = ['update-block', '--graph', 'Project_Kinergy', '--uid', uid];

    // Prepare args with the content as the last argument
    const proc = spawn('roam', [...args, '--content', content], {
      timeout: 30000,
      env: {
        ...process.env,
        ROAM_LOCAL_API_TOKEN: process.env.ROAM_LOCAL_API_TOKEN
      }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });

    proc.on('error', (error) => {
      reject(error);
    });
  });
}

async function migrateTestCases() {
  const report = JSON.parse(fs.readFileSync('migration-analysis-report.json', 'utf-8'));
  const candidates = report.candidates;

  console.log('=== ROAM TEST CASE MIGRATION (v2) ===\n');
  console.log(`Total candidates to migrate: ${candidates.length}`);
  console.log(`Graph: Project_Kinergy`);
  console.log('');

  const results = {
    startTime: new Date().toISOString(),
    graphName: 'Project_Kinergy',
    totalCandidates: candidates.length,
    updated: 0,
    alreadyPrefixed: 0,
    failed: [],
    updatedUIDs: [],
    failedUIDs: []
  };

  // Migrate each candidate
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const text = candidate.text;
    const uid = candidate.uid;

    // Skip if already starts with "Test::"
    if (text.startsWith('Test::')) {
      results.alreadyPrefixed++;
      continue;
    }

    const newText = `Test:: ${text}`;

    try {
      await executeCommand(`roam update-block`, newText, uid);
      results.updated++;
      results.updatedUIDs.push(uid);

      if ((i + 1) % 50 === 0) {
        console.log(`Progress: ${i + 1}/${candidates.length} blocks processed`);
      }
    } catch (error) {
      results.failed.push({
        uid,
        originalText: text.substring(0, 100),
        error: error.message.substring(0, 200)
      });
      results.failedUIDs.push(uid);

      if ((i + 1) % 100 === 0) {
        console.log(`  - Failures so far: ${results.failed.length}`);
      }
    }
  }

  results.endTime = new Date().toISOString();

  console.log('\n=== MIGRATION COMPLETE ===\n');
  console.log(`✅ Updated: ${results.updated}`);
  console.log(`⏭️  Already prefixed (Test::): ${results.alreadyPrefixed}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`\nTotal blocks modified: ${results.updated}`);
  console.log(`Expected Test:: blocks after migration: ${2 + results.updated}`);

  // Save results
  fs.writeFileSync('migration-results.json', JSON.stringify(results, null, 2));
  console.log('\n✅ Results saved to: migration-results.json');

  return results;
}

migrateTestCases().catch(err => {
  console.error('Migration error:', err.message);
  process.exit(1);
});
