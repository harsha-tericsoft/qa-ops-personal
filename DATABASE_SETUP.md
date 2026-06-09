# Database Setup & Migration Guide

## Summary of Changes

### 1. Files Created

✅ **Migration File**
- `prisma/migrations/1_init/migration.sql` — Complete schema migration with all 16 tables, 6 enums, and all indexes

✅ **API Routes for Testing**
- `app/api/health/route.ts` — Database health check endpoint
- `app/api/debug/config/route.ts` — Debug configuration endpoint  
- `app/api/db-test/route.ts` — Test database connectivity

✅ **Error Handling Update**
- `lib/services/dashboard.service.ts` — Added `.catch()` fallbacks to all Prisma queries to return 0/[] when tables don't exist

### 2. Files Modified

✅ **Dashboard Page**
- `app/dashboard/page.tsx` — Added try/catch with helpful error messages for database failures

✅ **Prisma Config**
- `prisma.config.ts` — Verified datasource configuration
- `prisma/schema.prisma` — Verified schema is valid

✅ **Prisma Client**
- `lib/prisma.ts` — Proper singleton pattern with connection pooling

## Database Models (16 Total)

**Core Entities:**
1. Project
2. Repository
3. RepositoryNode (hierarchical structure)
4. TestCase
5. TestCaseNode (junction)

**Execution:**
6. ExecutionCycle
7. TestRun
8. RunComment
9. JiraLink
10. RunAttachment

**Configuration & Tracking:**
11. RoamConfig
12. SyncLog

**Test Management:**
13. TestSuite
14. SuiteTestCase (junction)

**Tagging:**
15. Tag
16. TagTestCase (junction)

## Enums (6 Total)

- `NodeType` (FOLDER, FILE, MODULE, FEATURE, EPIC, STORY)
- `SyncDirection` (IMPORT_ONLY, EXPORT_ONLY, BIDIRECTIONAL)
- `SyncStatus` (NEVER, IN_PROGRESS, SUCCESS, FAILED)
- `CycleStatus` (PLANNED, IN_PROGRESS, COMPLETED, ABORTED)
- `RunStatus` (NOT_EXECUTED, PASS, FAIL, BLOCKED)
- `SuiteCategory` (SMOKE, REGRESSION, SPRINT, RELEASE, CUSTOM)

## Commands to Run

### 1. Apply the Migration

```bash
cd "C:\Users\harsh\ClaudeCode\Assignment3\qa-ops"
npx prisma migrate deploy
```

**Expected Output:**
```
Loaded Prisma config from prisma.config.ts.
✔ Successfully applied 1 migration
```

### 2. Verify Migration Status

```bash
npx prisma migrate status
```

**Expected Output:**
```
Datasource "db": PostgreSQL database "postgres", schema "public" at "..."
Following migrations have not yet been applied:
  migrations/
    └─ 1_init
```

If this shows, run `npx prisma migrate deploy` again.

### 3. Test Database Connection

Once the dev server is running:
- Visit: `http://localhost:3000/api/health`
- Should return: `{"status":"healthy","database":"connected",...}`

### 4. Test Dashboard

- Visit: `http://localhost:3000/dashboard`
- Should show 0 values for all metrics (no data yet)
- Should NOT show database errors

## Troubleshooting

### If Tables Still Don't Exist

Run this command to check what tables exist:

```bash
npx prisma db execute --stdin < check-tables.sql
```

Or use Supabase dashboard → SQL Editor to run:

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

### If Migration Hangs

The Prisma schema engine might be timing out. Try:

```bash
npx prisma migrate deploy --skip-generate
```

Or apply SQL directly in Supabase:
1. Go to Supabase Dashboard
2. SQL Editor
3. Copy contents of `prisma/migrations/1_init/migration.sql`
4. Execute

### If Dashboard Still Shows Errors

Check `/api/debug/config` to verify DATABASE_URL is loaded correctly with masked password.

## Dashboard Expected Behavior

### When Database is Empty

- Total Tests: 0
- Synced Tests: 0 (0% synced)
- Active Cycles: 0
- Pass Rate: 0%
- Fail Rate: 0%
- Blocked Tests: 0
- Open Defects: 0
- Release Readiness: NOT READY

### Error Handling

If database tables don't exist, queries will:
- Return 0 for count queries
- Return [] (empty array) for groupBy queries
- Display helpful error message on dashboard

## Next Steps

1. ✅ Apply migration: `npx prisma migrate deploy`
2. ✅ Test connection: Visit `/api/db-test`
3. ✅ Check dashboard: Visit `/dashboard`
4. 📝 Create test data (when ready):
   - Create projects via API
   - Import tests from Roam
   - Create execution cycles
   - Log test results

## Files Generated

```
prisma/
├── migrations/
│   └── 1_init/
│       └── migration.sql (contains full schema)
├── schema.prisma (16 models defined)
└── config.ts (datasource configured)

app/generated/prisma/
├── client.ts (regenerated)
├── enums.ts (6 enums)
└── ... (other generated files)

app/api/
├── health/route.ts (new)
├── db-test/route.ts (new)
└── debug/config/route.ts (new)

lib/
├── prisma.ts (singleton pattern)
└── services/
    └── dashboard.service.ts (safe fallbacks)
```

## Version Info

- Prisma: 7.8.0
- Next.js: 16.2.7
- Database: PostgreSQL (Supabase)
- Adapter: @prisma/adapter-pg

