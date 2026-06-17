import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const repositoryCount = await prisma.repository.count()
    const repositoryNodeCount = await prisma.repositoryNode.count()
    const roamTestCaseCount = await prisma.roamTestCase.count()
    const roamConfigCount = await prisma.roamConfig.count()

    return NextResponse.json({
      repositoryCount,
      repositoryNodeCount,
      roamTestCaseCount,
      roamConfigCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
