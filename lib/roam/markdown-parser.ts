/**
 * MarkdownRoamParser: Converts Roam markdown hierarchy to structured tree
 * Handles indentation-based nesting and extracts UIDs from roam tags
 */

export interface RoamMarkdownBlock {
  uid: string
  text: string
  depth: number
  children: RoamMarkdownBlock[]
  tags: string[]
  isTestCase: boolean
  isFolder: boolean
}

export class MarkdownRoamParser {
  /**
   * Parse Roam markdown content into a hierarchical tree structure
   * Extracts UIDs, text, indentation depth, and tags (#Manual, #Automation, etc.)
   */
  static parseMarkdown(markdown: string, pageTitle: string, pageUid: string): RoamMarkdownBlock | null {
    const lines = markdown.split('\n')

    // Create root node for the page itself
    const root: RoamMarkdownBlock = {
      uid: pageUid,
      text: pageTitle,
      depth: 0,
      children: [],
      tags: [],
      isTestCase: false,
      isFolder: true, // Root is always a folder
    }

    // Skip the title line (starts with #) and process content
    let currentDepth = 0
    const stack: RoamMarkdownBlock[] = [root]

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()

      if (!line) continue

      // Parse indentation (count leading hyphens or spaces)
      const rawLine = lines[i]
      const indentMatch = rawLine.match(/^(\s*|-)/)
      const indentStr = rawLine.match(/^(\s*)/) ? rawLine.match(/^(\s*)/)![1] : ''
      const depth = Math.floor(indentStr.length / 2) + 1

      // Extract UID from <roam uid="..."/>
      const uidMatch = line.match(/<roam uid="([^"]+)"/)
      if (!uidMatch) continue

      const uid = uidMatch[1]

      // Extract text (remove roam tags and inline images)
      let text = line
        .replace(/<roam uid="[^"]*"[^>]*\/?>/g, '') // Remove roam tags
        .replace(/!\[\]\([^)]*\)/g, '') // Remove inline images
        .replace(/\[\[([^\]]*)\]\]/g, '$1') // Convert [[link]] to link
        .replace(/^-\s*/, '') // Remove leading dash
        .trim()

      // Extract tags (e.g., #Manual, #Automation)
      const tags = (text.match(/#(\w+)/g) || []).map((tag) => tag.substring(1))

      // Classify as test case or folder
      const isTestCase = this.isTestCaseNode(text, tags)
      const isFolder = this.isFolderNode(text, tags, depth)

      const block: RoamMarkdownBlock = {
        uid,
        text,
        depth,
        children: [],
        tags,
        isTestCase,
        isFolder,
      }

      // Find parent based on depth
      while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
        stack.pop()
      }

      const parent = stack[stack.length - 1]
      if (parent) {
        parent.children.push(block)
      }

      stack.push(block)
    }

    return root
  }

  /**
   * Determine if a node represents a test case
   * Test cases are leaf nodes under "Test Cases" or nodes starting with "Test::"
   */
  private static isTestCaseNode(text: string, tags: string[]): boolean {
    if (text.startsWith('Test::')) return true
    // Leaf nodes (no markdown indicators) under test sections
    if (text.includes('When ') || text.includes('Then ') || text.includes('Given ')) return true
    // Nodes with #Manual or #Automation tags are test cases
    if (tags.includes('Manual') || tags.includes('Automation')) return true

    return false
  }

  /**
   * Determine if a node should be treated as a folder
   * Folders are container nodes like test suites, test types, screens, etc.
   */
  private static isFolderNode(text: string, tags: string[], depth: number): boolean {
    // Explicitly test case nodes are not folders
    if (text.includes('When ') || text.includes('Then ') || text.includes('Given ')) return false

    // Check for folder patterns
    if (text.includes('TestType/')) return true
    if (text.includes('Test Cases')) return true
    if (text.includes('Screen ')) return true
    if (text.includes('Suite')) return true
    if (text.includes('Portal')) return true
    if (text.match(/^##\s*\[\[/)) return true // Headers with links

    // Assume non-leaf nodes are folders
    return true
  }

  /**
   * Flatten tree into list for database insertion
   * Includes parent path information for hierarchy
   */
  static flattenTree(
    block: RoamMarkdownBlock,
    parentId: string | null = null,
    parentPath: string = '/'
  ): Array<RoamMarkdownBlock & { parentId: string | null; parentPath: string; nodeDepth: number }> {
    const result: Array<RoamMarkdownBlock & { parentId: string | null; parentPath: string; nodeDepth: number }> = []

    const nodePath = parentPath === '/' ? `/${block.uid}` : `${parentPath}/${block.uid}`

    if (block.uid) {
      // Root node (pageTitle as root)
      if (parentId === null && block.text) {
        result.push({
          ...block,
          parentId: null,
          parentPath: '/',
          nodeDepth: 0,
        })
      } else if (parentId) {
        result.push({
          ...block,
          parentId,
          parentPath: nodePath,
          nodeDepth: block.depth,
        })
      }
    }

    // Process children
    for (const child of block.children) {
      const childResults = this.flattenTree(child, block.uid || parentId, nodePath)
      result.push(...childResults)
    }

    return result
  }
}
