const { exec } = require('child_process')
const { promisify } = require('util')
const { MarkdownRoamParser } = require('./lib/roam/markdown-parser')

const execAsync = promisify(exec)

async function testParsing() {
  console.log('Testing roam get-page + markdown parsing...')
  console.log('')

  try {
    // Get the page with roam get-page
    const { stdout } = await execAsync(`roam get-page --graph "Project_Kinergy" --title "TestSuite : Kinergy"`)
    const response = JSON.parse(stdout)

    console.log(`Page UID: ${response.uid}`)
    console.log(`Markdown length: ${response.markdown.length}`)
    console.log(`First 300 chars:`)
    console.log(response.markdown.substring(0, 300))
    console.log('')

    // Parse it
    console.log('Parsing markdown tree...')
    const tree = MarkdownRoamParser.parseMarkdown(response.markdown, 'TestSuite : Kinergy', response.uid)

    if (!tree) {
      console.log('❌ parseMarkdown returned null')
      return
    }

    console.log(`Root children: ${tree.children?.length || 0}`)

    // Flatten and count
    const nodes = MarkdownRoamParser.flattenTree(tree)
    console.log(`Flattened nodes: ${nodes.length}`)
    console.log('')

    if (nodes.length > 0) {
      console.log('First 5 nodes:')
      nodes.slice(0, 5).forEach((n, i) => {
        console.log(`  ${i+1}. ${n.text.substring(0, 60)}... (uid: ${n.uid})`)
      })
    } else {
      console.log('❌ No nodes extracted!')
    }

  } catch (error) {
    console.error('Error:', error.message)
  }
}

testParsing()
