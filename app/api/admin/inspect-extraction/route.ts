import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Count nodes that match test case criteria
    const allNodes = await prisma.repositoryNode.findMany({
      select: {
        id: true,
        name: true,
        tags: true,
      },
    })

    // Apply extraction logic
    const testCaseCandidates = allNodes.filter(node => {
      const name = node.name || ''
      const tags = node.tags || []

      return (
        name.startsWith('Test::') ||
        name.startsWith('Test:') ||
        tags.includes('Manual') ||
        tags.includes('Automation')
      )
    })

    // Check what was actually created
    const createdTestCases = await prisma.roamTestCase.findMany()

    return NextResponse.json({
      totalRepositoryNodes: allNodes.length,
      potentialTestCases: testCaseCandidates.length,
      testCaseCandidatesExample: testCaseCandidates.slice(0, 5),
      createdRoamTestCases: createdTestCases.length,
      issueSummary: {
        candidatesFound: testCaseCandidates.length,
        createdInDB: createdTestCases.length,
        missing: testCaseCandidates.length - createdTestCases.length,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
