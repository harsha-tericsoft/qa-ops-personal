import { NextRequest, NextResponse } from 'next/server'
import { createTestSuite } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { PerformanceMonitor } from '@/lib/performance-monitor'
import { randomUUID } from 'crypto'

// GET /api/test-suites
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  const perfMonitor = new PerformanceMonitor()

  perfMonitor.mark('parse-params')

  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  try {
    // OPTIMIZATION: Support minimal parameter for fast listing
    const minimal = req.nextUrl.searchParams.get('minimal') === 'true'

    if (minimal) {
      // Lightweight response for dropdowns (no testCases data)
      console.log(`[API] GET /api/test-suites (minimal=true)`)
      const suites = await prisma.testSuite.findMany({
        where: { projectId },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      })

      perfMonitor.mark('fetch-suites-minimal', { count: suites.length })
      console.log(`[API] Returned ${suites.length} suites (minimal, lightweight response)`)
      return NextResponse.json(suites)
    }

    // Full data with testCases
    console.log(`[API] GET /api/test-suites (full data)`)
    const suites = await prisma.testSuite.findMany({
      where: { projectId },
      include: {
        testCases: {
          include: { testCase: true },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    perfMonitor.mark('fetch-suites', { count: suites.length })

    if (process.env.NODE_ENV === 'development') {
      console.log(`\n[API] GET /api/test-suites`)
      perfMonitor.log()
    }

    return NextResponse.json(suites)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[API ERROR]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/test-suites - Create suite with bulk test case assignment
export async function POST(req: NextRequest) {
  const perfMonitor = new PerformanceMonitor()
  const projectId = req.nextUrl.searchParams.get('projectId')

  perfMonitor.mark('parse-params')

  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  try {
    const body = await req.json()
    perfMonitor.mark('parse-request-body')

    const {
      name,
      description,
      category = 'CUSTOM',
      selectionMethod = 'HIERARCHY',
      testIds = [],
      roamTestCaseIds = []
    } = body

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      )
    }

    // OPTIMIZATION: Use a single transaction for everything
    // This eliminates the slow fetch-by-title step
    const suite = await prisma.$transaction(
      async (tx) => {
        let finalTestIds = testIds

        if (roamTestCaseIds.length > 0) {
          // Step 1: Fetch RoamTestCase records
          const roamTestCases = await tx.roamTestCase.findMany({
            where: {
              id: { in: roamTestCaseIds },
              projectId,
            },
            select: {
              id: true,
              title: true,
              sourceRoamUid: true,
            },
          })

          perfMonitor.mark('fetch-roam-test-cases', { count: roamTestCases.length })

          // Step 2: Batch insert all TestCase records using raw SQL for performance
          // This is much faster than individual create() calls in a loop
          const testCaseIds: string[] = roamTestCases.map(() => randomUUID())
          const now = new Date().toISOString()

          // Build batch INSERT with all required columns
          const valuesList = roamTestCases
            .map(
              (rtc, i) => {
                const sourceUid = rtc.sourceRoamUid ? rtc.sourceRoamUid.replace(/'/g, "''") : 'unknown'
                return `('${testCaseIds[i]}', '${projectId}', '${rtc.title.replace(/'/g, "''")}', 'Extracted from: ${sourceUid}', '${now}', '${now}')`
              }
            )
            .join(',')

          await tx.$executeRawUnsafe(
            `INSERT INTO "TestCase" (id, "projectId", title, description, "createdAt", "updatedAt") VALUES ${valuesList}`
          )

          perfMonitor.mark('create-test-cases-batch', {
            count: testCaseIds.length,
          })

          finalTestIds = testCaseIds
        }

        // Step 3: Create suite and link tests
        const newSuite = await tx.testSuite.create({
          data: {
            projectId,
            name,
            description,
            category,
            selectionMethod,
            testCases:
              finalTestIds.length > 0
                ? {
                    createMany: {
                      data: finalTestIds.map((testId: string, index: number) => ({
                        testCaseId: testId,
                        order: index,
                      })),
                    },
                  }
                : undefined,
          },
          include: {
            testCases: {
              include: { testCase: true },
              orderBy: { order: 'asc' },
            },
          },
        })

        perfMonitor.mark('create-suite-with-links', { testCount: finalTestIds.length })

        return newSuite
      },
      {
        timeout: 30000,
      }
    )

    // Return response
    const response = NextResponse.json(suite, { status: 201 })

    // Log performance in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n[API] POST /api/test-suites`)
      perfMonitor.log()
    }

    return response
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[API ERROR]', msg)
    if (process.env.NODE_ENV === 'development') {
      perfMonitor.log()
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
