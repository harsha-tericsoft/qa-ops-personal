// Comprehensive pipeline debug - manually trace item 49

const fs = require('fs')
const path = require('path')

// Load actual roam response
const roamFile = 'C:/Users/harsh/.claude/projects/C--Users-harsh-ClaudeCode-Assignment3-qa-ops/fd9ae681-5d2b-4582-a9bb-a3299fd01c15/tool-results/b2n33fmfd.txt'
const content = fs.readFileSync(roamFile, 'utf-8')
const jsonMatch = content.match(/\{[\s\S]*\}/)
const data = JSON.parse(jsonMatch[0])
const markdown = data['markdown']
const pageUid = data['uid']

console.log('TRACE: Item 49 through sync pipeline')
console.log('='.repeat(70))
console.log('')

// STAGE 1: Verify in markdown
console.log('STAGE 1: roam get-page markdown')
console.log('-'.repeat(70))
const inMarkdown = markdown.includes('k9IcSszSC')
console.log(`Block in markdown: ${inMarkdown ? 'YES' : 'NO'}`)

if (!inMarkdown) {
  console.log('STOP: Block not in source')
  process.exit(1)
}

// STAGE 2: Manual parse simulation
console.log('')
console.log('STAGE 2: Simulate MarkdownRoamParser.parseMarkdown')
console.log('-'.repeat(70))

const lines = markdown.split('\n')
const root = {
  uid: pageUid,
  text: 'TestSuite : Kinergy',
  depth: 0,
  children: [],
  tags: [],
  isTestCase: false,
  isFolder: false
}

const stack = [root]
let item49InTree = null

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim()
  if (!line) continue

  const rawLine = lines[i]
  const indentMatch = rawLine.match(/^(\s*)/)
  const indentStr = indentMatch ? indentMatch[1] : ''
  const depth = Math.floor(indentStr.length / 2) + 1

  const uidMatch = line.match(/<roam uid="([^"]+)"/)
  if (!uidMatch) continue

  const uid = uidMatch[1]
  const text = line.replace(/<roam uid="[^"]*"[^>]*\/?>/g, '').trim()
  const tags = (text.match(/#(\w+)/g) || []).map(tag => tag.substring(1))

  const block = {
    uid,
    text,
    depth,
    children: [],
    tags,
    isTestCase: false,
    isFolder: false
  }

  // Find parent
  while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
    stack.pop()
  }

  const parent = stack[stack.length - 1]
  if (parent) {
    parent.children.push(block)
  }

  stack.push(block)

  if (uid === 'k9IcSszSC') {
    console.log(`Found item 49 at line ${i}`)
    console.log(`  Depth: ${depth}`)
    console.log(`  Parent: ${parent ? parent.text.substring(0, 50) : 'NONE'}`)
    console.log(`  Added to parent: ${parent ? 'YES' : 'NO'}`)
    item49InTree = block
  }
}

if (!item49InTree) {
  console.log('Item 49 NOT created in parseMarkdown')
  process.exit(1)
}

console.log('')
console.log('Item 49 found in parsed tree: YES')

// STAGE 3: Simulate flattenTree
console.log('')
console.log('STAGE 3: Simulate MarkdownRoamParser.flattenTree')
console.log('-'.repeat(70))

const flatList = []

function flatten(block, parentId = null, parentPath = '/') {
  const nodePath = parentPath === '/' ? `/${block.uid}` : `${parentPath}/${block.uid}`
  const isFolder = block.children && block.children.length > 0

  if (block.uid) {
    if (parentId === null && block.text) {
      flatList.push({
        uid: block.uid,
        text: block.text,
        parentId: null,
        nodeDepth: 0,
        isFolder
      })
    } else if (parentId) {
      flatList.push({
        uid: block.uid,
        text: block.text,
        parentId,
        nodeDepth: block.depth,
        isFolder
      })
    }
  }

  for (const child of block.children || []) {
    flatten(child, block.uid || parentId, nodePath)
  }
}

flatten(root)

const item49Flat = flatList.find(n => n.uid === 'k9IcSszSC')

if (!item49Flat) {
  console.log('Item 49 NOT in flattened list')
  console.log('')
  console.log('Checking why...')

  // Find the parent in flat list
  const parentFlat = flatList.find(n => n.uid === 'IDAyUMqNe')
  if (parentFlat) {
    console.log(`Parent (Test cases) IS in flattened list`)
    console.log(`  parentId: ${parentFlat.parentId}`)
  } else {
    console.log(`Parent (Test cases) NOT in flattened list`)
  }

  process.exit(1)
}

console.log('Item 49 in flattened list: YES')
console.log(`  parentId: ${item49Flat.parentId}`)
console.log(`  nodeDepth: ${item49Flat.nodeDepth}`)
console.log(`  isFolder: ${item49Flat.isFolder}`)

console.log('')
console.log('SUCCESS: Item 49 made it through parser and flattener')
console.log('Next stage (importMarkdownNodes) requires database')

// Show stats
const folders = flatList.filter(n => n.isFolder).length
const files = flatList.filter(n => !n.isFolder).length

console.log('')
console.log(`Total nodes in flattened list: ${flatList.length}`)
console.log(`  Folders: ${folders}`)
console.log(`  Files: ${files}`)

