const fs = require('fs');
const pageData = JSON.parse(fs.readFileSync('roam-page-analysis.json', 'utf-8'));
const markdown = pageData.markdown || '';

// Parse the markdown to build hierarchy
const lines = markdown.split('\n');
const blocks = [];
const blockStack = []; // Stack to track hierarchy

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;

  // Extract indent level
  const indentMatch = line.match(/^( *)-/);
  if (!indentMatch) continue;

  const indentLevel = indentMatch[1].length / 2;

  // Extract UID
  const uidMatch = line.match(/<roam uid="([^"]+)"/);
  if (!uidMatch) continue;

  const uid = uidMatch[1];

  // Extract text
  let text = line
    .replace(/<roam uid="[^"]*"[^>]*\/?>/g, '')
    .replace(/^( *)- /, '')
    .replace(/!\[\]\([^)]*\)/g, '')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/\\n/g, ' ')
    .trim();

  // Build hierarchy path
  blockStack.length = indentLevel;
  blockStack.push({ uid, text });

  const hierarchyPath = blockStack.map(b => b.text).join(' > ');

  const block = {
    uid,
    text,
    indentLevel,
    hierarchyPath,
    parentUID: indentLevel > 0 ? blockStack[indentLevel - 1]?.uid : null,
    parentText: indentLevel > 0 ? blockStack[indentLevel - 1]?.text : null
  };

  blocks.push(block);
}

// Find test case sections
const testCaseSectionNames = ['Test Cases', 'Test cases', 'TestCases'];
const testCaseCandidates = [];
const startsWithTestDoubleColon = [];

for (const block of blocks) {
  // Check if this is a test case section header
  if (testCaseSectionNames.includes(block.text)) {
    // Find all children of this section
    const sectionIndent = block.indentLevel;
    let idx = blocks.indexOf(block) + 1;
    while (idx < blocks.length && blocks[idx].indentLevel > sectionIndent) {
      testCaseCandidates.push(blocks[idx]);
      idx++;
    }
  }

  // Check if starts with "Test::"
  if (block.text.startsWith('Test::')) {
    startsWithTestDoubleColon.push(block);
  }
}

console.log('=== MIGRATION ANALYSIS REPORT ===');
console.log('');
console.log('SUMMARY:');
console.log('  Total blocks in hierarchy:', blocks.length);
console.log('  Test case candidates under "Test Cases" sections:', testCaseCandidates.length);
console.log('  Blocks starting with "Test::":', startsWithTestDoubleColon.length);
console.log('  Total folder/module blocks:', blocks.length - testCaseCandidates.length - startsWithTestDoubleColon.length - 1);
console.log('');
console.log('FIRST 30 TEST CASE CANDIDATES:');
testCaseCandidates.slice(0, 30).forEach((b, i) => {
  console.log(`[${i+1}] UID: ${b.uid}`);
  console.log(`    Text: ${b.text.substring(0, 80)}`);
  console.log(`    Parent: ${b.parentText} (${b.parentUID})`);
  console.log(`    Path: ${b.hierarchyPath}`);
  console.log('');
});

// Save detailed report as JSON
const report = {
  metadata: {
    graphName: 'Project_Kinergy',
    rootPage: 'TestSuite : Kinergy',
    rootUID: pageData.uid,
    analysisDate: new Date().toISOString()
  },
  summary: {
    totalBlocksInHierarchy: blocks.length,
    testCaseCandidates: testCaseCandidates.length,
    blocksStartingWithTestDoubleColon: startsWithTestDoubleColon.length,
    estimatedFoldersModules: blocks.length - testCaseCandidates.length - startsWithTestDoubleColon.length - 1
  },
  candidates: testCaseCandidates.map(b => ({
    uid: b.uid,
    text: b.text,
    parentUID: b.parentUID,
    parentText: b.parentText,
    hierarchyPath: b.hierarchyPath
  })),
  testDoubleColonBlocks: startsWithTestDoubleColon.map(b => ({
    uid: b.uid,
    text: b.text,
    parentUID: b.parentUID,
    parentText: b.parentText,
    hierarchyPath: b.hierarchyPath
  }))
};

fs.writeFileSync('migration-analysis-report.json', JSON.stringify(report, null, 2));
console.log('\n✅ Report saved to: migration-analysis-report.json');

// Also save as CSV
const csv = [
  'UID,Text,Parent UID,Parent Text,Hierarchy Path'
];
testCaseCandidates.forEach(b => {
  csv.push(`"${b.uid}","${b.text.replace(/"/g, '""')}","${b.parentUID}","${b.parentText?.replace(/"/g, '""') || ''}","${b.hierarchyPath.replace(/"/g, '""')}"`);
});
fs.writeFileSync('migration-analysis-report.csv', csv.join('\n'));
console.log('✅ Report also saved to: migration-analysis-report.csv');
