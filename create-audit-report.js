const fs = require('fs');

// Remove BOM if present
function readJSON(filename) {
  let jsonStr = fs.readFileSync(filename, 'utf-8');
  if (jsonStr.charCodeAt(0) === 0xFEFF) {
    jsonStr = jsonStr.slice(1);
  }
  return JSON.parse(jsonStr);
}

// Parse markdown to get blocks
function parseMarkdownBlocks(markdown) {
  const lines = markdown.split('\n');
  const blocks = [];
  const blockStack = [];

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

    blocks.push({
      uid,
      text,
      indentLevel,
      hierarchyPath,
      parentUID: indentLevel > 0 ? blockStack[indentLevel - 1]?.uid : null,
      parentText: indentLevel > 0 ? blockStack[indentLevel - 1]?.text : null
    });
  }

  return blocks;
}

console.log('=== ROAM AUDIT REPORT ===\n');
console.log('Reading Roam graph data...\n');

// Try to load from the new audit file first, fall back to analysis
let pageData;
try {
  pageData = readJSON('roam-page-audit.json');
  console.log('✅ Loaded from roam-page-audit.json');
} catch (e) {
  console.log('Using roam-page-analysis.json instead');
  pageData = readJSON('roam-page-analysis.json');
}

const markdown = pageData.markdown || '';
const blocks = parseMarkdownBlocks(markdown);

console.log(`Total blocks in graph: ${blocks.length}\n`);

// Count different prefix patterns
const counts = {
  'Test::': 0,
  'Test:: Test::': 0,
  'Test:': 0,
  'Test: Test:': 0,
  'Other': 0
};

const examples = {
  'Test:: Test::': [],
  'Test:': [],
  'Test: Test:': [],
  'nonPrefixedUnderTestCases': []
};

const testCaseSectionNames = ['Test Cases', 'Test cases', 'TestCases'];
let inTestCaseSection = false;
let testCaseSectionIndent = -1;

for (const block of blocks) {
  const text = block.text;

  // Check if entering/leaving test case section
  if (testCaseSectionNames.includes(text)) {
    inTestCaseSection = true;
    testCaseSectionIndent = block.indentLevel;
  } else if (inTestCaseSection && block.indentLevel <= testCaseSectionIndent) {
    inTestCaseSection = false;
  }

  // Count prefix patterns
  if (text.startsWith('Test:: Test::')) {
    counts['Test:: Test::']++;
    if (examples['Test:: Test::'].length < 50) {
      examples['Test:: Test::'].push({
        uid: block.uid,
        text: text.substring(0, 120),
        path: block.hierarchyPath
      });
    }
  } else if (text.startsWith('Test::')) {
    counts['Test::']++;
  } else if (text.startsWith('Test: Test:')) {
    counts['Test: Test:']++;
    if (examples['Test: Test:'].length < 50) {
      examples['Test: Test:'].push({
        uid: block.uid,
        text: text.substring(0, 120),
        path: block.hierarchyPath
      });
    }
  } else if (text.startsWith('Test:')) {
    counts['Test:']++;
    if (examples['Test:'].length < 50) {
      examples['Test:'].push({
        uid: block.uid,
        text: text.substring(0, 120),
        path: block.hierarchyPath
      });
    }
  } else {
    counts['Other']++;

    // Track blocks under Test Cases that don't have Test:: prefix
    if (inTestCaseSection && block.indentLevel > testCaseSectionIndent) {
      if (examples['nonPrefixedUnderTestCases'].length < 50) {
        examples['nonPrefixedUnderTestCases'].push({
          uid: block.uid,
          text: text.substring(0, 120),
          path: block.hierarchyPath,
          parentSection: block.parentText
        });
      }
    }
  }
}

console.log('=== PREFIX PATTERN COUNTS ===\n');
console.log(`Blocks starting with "Test::" only:     ${counts['Test::']}  (correct)`);
console.log(`Blocks starting with "Test:: Test::":   ${counts['Test:: Test::']}  (DUPLICATED - ERROR)`);
console.log(`Blocks starting with "Test:" (single):  ${counts['Test:']}  (wrong format)`);
console.log(`Blocks starting with "Test: Test:":     ${counts['Test: Test:']}  (wrong format)`);
console.log(`Blocks with other/no prefix:            ${counts['Other']}`);
console.log(`Total blocks:                           ${blocks.length}\n`);

// Calculate statistics
const correctPrefixes = counts['Test::'];
const totalPrefixed = counts['Test::'] + counts['Test:: Test::'] + counts['Test:'] + counts['Test: Test:'];
const errorRate = (counts['Test:: Test::'] / totalPrefixed * 100).toFixed(2);

console.log('=== ANALYSIS ===\n');
console.log(`Correct "Test::" prefix:  ${correctPrefixes} (${(correctPrefixes/blocks.length*100).toFixed(1)}% of all blocks)`);
console.log(`Duplicate prefix errors:  ${counts['Test:: Test::']} (${errorRate}% of prefixed blocks)`);
console.log(`Non-prefixed under Test Cases: ${examples['nonPrefixedUnderTestCases'].length} shown in sample\n`);

// Create audit report
const auditReport = {
  timestamp: new Date().toISOString(),
  graphName: 'Project_Kinergy',
  rootPage: 'TestSuite : Kinergy',
  totalBlocksInGraph: blocks.length,
  prefixPatternCounts: counts,
  statistics: {
    correctPrefixCount: correctPrefixes,
    duplicatePrefixCount: counts['Test:: Test::'],
    wrongFormatCount: counts['Test:'] + counts['Test: Test:'],
    unprefixedCount: counts['Other'],
    correctPercentage: (correctPrefixes / blocks.length * 100).toFixed(2),
    duplicateErrorRate: errorRate
  },
  examples: {
    duplicatePrefixes: examples['Test:: Test::'],
    duplicatePrefixCount: examples['Test:: Test::'].length,
    wrongFormatTestColon: examples['Test:'].concat(examples['Test: Test:']),
    wrongFormatCount: examples['Test:'].length + examples['Test: Test:'].length,
    nonPrefixedUnderTestCases: examples['nonPrefixedUnderTestCases'],
    nonPrefixedCount: examples['nonPrefixedUnderTestCases'].length
  }
};

// Save report
fs.writeFileSync('audit-report.json', JSON.stringify(auditReport, null, 2));

console.log('=== EXAMPLES: DUPLICATE PREFIXES (Test:: Test::) ===\n');
examples['Test:: Test::'].slice(0, 10).forEach((ex, i) => {
  console.log(`[${i + 1}] UID: ${ex.uid}`);
  console.log(`    Text: ${ex.text}`);
  console.log(`    Path: ${ex.path}\n`);
});
if (examples['Test:: Test::'].length > 10) {
  console.log(`... and ${examples['Test:: Test::'].length - 10} more\n`);
}

console.log('=== EXAMPLES: NON-PREFIXED UNDER "Test Cases" ===\n');
examples['nonPrefixedUnderTestCases'].slice(0, 10).forEach((ex, i) => {
  console.log(`[${i + 1}] UID: ${ex.uid}`);
  console.log(`    Text: ${ex.text}`);
  console.log(`    Parent: ${ex.parentSection}`);
  console.log(`    Path: ${ex.path}\n`);
});
if (examples['nonPrefixedUnderTestCases'].length > 10) {
  console.log(`... and ${examples['nonPrefixedUnderTestCases'].length - 10} more\n`);
}

console.log('✅ Full audit report saved to: audit-report.json\n');
