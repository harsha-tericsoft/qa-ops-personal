# PRISMA CONNECTION POOL EXHAUSTION - EVIDENCE REPORT

## ISSUE
```
Error: Timed out fetching a new connection from the connection pool
Current connection pool timeout: 10 seconds
Connection limit: 13
```

## EVIDENCE #1: Multiple Node Processes

```
6 Node.js processes running:
├─ PID 42060: 1189.72 MB (Next.js dev server)
├─ PID 30208: 10.86 MB   (orphaned script)
├─ PID 59312: 0.02 MB    (orphaned script)
├─ PID 60280: 0.01 MB    (orphaned script)
├─ PID 60664: 0.02 MB    (orphaned script)
└─ PID 65524: 0.02 MB    (orphaned script)
```

## EVIDENCE #2: 47 Scripts Creating Separate Connections

```bash
$ grep -l "new PrismaClient()" *.js | wc -l
47

Files creating connections:
- verify-*.js (15+ files)
- check-*.js (10+ files)
- audit-*.js (5+ files)
- create-*.js (3+ files)
- diagnose-*.js (3+ files)
- investigate-*.js (2+ files)
- trace-*.js, release-*.js, etc. (9+ files)
```

## EVIDENCE #3: Singleton Pattern Verified in lib/prisma.ts

✅ Correctly implements singleton:
```typescript
const prismaClientSingleton = () => {
  const client = new PrismaClient({...})
  return client
}
let prismaInstance = global.prisma ?? prismaClientSingleton()
export const prisma = prismaInstance
```

## EVIDENCE #4: Database Configuration

```
DATABASE_URL: postgresql://...@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true

Provider: PostgreSQL
Pooling: PgBouncer (external)
Schema pool config: DEFAULT (not set)
```

## EVIDENCE #5: Connection Limit Not Configured

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // No pool_connections or connection_limit set
}
```

Prisma defaults:
- Min: 1
- Max: 10 (PostgreSQL default)
- Timeout: 10 seconds
- **Actual observed: 13** (combination of pools)

## ROOT CAUSE

```
47 scripts × ~10 connections/pool + dev server pool
= 470+ connection attempts competing for 13-connection limit
= Inevitable timeout
```

## PROBLEM CHAIN

1. ❌ 47 verification scripts each create `new PrismaClient()`
2. ❌ Each maintains default connection pool (~10 connections)
3. ❌ If scripts run simultaneously, pools accumulate
4. ❌ If scripts hang, connections don't release
5. ❌ 6 Node processes = multiple accumulated pools
6. ❌ No explicit pool size limiting in Prisma config
7. ✅ Individual scripts do call $disconnect()
   - BUT: Not guaranteed if error occurs before cleanup

## WHAT'S WORKING

✅ lib/prisma.ts singleton pattern
✅ DATABASE_URL with PgBouncer
✅ Individual script cleanup attempts
✅ PrismaClient initialized without errors

## WHAT'S BROKEN

❌ 47 independent PrismaClient instances
❌ No centralized connection management for scripts
❌ Orphaned Node processes not cleaned up
❌ No error handling forcing proper disconnect
❌ No pool size limit explicitly set
❌ Scripts can leak connections on error

## IMMEDIATE ACTION REQUIRED

1. Kill orphaned Node processes: 59312, 60280, 60664, 65524
2. Stop creating PrismaClient in scripts
3. Use singleton from lib/prisma.ts in all scripts
4. Clean up verification scripts directory
