import { createExecutionCycle, getExecutionCycles, getExecutionCycle } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { TestRunStatus } from '@prisma/client'

export interface CreateCycleInput {
  projectId: string
  name: string
  description?: string
  startDate?: Date
  endDate?: Date
  testCaseIds: string[]
}

export interface CycleMetrics {
  total: number
  pass: number
  fail: number
  blocked: number
  notExecuted: number
  passRate: number
}

export async function createCycle(input: CreateCycleInput) {
  const { projectId, name, description, startDate, endDate, testCaseIds } = input

  const cycle = await createExecutionCycle(
    projectId,
    name,
    'PLANNED',
    description,
    startDate?.toISOString(),
    endDate?.toISOString()
  )

  // Create initial ExecutionVersion with default build version
  const version = await prisma.executionVersion.create({
    data: {
      cycleId: cycle.id,
      versionNumber: 1,
      buildVersion: `v1.0.0`,
      status: 'DRAFT',
    },
  })

  // Create test runs for each test case linked to the version
  if (testCaseIds && testCaseIds.length > 0) {
    await prisma.testRun.createMany({
      data: testCaseIds.map((testCaseId) => ({
        cycleId: cycle.id,
        versionId: version.id,
        testCaseId,
        status: 'NOT_EXECUTED',
      })),
    })
  }

  // Return cycle with test runs and versions included
  const fullCycle = await prisma.executionCycle.findUniqueOrThrow({
    where: { id: cycle.id },
    include: {
      testRuns: {
        include: {
          testCase: true,
          comments: {
            orderBy: { createdAt: 'asc' },
          },
          jiraLinks: true,
        },
      },
      versions: true,
    },
  })

  return fullCycle
}

// Optimized: No comments for listing
export async function getCycle(cycleId: string) {
  return prisma.executionCycle.findUnique({
    where: { id: cycleId },
    include: {
      testRuns: {
        include: {
          testCase: true,
        },
      },
    },
  })
}

// Full data with comments (for detailed view)
export async function getCycleWithDetails(cycleId: string) {
  return prisma.executionCycle.findUnique({
    where: { id: cycleId },
    include: {
      testRuns: {
        include: {
          testCase: true,
          comments: {
            orderBy: { createdAt: 'asc' },
          },
          jiraLinks: true,
        },
      },
    },
  })
}

// Optimized: No comments/jiraLinks for better performance
export async function listCycles(projectId: string) {
  return prisma.executionCycle.findMany({
    where: { projectId },
    include: {
      testRuns: {
        include: {
          testCase: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

// Full data with comments/jiraLinks (for specific cycle view)
export async function listCyclesWithDetails(projectId: string) {
  return prisma.executionCycle.findMany({
    where: { projectId },
    include: {
      testRuns: {
        include: {
          testCase: true,
          comments: {
            orderBy: { createdAt: 'asc' },
          },
          jiraLinks: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function updateCycleStatus(cycleId: string, status: string) {
  const cycle = await prisma.executionCycle.update({
    where: { id: cycleId },
    data: { status: status as any },
  })

  return cycle
}

export async function updateRunStatus(runId: string, status: TestRunStatus) {
  const run = await prisma.testRun.update({
    where: { id: runId },
    data: {
      status,
      executedAt: new Date(),
    },
    include: {
      testCase: true,
    },
  })

  return run
}

export async function getCycleMetrics(cycleId: string): Promise<CycleMetrics> {
  const runs = await prisma.testRun.findMany({
    where: { cycleId },
    select: { status: true },
  })

  const total = runs.length
  const pass = runs.filter(r => r.status === 'PASS').length
  const fail = runs.filter(r => r.status === 'FAIL').length
  const blocked = runs.filter(r => r.status === 'BLOCKED').length
  const notExecuted = runs.filter(r => r.status === 'NOT_EXECUTED').length

  return {
    total,
    pass,
    fail,
    blocked,
    notExecuted,
    passRate: total > 0 ? Math.round((pass / total) * 100) : 0,
  }
}

export async function addComment(runId: string, content: string, author?: string) {
  const comment = await prisma.runComment.create({
    data: {
      runId,
      content,
      author,
    },
  })

  return comment
}

export async function deleteComment(commentId: string) {
  await prisma.runComment.delete({
    where: { id: commentId },
  })
}

export async function addJiraLink(
  runId: string,
  issueKey: string,
  issueUrl?: string,
  issueType?: string,
  summary?: string
) {
  const link = await prisma.jiraLink.create({
    data: {
      runId,
      issueKey,
      issueUrl,
      issueType,
      summary,
    },
  })

  return link
}

export async function deleteJiraLink(linkId: string) {
  await prisma.jiraLink.delete({
    where: { id: linkId },
  })
}

export async function addAttachment(
  runId: string,
  name: string,
  url: string,
  mimeType?: string,
  sizeBytes?: number
) {
  const attachment = await prisma.runAttachment.create({
    data: {
      runId,
      name,
      url,
      mimeType,
      sizeBytes,
    },
  })

  return attachment
}

export async function deleteAttachment(attachmentId: string) {
  await prisma.runAttachment.delete({
    where: { id: attachmentId },
  })
}
