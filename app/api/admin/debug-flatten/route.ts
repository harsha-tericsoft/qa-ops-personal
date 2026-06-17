import { NextRequest, NextResponse } from 'next/server'
import { MarkdownRoamParser } from '@/lib/roam/markdown-parser'
import { readFileSync } from 'fs'

export async function POST(req: NextRequest) {
  try {
    const { uid, markdown } = await req.json()

    if (!markdown) {
      return NextResponse.json({ error: 'markdown required' }, { status: 400 })
    }

    console.log('[debug-flatten] Parsing markdown...')
    const tree = MarkdownRoamParser.parseMarkdown(markdown, 'TestSuite : Kinergy', uid)

    if (!tree) {
      throw new Error('Failed to parse markdown - tree is null')
    }

    console.log('[debug-flatten] Flattening tree...')
    const nodes = MarkdownRoamParser.flattenTree(tree)

    console.log('[debug-flatten] Total nodes:', nodes.length)

    // Analyze
    const withParentId = nodes.filter(n => n.parentId)
    const withoutParentId = nodes.filter(n => !n.parentId)

    return NextResponse.json({
      totalNodes: nodes.length,
      nodesWithParentId: withParentId.length,
      nodesWithoutParentId: withoutParentId.length,
      first10: nodes.slice(0, 10).map(n => ({
        uid: n.uid,
        text: n.text?.substring(0, 40),
        nodeDepth: n.nodeDepth,
        parentId: n.parentId, // ← Show what's actually in parentId
        isTestCase: n.isTestCase,
      })),
      rootNode: {
        uid: nodes[0]?.uid,
        text: nodes[0]?.text,
        parentId: nodes[0]?.parentId,
        depth: nodes[0]?.nodeDepth,
      },
      analysis: withParentId.length === 0 ? 'NO parentId values in flattened array!' : 'parentId values found',
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
