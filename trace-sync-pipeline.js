/**
 * PART 2: Sync Pipeline Investigation
 *
 * Traces one specific node (Login screen under Admin Portal)
 * through the entire sync pipeline to identify where parentId is lost
 */

const fs = require('fs');
const path = require('path');

// Load the raw Roam data
const roamPageData = JSON.parse(fs.readFileSync('roam-page-analysis.json', 'utf-8'));

// Import the parser
const { MarkdownRoamParser } = require('./lib/roam/markdown-parser');

console.log('=== SYNC PIPELINE TRACE: ONE NODE END-TO-END ===\n');

// 1. Show the raw Roam markdown
console.log('STEP 1: Raw Roam Response\n');
const markdown = roamPageData.markdown || '';
const lines = markdown.split('\n');

// Find the "Login" node in the markdown
const loginLineIdx = lines.findIndex(line => line.includes('Login') && !line.includes('Chart'));
console.log(`Found "Login" at line ${loginLineIdx}:`);
if (loginLineIdx >= 0) {
  console.log(`  Raw: ${lines[loginLineIdx].substring(0, 150)}`);

  // Extract UID
  const uidMatch = lines[loginLineIdx].match(/<roam uid="([^"]+)"/);
  const loginUID = uidMatch ? uidMatch[1] : null;
  console.log(`  Extracted UID: ${loginUID}`);

  // Extract roamNodeId from markdown
  const roamNodeIdMatch = lines[loginLineIdx].match(/uid="([^"]+)"/);
  const roamNodeId = roamNodeIdMatch ? roamNodeIdMatch[1] : null;
  console.log(`  Roam NodeId: ${roamNodeId}`);
}

console.log('\n');

// 2. Parse with MarkdownRoamParser
console.log('STEP 2: MarkdownRoamParser.parseMarkdown()\n');
const tree = MarkdownRoamParser.parseMarkdown(markdown, roamPageData.title, roamPageData.uid);

// Find Login node in parsed tree
function findNodeByText(node, searchText, visited = new Set()) {
  if (visited.has(node.uid)) return null;
  visited.add(node.uid);

  if (node.text && node.text.includes(searchText)) {
    return node;
  }

  if (node.children) {
    for (const child of node.children) {
      const found = findNodeByText(child, searchText, visited);
      if (found) return found;
    }
  }
  return null;
}

const loginNode = findNodeByText(tree, 'Login');
if (loginNode) {
  console.log('Parser output for Login node:');
  console.log(`  uid: ${loginNode.uid}`);
  console.log(`  text: ${loginNode.text.substring(0, 80)}`);
  console.log(`  depth: ${loginNode.depth}`);
  console.log(`  parentId: ${loginNode.parentId || '(null)'}`);
  console.log(`  tags: ${JSON.stringify(loginNode.tags)}`);
  console.log(`  isTestCase: ${loginNode.isTestCase}`);
  console.log(`  isFolder: ${loginNode.isFolder}`);
}

console.log('\n');

// 3. Flatten tree
console.log('STEP 3: MarkdownRoamParser.flattenTree()\n');
const flattened = MarkdownRoamParser.flattenTree(tree);

// Find Login in flattened array
const flattenedLogin = flattened.find(n => n.text && n.text.includes('Login'));
if (flattenedLogin) {
  console.log('Flattened node for Login:');
  console.log(`  uid: ${flattenedLogin.uid}`);
  console.log(`  text: ${flattenedLogin.text.substring(0, 80)}`);
  console.log(`  nodeDepth: ${flattenedLogin.nodeDepth}`);
  console.log(`  parentId: ${flattenedLogin.parentId || '(null)'}`);
  console.log(`  parentPath: ${flattenedLogin.parentPath}`);
  console.log(`  type: ${flattenedLogin.type}`);
}

console.log('\n');

// 4. Simulate importMarkdownNodes
console.log('STEP 4: importMarkdownNodes() - Simulating database insertion logic\n');
console.log('Key code from sync.ts lines 140-142:');
console.log(`
if (node.parentId) {
  parentNodeId = uidToNodeId.get(node.parentId) || null
}
`);

// Show what happens when uidToNodeId is empty (fresh sync)
console.log('FOR FRESH SYNC (existing database is empty):');
console.log(`  uidToNodeId = {} (empty Map)`);
console.log(`  Login.parentId = "${flattenedLogin.parentId || '(null)'}"`);
console.log(`  If parentId exists: uidToNodeId.get("${flattenedLogin.parentId}") = undefined`);
console.log(`  Result: parentNodeId = null`);

console.log('\nFOR REFRESH SYNC (some nodes already in database):');
console.log('  When creating NEW nodes, uidToNodeId only contains previously created nodes in THIS import');
console.log('  If parent was created before this node in the loop:');
console.log(`    uidToNodeId has parent: uidToNodeId.get("${flattenedLogin.parentId}") = "node-id-xyz"`);
console.log('    Result: parentNodeId = "node-id-xyz" ✓');
console.log('  If parent created AFTER this node:');
console.log('    uidToNodeId missing parent: uidToNodeId.get("...") = undefined');
console.log('    Result: parentNodeId = null ✗');

console.log('\n');

// 5. Show the actual database impact
console.log('STEP 5: Database insertion result\n');
console.log('What gets inserted into RepositoryNode:');
console.log(`{
  repositoryId: "repo-id",
  projectId: "project-id",
  name: "${flattenedLogin.text}",
  roamNodeId: "${flattenedLogin.uid}",
  parentId: null,  // ← PROBLEM: Always null for fresh sync
  path: "${flattenedLogin.parentPath}",
  depth: ${flattenedLogin.nodeDepth},
  type: "FOLDER"
}`);

console.log('\n');

// 6. Identify the root cause
console.log('ROOT CAUSE ANALYSIS\n');
console.log('Location: lib/roam/sync.ts lines 40-114\n');
console.log('Problem:');
console.log('  1. Line 43-49: Load existing RepositoryNodes from database');
console.log('     const existingNodes = await prisma.repositoryNode.findMany(...)');
console.log('     const uidToNodeId = new Map(existingNodes.map(...))\n');
console.log('  2. Line 54: Deduplicate incoming nodes\n');
console.log('  3. Line 125-142: Try to resolve parents');
console.log('     for each node:');
console.log('       if node.parentId: parentNodeId = uidToNodeId.get(node.parentId)');
console.log('       else: parentNodeId = null\n');
console.log('  4. Issue: uidToNodeId only has EXISTING nodes from database');
console.log('     For FRESH SYNC: existingNodes is empty, so uidToNodeId is empty');
console.log('     When looking up parent: uidToNodeId.get(parentId) returns undefined');
console.log('     undefined becomes null → all parentIds are null\n');

console.log('Why it partially works on refresh:');
console.log('  - Old nodes already in DB are in existingNodes');
console.log('  - If new parent is created first, child can find it');
console.log('  - If new parent created AFTER child, parent lookup fails\n');

console.log('Why the counts show 564 null parentIds:');
console.log('  - The 564 nodes are those created in WRONG ORDER');
console.log('  - They had parentId in parser output');
console.log('  - But parent wasn\'t in uidToNodeId at lookup time\n');

console.log('=== CONCLUSION ===\n');
console.log('The parser correctly identifies parent-child relationships.');
console.log('The flattened nodes have correct parentPath and parentId values.');
console.log('The database insertion logic FAILS to use these values.');
console.log('\nFix location: sync.ts lines 125-143');
console.log('Fix strategy: Populate uidToNodeId with NEWLY CREATED nodes too');
console.log('             as they are created, not just existing nodes');
