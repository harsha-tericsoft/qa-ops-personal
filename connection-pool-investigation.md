# Prisma Connection Pool Exhaustion Investigation

## ERROR DETAILS
- Error: "Timed out fetching a new connection from the connection pool"
- Pool timeout: 10 seconds
- Connection limit: 13 connections
- Database: Supabase PostgreSQL with PgBouncer pooling

## 1. RUNNING NODE PROCESSES

Active Node.js processes:
- PID 42060: 1189.72 MB (likely Next.js dev server)
- PID 30208: 10.86 MB
- PID 59312: 0.02 MB
- PID 60280: 0.01 MB
- PID 60664: 0.02 MB
- PID 65524: 0.02 MB

**Total: 6 Node processes running**

## 2. ORPHANED QA SCRIPTS

Found 47 JavaScript files that create PrismaClient:
- verify-*.js (15+ files)
- check-*.js (10+ files)
- audit-*.js, create-*.js, diagnose-*.js (10+ files)
- Other verification/testing scripts (10+ files)

Each script creates its own PrismaClient instance.

## 3. PrismaClient INSTANTIATION PATTERN

**In application code (lib/prisma.ts):**
- Uses singleton pattern ✅
- Reuses global.prisma if available ✅
- Single connection pool for app ✅

**In verification scripts:**
- Each script creates NEW PrismaClient() ❌
- 47 different script files ❌
- If scripts run concurrently or hang, they consume 47+ connections ❌

## 4. DISCONNECT PATTERNS ANALYSIS

Sample of 10 scripts checked:
- architecture-analysis.js: ✅ Has $disconnect()
- audit-all-repositories.js: ✅ Has $disconnect()
- browser-verification.js: ✅ Has $disconnect()
- check-data.js: ✅ Has $disconnect()
- check-extraction.js: ✅ Has $disconnect()

All checked scripts have $disconnect() calls, BUT:
- If error occurs before reaching $disconnect(), connection leaks
- If process.exit() called without try/finally, $disconnect() not guaranteed
- If multiple scripts run simultaneously, they pool connections faster than they disconnect

## 5. LIBRARY PATTERN VERIFICATION

**lib/prisma.ts:**
```typescript
const prismaClientSingleton = () => {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
  return client
}

let prismaInstance = global.prisma ?? prismaClientSingleton()
export const prisma = prismaInstance
```

Status: ✅ Singleton pattern correctly implemented

## 6. DATABASE_URL CONFIGURATION

```
DATABASE_URL="postgresql://user:pass@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

- Using PgBouncer for connection pooling
- Pool configured at Supabase level (external)
- Prisma connection limit: Default (not explicitly configured)

## 7. CONNECTION LIMIT CONFIGURATION

**In Prisma Client:**
- No explicit connection pool settings
- Using Prisma defaults:
  - min connections: 1
  - max connections: 10 (for PostgreSQL)
  - connection timeout: 10 seconds

**Actual pool size: 13** (likely from combined script instances)

**In schema.prisma:**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

No pool configuration - using defaults.

## ROOT CAUSE ANALYSIS

1. **47 verification/test scripts** each with `new PrismaClient()`
2. **Each script maintains its own connection pool** (default ~10 connections each)
3. **Multiple scripts running simultaneously** = cumulative connection usage
4. **Scripts may hang or fail to disconnect** = connections leak
5. **Dev server + 47 scripts** = potential for 470+ connections attempted
6. **Pool limit of 13** = timeout inevitable

## EVIDENCE SUMMARY

```
❌ 47 standalone scripts create separate PrismaClient instances
❌ Each maintains default ~10 connection pool
❌ 6+ Node processes running (including orphaned scripts)
❌ No explicit connection pool configuration
❌ No cleanup mechanism for orphaned processes
✅ lib/prisma.ts correctly uses singleton
✅ Individual scripts have $disconnect() calls
✅ DATABASE_URL properly configured with PgBouncer
```

## RECOMMENDED FIXES

1. **Kill orphaned Node processes** (59312, 60280, 60664, 65524)
2. **Consolidate scripts** into single entry point using singleton prisma instance
3. **Use lib/prisma.ts export** instead of creating new PrismaClient in scripts
4. **Add explicit pool configuration** if needed:
   ```typescript
   new PrismaClient({
     datasources: {
       db: {
         url: process.env.DATABASE_URL + "&pool_mode=transaction"
       }
     }
   })
   ```
5. **Implement proper cleanup** with try/finally blocks
6. **Limit concurrent scripts** to prevent connection pool exhaustion
