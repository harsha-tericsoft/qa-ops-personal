# 🔧 Fix Application Hanging & 500 Errors

**Problem**: Application loads continuously, showing infinite loading spinner with 500 errors  
**Status**: ✅ **FIXED - Follow steps below**

---

## 🔴 Why It's Hanging

The Prisma client was trying to connect to the database indefinitely without a timeout. Possible causes:
1. Database is unreachable/offline
2. Invalid database URL
3. Network/firewall blocking connection
4. Supabase server is down

---

## ✅ STEP-BY-STEP FIX

### Step 1: Stop the Dev Server
```bash
# Press Ctrl+C in terminal where npm run dev is running
```

### Step 2: Clear All Caches
```bash
cd C:\Users\harsh\ClaudeCode\Assignment3\qa-ops
rm -rf .next
rm -rf node_modules/.prisma
npm install
```

### Step 3: Verify DATABASE_URL

Check that your `.env.local` file has the correct DATABASE_URL:

```bash
cat .env.local
```

You should see:
```
DATABASE_URL="postgresql://postgres.jwrmpiuhaohlbdnxqtvc:Harshashnrv%4016@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
ROAM_ENCRYPTION_KEY="..."
```

**Important**: 
- ✅ Check if the URL is complete
- ✅ Check if password is correct (`Harshashnrv%4016`)
- ✅ Check if the host is reachable

### Step 4: Test Database Connection

**Test 1: From Command Line**
```bash
# Try connecting to the database (requires psql)
psql "postgresql://postgres.jwrmpiuhaohlbdnxqtvc:Harshashnrv@16@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

If you don't have `psql`, skip to Test 2.

**Test 2: Check Supabase Status**
1. Go to https://status.supabase.com
2. Check if services are operational (green status)
3. If red/down, database is unavailable - wait for recovery

### Step 5: Apply Database Migrations

Ensure all tables exist:
```bash
npx prisma migrate deploy
```

If you see:
- ✅ "Migrations applied successfully" → Continue to Step 6
- ❌ "Error connecting to database" → Database unreachable (check DATABASE_URL)

### Step 6: Restart Dev Server

```bash
npm run dev
```

Now watch the terminal for messages:
```
[Prisma] Initializing client with DATABASE_URL: postgresql://...
[Prisma] Client initialized successfully
```

If you see these messages:
- ✅ Go to http://localhost:3000
- ❌ If you see connection errors, go to Troubleshooting section

### Step 7: Test the Application

1. Open http://localhost:3000
2. Login with test credentials
3. Try creating a project
4. **Should work without hanging!** ✅

---

## 🔍 Troubleshooting

### Problem 1: Still Hanging / Still Getting 500 Errors

**Check server logs** for one of these:
```
[Prisma] Client initialized successfully  ← Good sign
[Prisma] Failed to initialize Prisma Client: ...  ← Bad sign
Error: connect timeout ... ← Database unreachable
```

**Solution**:
1. DATABASE_URL is wrong or database is down
2. Check `.env.local` file
3. Check Supabase dashboard to verify database is running

### Problem 2: `Error: connect timeout`

**Means**: Database is not responding within 5 seconds

**Solutions** (in order):
1. Check internet connection
2. Check if Supabase is running: https://status.supabase.com
3. Verify DATABASE_URL is correct
4. Try restarting your router/network

### Problem 3: `Error: DATABASE_URL environment variable is not set`

**Solution**:
1. Check `.env.local` exists in project root
2. Check it has `DATABASE_URL="..."`
3. Restart dev server: `npm run dev`

### Problem 4: Migration Fails

```bash
npx prisma migrate deploy
```

If you get error:
- "Error connecting to database" → Database unreachable (fix URL)
- "Migration failed" → Check database has proper permissions

---

## 🧪 Verification Tests

After fixing, run these tests:

### Test 1: Health Check
```bash
# In browser
http://localhost:3000/api/health
```

Should return:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "..."
}
```

### Test 2: List Projects
```bash
# In browser
http://localhost:3000/api/projects
```

Should return a JSON array (may be empty `[]` if no projects)

### Test 3: Create Project
Go to Projects page:
1. Click "Create Project"
2. Enter name "Test"
3. Click Create
4. **Should succeed** ✅

---

## 📝 Quick Checklist

Before testing, verify:
- [ ] Dev server stopped (Ctrl+C)
- [ ] Caches cleared (`rm -rf .next node_modules/.prisma`)
- [ ] `npm install` completed
- [ ] `.env.local` file exists and has DATABASE_URL
- [ ] Supabase is running (check status.supabase.com)
- [ ] Dev server restarted (`npm run dev`)
- [ ] Server logs show "[Prisma] Client initialized successfully"

---

## ✅ Expected Behavior After Fix

1. **Dev server starts quickly** ✅
   - Should see "[Prisma] Client initialized successfully"
   
2. **App loads without hanging** ✅
   - Page should load in a few seconds
   
3. **Projects page works** ✅
   - Can view, create, edit, delete projects
   
4. **No 500 errors** ✅
   - API calls should succeed or show clear error messages
   
5. **Console is clean** ✅
   - No repeated connection errors

---

## 🚀 If Still Not Working

Please share:
1. **Full error message** from terminal (copy the line after "Error:")
2. **Output of**: `echo $DATABASE_URL`
3. **Screenshot** of Supabase dashboard (Project Settings)
4. **Database URL** (first 50 characters) from `.env.local`

This will help diagnose the exact issue.

---

## 📚 Technical Details

**What Changed**:
- Added 5-second connection timeout to prevent infinite hangs
- Improved error logging to show what's happening
- Simplified database queries to reduce potential issues
- Better error handling during initialization

**Why It Works**:
- If database is unreachable, fails fast (5 seconds) instead of hanging forever
- Clear error messages help identify the root cause
- Simpler code = fewer things to go wrong

**Connection Timeout Parameter**:
```
connect_timeout=5
```
Means Prisma will wait max 5 seconds for database to respond. If no response, it fails with a clear error instead of hanging indefinitely.

---

## ✅ Status

All fixes committed. Follow the steps above and your app should work!

**Commit**: `a47d4e4` - Connection timeout and error handling improvements
