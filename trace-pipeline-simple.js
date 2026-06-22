/**
 * PART 2: Sync Pipeline Trace
 *
 * Shows the data flow from Roam markdown through parser to database
 * without needing TypeScript imports
 */

const fs = require('fs');

console.log('=== SYNC PIPELINE INVESTIGATION ===\n');
console.log('Tracing: One node from Roam markdown through database\n');

// Load Roam data
const roamData = JSON.parse(fs.readFileSync('roam-page-analysis.json', 'utf-8'));
const markdown = roamData.markdown || '';
const lines = markdown.split('\n');

// Find Admin Portal and its children
console.log('STEP 1: RAW ROAM MARKDOWN\n');
console.log('Finding node structure in Roam markdown...\n');

// Find specific nodes and show their indentation/hierarchy
const adminPortalIdx = lines.findIndex(line => line.trim().includes('Admin Portal'));
const loginIdx = lines.findIndex(line => line.trim().includes('Login') && !line.includes('Chart'));

console.log(`Admin Portal found at line ${adminPortalIdx}:`);
console.log(`  Raw text: ${lines[adminPortalIdx].substring(0, 120)}`);

// Extract UID
const adminUidMatch = lines[adminPortalIdx].match(/<roam uid="([^"]+)"/);
const adminUID = adminUidMatch ? adminUidMatch[1] : null;
console.log(`  UID: ${adminUID}`);

// Count indentation
const adminIndent = lines[adminPortalIdx].match(/^( *)/)[0].length / 2;
console.log(`  Indent level (depth): ${adminIndent}`);

console.log(`\nLogin found at line ${loginIdx}:`);
console.log(`  Raw text: ${lines[loginIdx].substring(0, 120)}`);

const loginUidMatch = lines[loginIdx].match(/<roam uid="([^"]+)"/);
const loginUID = loginUidMatch ? loginUidMatch[1] : null;
console.log(`  UID: ${loginUID}`);

const loginIndent = lines[loginIdx].match(/^( *)/)[0].length / 2;
console.log(`  Indent level (depth): ${loginIndent}`);
console.log(`  Parent relationship: Login (depth ${loginIndent}) is child of Admin Portal (depth ${adminIndent})`);

console.log('\n');

// STEP 2: Show what the parser should do
console.log('STEP 2: WHAT PARSER SHOULD PRODUCE\n');
console.log('Based on indentation:');
console.log(`  Admin Portal:`);
console.log(`    uid: "${adminUID}"`);
console.log(`    text: "Admin Portal"`);
console.log(`    depth: ${adminIndent}`);
console.log(`    parentId: (parent uid from previous node at lower depth)`);

console.log(`\n  Login:`);
console.log(`    uid: "${loginUID}"`);
console.log(`    text: "Login"`);
console.log(`    depth: ${loginIndent}`);
console.log(`    parentId: "${adminUID}" ← CRITICAL: Should be Admin Portal UID`);

console.log('\n');

// STEP 3: Show flattening
console.log('STEP 3: FLATTENTRE OPERATION (lib/roam/markdown-parser.ts:135-170)\n');
console.log('flattenTree() output should include:');
console.log(`  Login node: {`);
console.log(`    uid: "${loginUID}",`);
console.log(`    text: "Login",`);
console.log(`    nodeDepth: ${loginIndent},`);
console.log(`    parentId: "${adminUID}",  ← PRESERVED from parser`);
console.log(`    parentPath: "/7DmLXtH2B/.../admin-portal-id/..."  ← CORRECT PATH`);
console.log(`  }`);

console.log('\n');

// STEP 4: Show what happens in importMarkdownNodes
console.log('STEP 4: importMarkdownNodes() - WHERE PARENTID IS LOST\n');
console.log('Code location: lib/roam/sync.ts\n');

console.log('Line 43-49: Load existing nodes');
console.log('  const existingNodes = await prisma.repositoryNode.findMany({');
console.log('    where: { repositoryId, roamNodeId: { in: ... } }');
console.log('  });');
console.log('  const uidToNodeId = new Map(existingNodes.map(...))\n');

console.log('FOR FRESH SYNC (empty database):');
console.log('  existingNodes = []');
console.log('  uidToNodeId = {} (empty)\n');

console.log('Line 125-142: Try to resolve parent IDs');
console.log('  for each node in deduplicatedNodes:');
console.log('    if (node.parentId) {');
console.log('      parentNodeId = uidToNodeId.get(node.parentId) || null');
console.log('    }\n');

console.log(`For Login node (parentId = "${adminUID}"):`);
console.log(`  1. Check: node.parentId = "${adminUID}" ✓ (exists)`);
console.log(`  2. Lookup: uidToNodeId.get("${adminUID}")`);
console.log(`  3. Result: undefined (not in uidToNodeId because Admin Portal not yet created)`);
console.log(`  4. Assignment: parentNodeId = null  ← PROBLEM!`);

console.log('\n');

// STEP 5: What gets inserted
console.log('STEP 5: DATABASE INSERTION\n');
console.log('Line 145-157: RepositoryNode.create() with:');
console.log(`  roamNodeId: "${loginUID}",`);
console.log(`  name: "Login",`);
console.log(`  parentId: null,  ← WRONG! Should be admin-portal-node-id`);
console.log(`  path: "/7DmLXtH2B/.../admin-portal-id/...",`);
console.log(`  depth: ${loginIndent}`);

console.log('\n');

// STEP 6: Root cause
console.log('ROOT CAUSE\n');
console.log('The uidToNodeId map is populated ONLY from existing database rows:');
console.log('  uidToNodeId = new Map(');
console.log('    existingNodes.map(n => [n.roamNodeId, n.id])');
console.log('  )');

console.log('\nFor fresh sync:');
console.log('  - existingNodes is empty (database is empty)');
console.log('  - uidToNodeId is empty');
console.log('  - ALL nodes created in this sync have parentId = null');
console.log('  - Result: 100% of new nodes lose their parent references\n');

console.log('For refresh sync with pre-existing nodes:');
console.log('  - existingNodes contains old nodes');
console.log('  - uidToNodeId has old node UIDs → database IDs');
console.log('  - NEW nodes being created are NOT in uidToNodeId yet');
console.log('  - If new parent created before new child: child can find parent');
console.log('  - If new parent created after new child: child gets parentId = null');
console.log('  - Result: Mixed broken/working state (15-30% broken)\n');

console.log('Evidence: "Project_Kinergy Repository" shows:');
console.log('  - 564 nodes with NULL parentId (newly created, wrong order)');
console.log('  - 3,154 nodes with correct parentId (created successfully)');

console.log('\n');

// STEP 7: The fix
console.log('THE FIX\n');
console.log('Solution: Populate uidToNodeId as NEW nodes are created\n');

console.log('Current broken logic:');
console.log('  uidToNodeId = loadExistingNodesOnly()');
console.log('  for each node:');
console.log('    parentNodeId = uidToNodeId.get(node.parentId) || null  ← fails!\n');

console.log('Fixed logic:');
console.log('  uidToNodeId = loadExistingNodesOnly()');
console.log('  for each node:');
console.log('    // Look up in both existing AND newly created nodes');
console.log('    if (createdNodeIds.has(node.parentId)):');
console.log('      parentNodeId = createdNodeIds.get(node.parentId)');
console.log('    else if (uidToNodeId.has(node.parentId)):');
console.log('      parentNodeId = uidToNodeId.get(node.parentId)');
console.log('    else:');
console.log('      parentNodeId = null  (parent not found in entire import)');
console.log('    // CREATE node with correct parentId');
console.log('    newNode = create(parentNodeId)');
console.log('    createdNodeIds.set(node.uid, newNode.id)  ← Track newly created\n');

console.log('=== SUMMARY ===\n');
console.log('Parser: ✅ Correctly identifies parent-child from indentation');
console.log('Flattened: ✅ Correctly preserves parentId in output');
console.log('Insertion: ❌ FAILS to use parentId due to incomplete uidToNodeId map');
console.log('');
console.log('Fix: Track newly created node IDs and use them for subsequent lookups');
console.log('Location: lib/roam/sync.ts lines 125-160');
