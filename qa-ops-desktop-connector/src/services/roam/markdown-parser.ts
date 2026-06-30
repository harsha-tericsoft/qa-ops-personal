/**
 * Minimal markdown parser extracted from QA Ops
 * Converts Roam markdown hierarchy to structured tree
 * Handles indentation-based nesting and extracts UIDs from roam tags
 */

export interface RoamMarkdownBlock {
  uid: string
  text: string
  depth: number
  children: RoamMarkdownBlock[]
}

export class MarkdownRoamParser {
  /**
   * Parse Roam markdown content into a hierarchical tree structure
   * Extracts UIDs, text, and indentation depth
   */
  static parseMarkdown(markdown: string, pageTitle: string, pageUid: string): RoamMarkdownBlock | null {
    const parseStart = Date.now()
    const lines = markdown.split('\n')
    console.log('[parseMarkdown] START with', lines.length, 'lines')

    // Create root node for the page itself
    const root: RoamMarkdownBlock = {
      uid: pageUid,
      text: pageTitle,
      depth: 0,
      children: [],
    }

    // Skip the title line (starts with #) and process content
    const stack: RoamMarkdownBlock[] = [root]

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()

      if (!line) continue

      // Parse indentation (count leading spaces)
      const rawLine = lines[i]
      const indentStr = rawLine.match(/^(\s*)/)?.[1] || ''
      const depth = Math.floor(indentStr.length / 2) + 1

      // Extract UID from <roam uid="..."/>
      const uidMatch = line.match(/<roam uid="([^"]+)"/)
      if (!uidMatch) continue

      const uid = uidMatch[1]

      // Extract text (remove roam tags and clean up)
      let text = line
        .replace(/<roam uid="[^"]*"[^>]*\/?>/g, '') // Remove roam tags
        .replace(/!\[\]\([^)]*\)/g, '') // Remove inline images
        .replace(/\[\[([^\]]*)\]\]/g, '$1') // Convert [[link]] to link
        .replace(/^-\s*/, '') // Remove leading dash
        .trim()

      // Find parent based on depth
      while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
        stack.pop()
      }

      const parent = stack[stack.length - 1]

      const block: RoamMarkdownBlock = {
        uid,
        text,
        depth,
        children: [],
      }

      if (parent) {
        parent.children.push(block)
      }

      stack.push(block)
    }

    const elapsed = Date.now() - parseStart
    console.log('[parseMarkdown] END - Parsed', lines.length - 1, 'lines in', elapsed, 'ms')

    return root
  }
}
