/**
 * MarkdownRoamParser: Converts Roam markdown hierarchy to structured tree
 * Handles indentation-based nesting and extracts UIDs from roam tags
 */

export interface RoamMarkdownBlock {
  uid: string
  text: string
  depth: number
  order: number  // Sibling order from Roam (0-indexed)
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
      order: 0,  // Root always has order 0
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

      // IMPORTANT: Do NOT classify as test case here.
      // Classification happens LATER in TestCaseExtractor, AFTER sync completes.
      // The parser's only job is to build the hierarchy.

      // Find parent based on depth
      while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
        stack.pop()
      }

      const parent = stack[stack.length - 1]
      const siblingOrder = parent ? parent.children.length : 0  // Track position among siblings

      const block: RoamMarkdownBlock = {
        uid,
        text,
        depth,
        order: siblingOrder,  // Preserve sibling order from Roam
        children: [],
        tags,
        isTestCase: false,  // Will be determined by TestCaseExtractor
        isFolder: false,  // Will be determined after tree is complete
      }

      if (parent) {
        parent.children.push(block)
        if (uid === 'k9IcSszSC') {
          console.log(`[DEBUG] Added item 49 as child of: ${parent.text}`)
        }
      } else {
        if (uid === 'k9IcSszSC') {
          console.log(`[DEBUG] No parent found for item 49! Stack length: ${stack.length}`)
        }
      }

      stack.push(block)
    }

    return root
  }

  /**
   * IMPORTANT: Removed test case classification from parser.
   * The parser's ONLY job is to build the hierarchy.
   * Test case classification happens later in TestCaseExtractor.
   *
   * Nodes are classified as FOLDER if they have children, FILE otherwise.
   */
  private static isFolderNode(block: RoamMarkdownBlock): boolean {
    // A node is a folder if it has children
    return block.children && block.children.length > 0
  }

  /**
   * Flatten tree into list for database insertion
   * Includes parent path information for hierarchy and sibling order
   */
  static flattenTree(
    block: RoamMarkdownBlock,
    parentId: string | null = null,
    parentPath: string = '/'
  ): Array<RoamMarkdownBlock & { parentId: string | null; parentPath: string; nodeDepth: number }> {
    const result: Array<RoamMarkdownBlock & { parentId: string | null; parentPath: string; nodeDepth: number }> = []

    const nodePath = parentPath === '/' ? `/${block.uid}` : `${parentPath}/${block.uid}`

    if (block.uid) {
      // Determine if this node is a folder based on whether it has children
      const isFolder = block.children && block.children.length > 0

      // Root node (pageTitle as root)
      if (parentId === null && block.text) {
        result.push({
          ...block,
          parentId: null,
          parentPath: '/',
          nodeDepth: 0,
          isFolder,  // Set based on actual children
          order: 0,  // Root always has order 0
        })
      } else if (parentId) {
        result.push({
          ...block,
          parentId,
          parentPath: nodePath,
          nodeDepth: block.depth,
          isFolder,  // Set based on actual children
          // order is already set from parser, keep it
        })
      }
    }

    // Process children - they preserve their sibling order from parser
    for (const child of block.children) {
      const childResults = this.flattenTree(child, block.uid || parentId, nodePath)
      result.push(...childResults)
    }

    return result
  }
}
