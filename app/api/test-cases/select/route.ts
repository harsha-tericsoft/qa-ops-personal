import { NextRequest, NextResponse } from 'next/server'
import {
  selectByRepoNode,
  selectByTags,
  selectBySuite,
  selectBySearch,
} from '@/lib/services/test-selector.service'
import { prisma } from '@/lib/prisma'

// GET /api/test-cases/select
export async function GET(req: NextRequest) {
  const method = req.nextUrl.searchParams.get('method')
  const projectId = req.nextUrl.searchParams.get('projectId')

  if (!method) {
    return NextResponse.json({ error: 'method required' }, { status: 400 })
  }

  try {
    let testCaseIds: string[] = []

    switch (method) {
      case 'REPO_TREE': {
        const nodeId = req.nextUrl.searchParams.get('nodeId')
        if (!nodeId) return NextResponse.json({ error: 'nodeId required' }, { status: 400 })
        testCaseIds = await selectByRepoNode(nodeId)
        break
      }

      case 'TAGS': {
        const tagIdsStr = req.nextUrl.searchParams.get('tagIds')
        const mode = (req.nextUrl.searchParams.get('mode') || 'OR') as 'AND' | 'OR'
        if (!tagIdsStr) return NextResponse.json({ error: 'tagIds required' }, { status: 400 })
        const tagIds = tagIdsStr.split(',')
        testCaseIds = await selectByTags(tagIds, mode)
        break
      }

      case 'SUITE': {
        const suiteId = req.nextUrl.searchParams.get('suiteId')
        if (!suiteId) return NextResponse.json({ error: 'suiteId required' }, { status: 400 })
        testCaseIds = await selectBySuite(suiteId)
        break
      }

      case 'SEARCH': {
        const query = req.nextUrl.searchParams.get('q')
        if (!projectId || !query) {
          return NextResponse.json({ error: 'projectId and q required' }, { status: 400 })
        }
        testCaseIds = await selectBySearch(query, projectId)
        break
      }

      default:
        return NextResponse.json({ error: 'Invalid method' }, { status: 400 })
    }

    // Fetch full test case details
    const testCases = await prisma.testCase.findMany({
      where: { id: { in: testCaseIds } },
      include: { tags: true },
    })

    return NextResponse.json({
      count: testCaseIds.length,
      testCases,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
