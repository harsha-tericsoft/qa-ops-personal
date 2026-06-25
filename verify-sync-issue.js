const { prisma } = require('@/lib/prisma')
const { MarkdownRoamParser } = require('@/lib/roam/markdown-parser')

async function check() {
  // The markdown that roam-cli returns for the root page
  const mockMarkdown = `# TestSuite : Kinergy <roam uid="7DmLXtH2B" refs="1" hiddenChildren="1"/>`

  console.log('='.repeat(70))
  console.log('SYNC DATA FLOW VERIFICATION')
  console.log('='.repeat(70))
  console.log('')

  console.log('INPUT: Markdown from roam search:')
  console.log(mockMarkdown)
  console.log('')

  console.log('PARSING...')
  const tree = MarkdownRoamParser.parseMarkdown(mockMarkdown, 'TestSuite : Kinergy', '7DmLXtH2B')

  console.log('PARSE RESULT:')
  console.log(`  Tree children: ${tree?.children?.length || 0}`)
  console.log('')

  const nodes = MarkdownRoamParser.flattenTree(tree)
  console.log(`FLATTENED NODES: ${nodes.length}`)
  nodes.forEach((n, i) => {
    console.log(`  ${i+1}. ${n.name.substring(0, 50)}...`)
  })

  console.log('')
  console.log('DIAGNOSIS:')
  if (nodes.length === 0) {
    console.log('❌ NO NODES EXTRACTED')
    console.log('')
    console.log('ROOT CAUSE:')
    console.log('The roam search returns only the page header with "hiddenChildren=1"')
    console.log('The markdown has NO content - just the page title tag')
    console.log('Therefore, NO nested content is parsed or extracted')
    console.log('')
    console.log('IMPACT:')
    console.log('✗ New test cases you add to Roam will NOT be imported')
    console.log('✗ The sync reports SUCCESS (endpoint responds 200) but does nothing')
    console.log('✗ Sync log shows created: 0, updated: 0 (invisible because logging is incomplete)')
  } else {
    console.log(`✓ ${nodes.length} nodes would be extracted`)
  }
}

check().catch(console.error)
