import { PrismaClient, RunStatus } from '@/app/generated/prisma'

const prisma = new PrismaClient()

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

  const cycle = await prisma.executionCycle.create({
    data: {
      projectId,
      name,
      description,
      startDate,
      endDate,
      testRuns: {
        createMany: {
          data: testCaseIds.map(testCaseId => ({
            testCaseId,
          })),
        },
      },
    },
    include: {
      testRuns: true,
    },
  })

  return cycle
}

export async function getCycle(cycleId: string) {
  const cycle = await prisma.executionCycle.findUniqueOrThrow({
    where: { id: cycleId },
    include: {
      testRuns: {
        include: {
          testCase: true,
          comments: true,
          jiraLinks: true,
          attachments: true,
        },
      },
    },
  })

  return cycle
}

export async function listCycles(projectId: string) {
  const cycles = await prisma.executionCycle.findMany({
    where: { projectId },
    include: {
      testRuns: {
        select: {
          status: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return cycles
}

export async function updateCycleStatus(cycleId: string, status: string) {
  const cycle = await prisma.executionCycle.update({
    where: { id: cycleId },
    data: { status: status as any },
  })

  return cycle
}

export async function updateRunStatus(runId: string, status: RunStatus) {
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
