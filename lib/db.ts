import { Pool } from 'pg'

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    // Use DIRECT_URL (direct PostgreSQL) instead of DATABASE_URL (PgBouncer)
    // PgBouncer in transaction mode causes queries to hang
    // Direct connection is more reliable for raw queries
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DIRECT_URL or DATABASE_URL environment variable is required')
    }

    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err)
    })
  }

  return pool
}

export async function queryDatabase(
  sql: string,
  params: any[] = []
): Promise<any[]> {
  const client = await getPool().connect()
  try {
    const result = await client.query(sql, params)
    return result.rows
  } finally {
    client.release()
  }
}

export async function executeDatabase(
  sql: string,
  params: any[] = []
): Promise<any> {
  const client = await getPool().connect()
  try {
    const result = await client.query(sql, params)
    return result.rows[0] || null
  } finally {
    client.release()
  }
}

// ============= USER =============
export async function getUserByEmail(email: string) {
  const rows = await queryDatabase(
    'SELECT id, email, password, name, role, active FROM "User" WHERE email = $1',
    [email]
  )
  return rows[0] || null
}

// ============= PROJECTS =============
export async function createProject(name: string, description?: string) {
  return executeDatabase(
    'INSERT INTO "Project" (id, name, description, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, NOW(), NOW()) RETURNING *',
    [name, description]
  )
}

export async function getProjects() {
  return queryDatabase('SELECT * FROM "Project" ORDER BY "createdAt" DESC')
}

export async function getProject(id: string) {
  const rows = await queryDatabase('SELECT * FROM "Project" WHERE id = $1', [id])
  return rows[0] || null
}

// ============= TEST CASES =============
export async function createTestCase(
  projectId: string,
  title: string,
  description?: string
) {
  return executeDatabase(
    'INSERT INTO "TestCase" (id, "projectId", title, description, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW()) RETURNING *',
    [projectId, title, description]
  )
}

export async function getTestCases(projectId: string) {
  return queryDatabase(
    'SELECT * FROM "TestCase" WHERE "projectId" = $1 ORDER BY "createdAt" DESC',
    [projectId]
  )
}

export async function getTestCase(id: string) {
  const rows = await queryDatabase('SELECT * FROM "TestCase" WHERE id = $1', [
    id,
  ])
  return rows[0] || null
}

// ============= TEST SUITES =============
export async function createTestSuite(
  projectId: string,
  name: string,
  category: string,
  description?: string
) {
  return executeDatabase(
    'INSERT INTO "TestSuite" (id, "projectId", name, category, description, "selectionMethod", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *',
    [projectId, name, category, description, 'manual']
  )
}

export async function getTestSuites(projectId: string) {
  return queryDatabase(
    'SELECT * FROM "TestSuite" WHERE "projectId" = $1 ORDER BY "createdAt" DESC',
    [projectId]
  )
}

export async function getTestSuite(id: string) {
  const rows = await queryDatabase('SELECT * FROM "TestSuite" WHERE id = $1', [
    id,
  ])
  return rows[0] || null
}

// ============= EXECUTION CYCLES =============
export async function createExecutionCycle(
  projectId: string,
  name: string,
  status: string,
  description?: string,
  startDate?: string,
  endDate?: string
) {
  return executeDatabase(
    'INSERT INTO "ExecutionCycle" (id, "projectId", name, status, description, "startDate", "endDate", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *',
    [projectId, name, status, description, startDate, endDate]
  )
}

export async function getExecutionCycles(projectId: string) {
  return queryDatabase(
    'SELECT * FROM "ExecutionCycle" WHERE "projectId" = $1 ORDER BY "createdAt" DESC',
    [projectId]
  )
}

export async function getExecutionCycle(id: string) {
  const rows = await queryDatabase(
    'SELECT * FROM "ExecutionCycle" WHERE id = $1',
    [id]
  )
  return rows[0] || null
}

export async function updateExecutionCycleStatus(id: string, status: string) {
  return executeDatabase(
    'UPDATE "ExecutionCycle" SET status = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *',
    [status, id]
  )
}

// ============= TAGS =============
export async function createTag(projectId: string, name: string, color?: string) {
  return executeDatabase(
    'INSERT INTO "Tag" (id, "projectId", name, color) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING *',
    [projectId, name, color || '#6366f1']
  )
}

export async function getTags(projectId: string) {
  return queryDatabase(
    'SELECT * FROM "Tag" WHERE "projectId" = $1 ORDER BY name',
    [projectId]
  )
}

// ============= REPOSITORY NODES =============
export async function createRepositoryNode(
  repositoryId: string,
  projectId: string,
  name: string,
  slug: string,
  path: string,
  type: string,
  parentId?: string,
  description?: string
) {
  return executeDatabase(
    'INSERT INTO "RepositoryNode" (id, "repositoryId", "projectId", name, slug, path, type, "parentId", description, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *',
    [repositoryId, projectId, name, slug, path, type, parentId, description]
  )
}

export async function getRepositoryNodes(projectId: string) {
  return queryDatabase(
    'SELECT * FROM "RepositoryNode" WHERE "projectId" = $1 ORDER BY path',
    [projectId]
  )
}

// ============= DASHBOARD METRICS =============
export async function getDashboardMetrics(projectId: string) {
  const client = await getPool().connect()
  try {
    const [
      totalTests,
      activeCycles,
      passStats,
      failStats,
      blockedStats,
      openDefects,
      roamConfig,
      testSuites,
      tagCount,
      repositoryNodes,
    ] = await Promise.all([
      client.query('SELECT COUNT(*) as count FROM "RoamTestCase" WHERE "projectId" = $1', [projectId]),
      client.query('SELECT COUNT(*) as count FROM "ExecutionCycle" WHERE "projectId" = $1 AND status = $2', [projectId, 'IN_PROGRESS']),
      client.query('SELECT COUNT(*) as count FROM "TestRun" tr JOIN "ExecutionCycle" ec ON tr."cycleId" = ec.id WHERE tr.status = $1 AND ec."projectId" = $2', ['PASS', projectId]),
      client.query('SELECT COUNT(*) as count FROM "TestRun" tr JOIN "ExecutionCycle" ec ON tr."cycleId" = ec.id WHERE tr.status = $1 AND ec."projectId" = $2', ['FAIL', projectId]),
      client.query('SELECT COUNT(*) as count FROM "TestRun" tr JOIN "ExecutionCycle" ec ON tr."cycleId" = ec.id WHERE tr.status = $1 AND ec."projectId" = $2', ['BLOCKED', projectId]),
      client.query('SELECT COUNT(*) as count FROM "JiraLink" jl JOIN "TestRun" tr ON jl."runId" = tr.id JOIN "ExecutionCycle" ec ON tr."cycleId" = ec.id WHERE ec."projectId" = $1', [projectId]),
      client.query('SELECT id, "syncEnabled", "lastSyncAt", "lastSyncStatus" FROM "RoamConfig" WHERE "projectId" = $1', [projectId]),
      client.query('SELECT COUNT(*) as count FROM "TestSuite" WHERE "projectId" = $1', [projectId]),
      client.query('SELECT COUNT(DISTINCT id) as count FROM "Tag" WHERE "projectId" = $1', [projectId]),
      client.query('SELECT COUNT(*) as count FROM "RepositoryNode" WHERE "projectId" = $1 AND "deletedAt" IS NULL', [projectId]),
    ])

    const total = parseInt(totalTests.rows[0]?.count || 0)
    const active = parseInt(activeCycles.rows[0]?.count || 0)
    const pass = parseInt(passStats.rows[0]?.count || 0)
    const fail = parseInt(failStats.rows[0]?.count || 0)
    const blocked = parseInt(blockedStats.rows[0]?.count || 0)
    const defects = parseInt(openDefects.rows[0]?.count || 0)
    const suites = parseInt(testSuites.rows[0]?.count || 0)
    const tags = parseInt(tagCount.rows[0]?.count || 0)
    const repos = parseInt(repositoryNodes.rows[0]?.count || 0)

    const totalRuns = pass + fail + blocked
    const hasExecutionData = totalRuns > 0

    const passRate = hasExecutionData ? Math.round((pass / totalRuns) * 100 * 10) / 10 : -1
    const failRate = hasExecutionData ? Math.round((fail / totalRuns) * 100 * 10) / 10 : -1
    const blockedRate = hasExecutionData ? Math.round((blocked / totalRuns) * 100 * 10) / 10 : -1

    let readiness: 'READY' | 'AT_RISK' | 'NOT_READY' | 'INSUFFICIENT_DATA'
    if (!hasExecutionData) {
      readiness = 'INSUFFICIENT_DATA'
    } else if (passRate >= 95 && blocked === 0 && defects === 0) {
      readiness = 'READY'
    } else if (passRate >= 80 && (blocked > 0 || defects > 0)) {
      readiness = 'AT_RISK'
    } else {
      readiness = 'NOT_READY'
    }

    const roamData = roamConfig.rows[0]
    const isRoamConfigured = roamData && roamData.syncEnabled === true

    return {
      totalTests: total,
      repositoryTests: repos,
      testSuites: suites,
      tagCount: tags,
      activeCycles: active,
      passRate: hasExecutionData ? passRate : null,
      failRate: hasExecutionData ? failRate : null,
      blockedRate: hasExecutionData ? blockedRate : null,
      blockedTests: blocked,
      openDefects: defects,
      readiness,
      passCount: pass,
      failCount: fail,
      totalRunTests: totalRuns,
      hasExecutionData,
      roamConfig: {
        isConfigured: isRoamConfigured,
        lastSyncAt: roamData?.lastSyncAt || null,
        lastSyncStatus: roamData?.lastSyncStatus || 'NEVER',
      },
    }
  } finally {
    client.release()
  }
}

export async function closePool() {
  if (pool) {
    await pool.end()
    pool = null
  }
}
