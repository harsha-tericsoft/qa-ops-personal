const fs = require('fs');
const { execSync } = require('child_process');

async function verifyMigration() {
  const migrationResults = JSON.parse(fs.readFileSync('migration-results.json', 'utf-8'));
  const updatedUIDs = migrationResults.updatedUIDs;

  console.log('=== MIGRATION VERIFICATION REPORT ===\n');
  console.log(`Migration completed at: ${migrationResults.endTime}`);
  console.log(`Total candidates identified: ${migrationResults.totalCandidates}`);
  console.log(`Blocks updated: ${migrationResults.updated}`);
  console.log(`Blocks already with Test::: ${migrationResults.alreadyPrefixed}`);
  console.log(`Blocks failed to update: ${migrationResults.failed.length}`);
  console.log('');

  // Randomly select 20 UIDs to verify (or all if less than 20)
  const sampleSize = Math.min(20, updatedUIDs.length);
  const sampleUIDs = [];
  const indices = new Set();

  while (sampleUIDs.length < sampleSize) {
    const idx = Math.floor(Math.random() * updatedUIDs.length);
    if (!indices.has(idx)) {
      indices.add(idx);
      sampleUIDs.push(updatedUIDs[idx]);
    }
  }

  console.log(`Randomly verifying ${sampleSize} updated blocks:\n`);

  const verifiedBlocks = [];
  const failedVerifications = [];

  for (let i = 0; i < sampleUIDs.length; i++) {
    const uid = sampleUIDs[i];
    try {
      const command = `roam get-block --graph "Project_Kinergy" --uid="${uid}"`;

      const output = execSync(command, {
        timeout: 30000,
        env: {
          ...process.env,
          ROAM_LOCAL_API_TOKEN: process.env.ROAM_LOCAL_API_TOKEN
        },
        encoding: 'utf-8'
      });

      const block = JSON.parse(output);
      const text = block.string || block.title || '';

      if (text.startsWith('Test::')) {
        verifiedBlocks.push({
          uid,
          text: text.substring(0, 100),
          verified: true
        });
        console.log(`[✅ ${i + 1}/${sampleSize}] UID: ${uid}`);
        console.log(`    Text: ${text.substring(0, 80)}`);
      } else {
        failedVerifications.push({
          uid,
          text: text.substring(0, 100),
          error: 'Does not start with "Test::"'
        });
        console.log(`[❌ ${i + 1}/${sampleSize}] UID: ${uid} - NOT UPDATED`);
      }
    } catch (error) {
      failedVerifications.push({
        uid,
        error: error.message.substring(0, 100)
      });
      console.log(`[❌ ${i + 1}/${sampleSize}] UID: ${uid} - VERIFICATION FAILED`);
    }
  }

  console.log('\n=== VERIFICATION SUMMARY ===\n');
  console.log(`✅ Successfully verified: ${verifiedBlocks.length}/${sampleSize}`);
  console.log(`❌ Verification failed: ${failedVerifications.length}/${sampleSize}`);

  if (failedVerifications.length > 0) {
    console.log('\n⚠️  Failed verifications:');
    failedVerifications.forEach((v, idx) => {
      console.log(`[${idx + 1}] UID: ${v.uid}`);
      console.log(`    Error: ${v.error}`);
    });
  }

  // Count Test:: blocks in the graph
  console.log('\n=== FINAL TEST:: COUNT ===\n');
  console.log('Before migration: 2 blocks starting with "Test::"');
  console.log(`After migration: Expected ${2 + migrationResults.updated} blocks starting with "Test::"`);
  console.log(`Verified blocks in sample: ${verifiedBlocks.length}/${sampleSize} correctly prefixed`);

  // Save verification results
  const verificationReport = {
    verificationTime: new Date().toISOString(),
    totalCandidates: migrationResults.totalCandidates,
    totalUpdated: migrationResults.updated,
    totalAlreadyPrefixed: migrationResults.alreadyPrefixed,
    totalFailed: migrationResults.failed.length,
    sampleSize,
    successfulVerifications: verifiedBlocks.length,
    failedVerifications: failedVerifications.length,
    sampledBlocksVerified: verifiedBlocks,
    failedBlockVerifications: failedVerifications
  };

  fs.writeFileSync('verification-report.json', JSON.stringify(verificationReport, null, 2));
  console.log('\n✅ Verification report saved to: verification-report.json');

  return verificationReport;
}

verifyMigration().catch(err => {
  console.error('Verification error:', err.message);
  process.exit(1);
});
