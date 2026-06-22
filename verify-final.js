const fs = require('fs');
const { execSync } = require('child_process');

// Read file and remove BOM if present
let jsonStr = fs.readFileSync('migration-results-corrected.json', 'utf-8');
if (jsonStr.charCodeAt(0) === 0xFEFF) {
  jsonStr = jsonStr.slice(1);
}
const report = JSON.parse(jsonStr);
const updatedUIDs = report.updatedUIDs;

console.log('=== MIGRATION VERIFICATION REPORT ===\n');
console.log(`Migration completed at: ${report.endTime}`);
console.log(`Total candidates identified: ${report.totalCandidates}`);
console.log(`Blocks updated: ${report.updated}`);
console.log(`Blocks already with Test::: ${report.alreadyPrefixed}`);
console.log(`Blocks failed to update: ${report.failed.length}\n`);

// Randomly select 20 UIDs
const sampleSize = Math.min(20, updatedUIDs.length);
const indices = new Set();
const sampleUIDs = [];
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
    const output = execSync(
      `roam get-block --graph "Project_Kinergy" --uid "${uid}"`,
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }
    );

    const block = JSON.parse(output);
    const markdown = block.markdown || block.string || block.title || '';

    // Extract first line and clean it
    const firstLine = markdown
      .split('\n')[0]
      .replace(/^\s*-\s*/, '')
      .replace(/<roam[^>]*>/g, '')
      .trim();

    if (firstLine.startsWith('Test::')) {
      const displayText = firstLine.substring(0, 100);
      verifiedBlocks.push({ uid, text: displayText, verified: true });
      console.log(`[✅ ${i + 1}/${sampleSize}] UID: ${uid}`);
      console.log(`    ${firstLine.substring(0, 75)}${firstLine.length > 75 ? '...' : ''}`);
    } else {
      const displayText = firstLine.substring(0, 100);
      failedVerifications.push({
        uid,
        text: displayText,
        error: "Does not start with 'Test::'"
      });
      console.log(`[❌ ${i + 1}/${sampleSize}] UID: ${uid} - NOT UPDATED`);
    }
  } catch (error) {
    failedVerifications.push({
      uid,
      error: error.message.substring(0, 100)
    });
    console.log(`[❌ ${i + 1}/${sampleSize}] UID: ${uid} - ERROR`);
  }
}

console.log('\n=== VERIFICATION SUMMARY ===\n');
console.log(`✅ Successfully verified: ${verifiedBlocks.length}/${sampleSize} blocks`);
console.log(`❌ Verification failed: ${failedVerifications.length}/${sampleSize} blocks`);

if (failedVerifications.length > 0) {
  console.log('\nFailed verifications:');
  failedVerifications.forEach((v) => {
    console.log(`    [${v.uid}] ${v.error}`);
  });
}

console.log('\n=== FINAL TEST:: BLOCK COUNT ===\n');
console.log('Before migration: 2 blocks starting with "Test::"');
const expectedCount = 2 + report.updated;
console.log(`After migration: Expected ${expectedCount} blocks starting with "Test::"`);
console.log(`Sample verification: ${verifiedBlocks.length}/${sampleSize} blocks correctly prefixed`);

// Save verification report
const verificationReport = {
  verificationTime: new Date().toISOString(),
  totalCandidates: report.totalCandidates,
  totalUpdated: report.updated,
  totalAlreadyPrefixed: report.alreadyPrefixed,
  totalFailed: report.failed.length,
  sampleSize,
  successfulVerifications: verifiedBlocks.length,
  failedVerifications: failedVerifications.length,
  verificationSuccess: verifiedBlocks.length === sampleSize,
  expectedTestBlockCount: expectedCount,
  sampledBlocksVerified: verifiedBlocks,
  failedBlockVerifications: failedVerifications
};

fs.writeFileSync('verification-report-final.json', JSON.stringify(verificationReport, null, 2));
console.log('\n✅ Verification report saved to: verification-report-final.json');
