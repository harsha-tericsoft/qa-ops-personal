# 🔴 Debugging 500 Error When Viewing Project

**Error**: `Server error (500): Internal Server Error`  
**Location**: Appears when trying to view a created project  
**File**: `app/projects/[id]/page.tsx`

---

## 🎯 Root Cause Investigation

The 500 error is being thrown from the API endpoint `/api/projects/{projectId}` when trying to fetch the project details. This could be caused by:

1. ❌ **Database connection failure** - Can't connect to PostgreSQL
2. ❌ **Missing database tables** - Migrations haven't been run
3. ❌ **Invalid project ID** - Project doesn't exist in database
4. ❌ **Prisma configuration issue** - Environment variables or schema mismatch
5. ❌ **Query error** - Problem with the database query

---

## ✅ Troubleshooting Steps

### Step 1: Check Server Logs

**In your development terminal** (where you run `npm run dev`):

```
Look for lines starting with:
[DEBUG] Fetching project with ID: ...
[DEBUG] Database error: ...
Error fetching project: ...
```

These will show the actual error message. **Copy this error and report it.**

### Step 2: Verify Database Connection

Run the health check endpoint:

```bash
# Option A: Using curl
curl http://localhost:3000/api/health

# Option B: Open in browser
http://localhost:3000/api/health
```

Expected response (healthy):
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-06-10T..."
}
```

If you see `status: "unhealthy"`, the database is **not reachable**. Check:
- ✅ DATABASE_URL in `.env` or `.env.local`
- ✅ Database is running and accessible
- ✅ Credentials are correct

### Step 3: Check Created Projects

Run this to see all projects:

```bash
# Option A: Using curl
curl http://localhost:3000/api/projects

# Option B: Browser
http://localhost:3000/api/projects
```

This should return a JSON array of projects. If it's empty, no project was created.

### Step 4: Test Creating a Project

Try creating a new project via the API:

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Project", "description": "Test"}'
```

Check the response:
- ✅ If `201`: Project was created successfully
- ❌ If `500`: Creation failed - check server logs

### Step 5: Verify Database Has Tables

The migrations might not have been applied. Run:

```bash
# From the project directory
npx prisma migrate deploy
# or
npx prisma db push
```

This will create all tables if they don't exist.

---

## 🔍 Common Solutions

### Problem 1: DATABASE_URL Not Set
```
Error: DATABASE_URL environment variable is not set
```

**Fix**: 
1. Check `.env` file exists and has DATABASE_URL
2. Restart dev server: `npm run dev`

### Problem 2: Database Not Reachable
```
Error: connect ENOTFOUND postgres.somewhere.com
```

**Fix**:
1. Check internet connection
2. Verify DATABASE_URL is correct (copy from .env)
3. Check if database server is running
4. Try connecting with a database client (DBeaver, pgAdmin)

### Problem 3: Tables Don't Exist
```
Error: relation "Project" does not exist
```

**Fix**:
```bash
npx prisma migrate deploy
# or
npx prisma db push --force-reset
# ⚠️ WARNING: --force-reset will DELETE all data!
```

### Problem 4: Prisma Cache Issue
```
Error: [various unclear errors]
```

**Fix**:
```bash
# Clear Prisma cache
rm -rf node_modules/.prisma
npx prisma generate
npm run dev
```

---

## 📋 Quick Debug Checklist

- [ ] Check server logs for actual error message
- [ ] Run `/api/health` - is it `healthy` or `unhealthy`?
- [ ] Run `/api/projects` - does it return projects?
- [ ] Database is running and accessible
- [ ] `.env` or `.env.local` has correct DATABASE_URL
- [ ] All migrations applied: `npx prisma migrate deploy`
- [ ] Prisma cache cleared: `rm -rf node_modules/.prisma`

---

## 🚀 Next Steps

1. **Check server logs** (most important) - look for actual error message
2. **Run health check** - `/api/health` to verify database connection
3. **Apply migrations** if needed - `npx prisma migrate deploy`
4. **Restart dev server** - `npm run dev`
5. **Try creating a project again** - go to Projects page and create

---

## 📝 When Reporting the Error

Please share:

1. **Exact error message** from server logs (from step 1 above)
2. **Health check result** - `/api/health` response
3. **Migrations status** - `npx prisma migrate status` output
4. **Database connection test** - can you connect to the database?

This information will help identify the exact cause of the 500 error.
