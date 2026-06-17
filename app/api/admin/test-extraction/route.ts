import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TestCaseExtractor } from '@/lib/roam/test-case-extractor'

export async function POST() {
  try {
    // Create a test repository if it doesn't exist
    let repository = await prisma.repository.findFirst()
    if (!repository) {
      repository = await prisma.repository.create({
        data: {
          projectId: '79d857b2-36dd-4810-88ae-3ca8d9aaa8d4',
          name: 'Test Repository',
          description: 'For extraction testing',
        },
      })
    }

    const projectId = repository.projectId

    // Create test RepositoryNodes with test markers
    const testNodes = [
      {
        repositoryId: repository.id,
        projectId,
        name: 'Test::LoginFlow',
        slug: 'test-loginflow',
        path: '/test-loginflow',
        depth: 0,
        type: 'FILE',
        roamNodeId: 'uid-1',
        tags: [],
      },
      {
        repositoryId: repository.id,
        projectId,
        name: 'When I enter valid email #Manual',
        slug: 'when-valid-email',
        path: '/test-loginflow/valid-email',
        depth: 1,
        type: 'FILE',
        roamNodeId: 'uid-2',
        tags: ['Manual'],
      },
      {
        repositoryId: repository.id,
        projectId,
        name: 'When I enter invalid email #Manual',
        slug: 'when-invalid-email',
        path: '/test-loginflow/invalid-email',
        depth: 1,
        type: 'FILE',
        roamNodeId: 'uid-3',
        tags: ['Manual'],
      },
      {
        repositoryId: repository.id,
        projectId,
        name: 'Test::PasswordReset',
        slug: 'test-passwordreset',
        path: '/test-passwordreset',
        depth: 0,
        type: 'FILE',
        roamNodeId: 'uid-4',
        tags: [],
      },
      {
        repositoryId: repository.id,
        projectId,
        name: 'Regular folder node',
        slug: 'regular-folder',
        path: '/regular-folder',
        depth: 0,
        type: 'FOLDER',
        roamNodeId: 'uid-5',
        tags: [],
      },
    ]

    // Insert test nodes
    for (const node of testNodes) {
      await prisma.repositoryNode.create({
        data: node as any,
      })
    }

    console.log('[test-extraction] Created', testNodes.length, 'test nodes')

    // Now run the extraction
    const result = await TestCaseExtractor.extractTestCases(repository.id, projectId)

    // Count what was created
    const createdTestCases = await prisma.roamTestCase.findMany({
      where: { projectId },
    })

    return NextResponse.json({
      testMessage: 'Test extraction completed',
      nodesCreated: testNodes.length,
      extractionResult: result,
      roamTestCasesCreated: createdTestCases.length,
      details: createdTestCases,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
