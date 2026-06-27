# Roam Scheduled Sync - GitHub Actions Setup

This document explains the scheduled Roam sync implementation using GitHub Actions instead of Vercel Crons.

## Overview

The application syncs Roam Research graphs with the local database every 5 minutes. This was originally handled by Vercel Crons, which requires a paid plan. The migration uses **GitHub Actions**, a free alternative that triggers the same sync endpoint.

## How It Works

### GitHub Actions Workflow
- **Location**: `.github/workflows/roam-scheduled-sync.yml`
- **Schedule**: Every 5 minutes using cron expression `*/5 * * * *`
- **Action**: Makes an HTTP POST request to `/api/roam/scheduled-sync`
- **Retries**: Up to 3 attempts with 5-second delays between failures
- **Logging**: Detailed logs of each attempt and final status

### API Endpoint
- **Route**: `app/api/roam/scheduled-sync/route.ts`
- **Method**: POST (triggers sync), GET (health check)
- **Behavior**: 
  - Fetches all configured Roam graphs
  - Extracts pages and converts to markdown
  - Parses markdown into a tree structure
  - Imports nodes into the database
  - Extracts and creates test cases
  - Logs sync results

## GitHub Secrets Configuration

The workflow requires one GitHub Secret to be configured:

### Required Secrets

1. **`ROAM_SYNC_URL`** (Required)
   - The full URL to your deployed application's sync endpoint
   - Format: `https://<your-domain>/api/roam/scheduled-sync`
   - Example: `https://qa-ops.vercel.app/api/roam/scheduled-sync`
   - This is the URL where the workflow will send POST requests

2. **`ROAM_SYNC_SECRET`** (Optional)
   - If you add authentication to the endpoint, set this secret
   - Will be sent as `X-Sync-Secret` header
   - Currently not used by default (endpoint is unauthenticated)
   - Can be added for additional security if needed

### How to Configure Secrets

1. Go to your GitHub repository settings
2. Navigate to **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add `ROAM_SYNC_URL` with your Vercel deployment URL
5. (Optional) Add `ROAM_SYNC_SECRET` if you implement endpoint authentication

**Important**: Keep your secrets confidential. Never commit them to the repository.

## Testing the Workflow

### Manual Trigger (GitHub UI)
1. Go to your repository on GitHub
2. Click **Actions** tab
3. Select **Roam Scheduled Sync** workflow
4. Click **Run workflow** button
5. Monitor the execution in the workflow run details

### Manual Testing (Local)
To test the endpoint locally:

```bash
# Start the dev server
npm run dev

# In another terminal, trigger the sync
curl -X POST http://localhost:3000/api/roam/scheduled-sync

# Check health status
curl http://localhost:3000/api/roam/scheduled-sync
```

### Monitoring Sync Status
Check the API health endpoint to see the last sync status:

```bash
curl https://<your-domain>/api/roam/scheduled-sync
```

Example response:
```json
{
  "status": "healthy",
  "scheduler": "GitHub Actions - every 5 minutes",
  "syncMethod": "roam-cli with spawn()",
  "lastSyncAt": "2024-01-15T10:30:00.000Z",
  "lastSyncDuration": 3500,
  "metrics": {
    "roamTestCases": 245,
    "repositoryNodes": 1823
  }
}
```

## Workflow Execution Details

### Schedule
- **Frequency**: Every 5 minutes
- **Cron Expression**: `*/5 * * * *`
- **Note**: GitHub Actions has a minimum 5-minute interval

### Retry Logic
- **Max Attempts**: 3
- **Retry Delay**: 5 seconds between attempts
- **Success Criteria**: HTTP status 200-299

### Logging
The workflow logs:
- Current timestamp when triggered
- Each attempt number and count
- HTTP response code for each attempt
- Success/failure message with emoji indicators (✅ ❌ ⚠️)
- Completion timestamp

## Workflow Output Examples

### Successful Execution
```
Triggering Roam sync at 2024-01-15T10:30:00Z
Attempt 1 of 3...
Response Code: 200
Response Body: {"success":true,"message":"Live Roam sync queued","timestamp":"2024-01-15T10:30:00.123Z"}
✅ Sync triggered successfully (HTTP 200)
```

### Failed Then Recovered
```
Attempt 1 of 3...
Response Code: 503
⚠️ Sync failed with HTTP 503
Retrying in 5 seconds...
Attempt 2 of 3...
Response Code: 200
✅ Sync triggered successfully (HTTP 200)
```

### All Retries Failed
```
Attempt 1 of 3...
Response Code: 500
⚠️ Sync failed with HTTP 500
[... 2 more retries fail ...]
❌ Failed to trigger sync after 3 attempts
```

## Troubleshooting

### Workflow Not Running
**Problem**: Scheduled workflow doesn't appear to run
- **Solution 1**: GitHub Actions workflows only run if the default branch has the workflow file
- **Solution 2**: Ensure you have at least one commit on the branch with the workflow
- **Solution 3**: Check that Actions are enabled in repository settings

### 404 Errors from Workflow
**Problem**: Workflow logs show HTTP 404
- **Cause**: `ROAM_SYNC_URL` secret is not configured or incorrect
- **Solution**: 
  1. Verify the secret is set in repository settings
  2. Ensure the URL includes the full path: `https://<domain>/api/roam/scheduled-sync`
  3. Test the URL manually: `curl -X POST <URL>`

### 503 Service Unavailable
**Problem**: Workflow triggers but gets 503 responses
- **Cause**: Application deployment issue or database connectivity problem
- **Solution**:
  1. Check Vercel deployment status
  2. Verify database connection from the application
  3. Check application logs for errors

### Roam CLI Not Found
**Problem**: Workflow succeeds but sync logs show "roam-cli not found"
- **Cause**: Roam CLI not installed in production environment
- **Solution**:
  1. Ensure `@roam-research/roam-cli` is in package.json dependencies or devDependencies
  2. Verify the CLI is available during Next.js build
  3. Check that roam authentication is configured on the server

## Migration Notes

### What Changed
- ✅ Removed `vercel.json` cron configuration
- ✅ Updated endpoint comment from "Vercel Crons" to "GitHub Actions"
- ✅ Updated health check response to indicate GitHub Actions scheduler
- ✅ Created `.github/workflows/roam-scheduled-sync.yml`
- ✅ Added this documentation

### What Stayed the Same
- ✅ Same sync endpoint (`/api/roam/scheduled-sync`)
- ✅ Same sync logic and behavior
- ✅ Same frequency (every 5 minutes)
- ✅ Same database operations and logging
- ✅ Application builds normally on Vercel Hobby (no paid features used)

### Benefits
1. **Free**: Works on Vercel Hobby plan
2. **Reliable**: GitHub Actions has good uptime
3. **Transparent**: Easily visible in GitHub UI
4. **Flexible**: Can manually trigger anytime
5. **Scalable**: Works across multiple environments

## Additional Configuration

### Adding Endpoint Authentication (Optional)
If you want to secure the endpoint, you can implement authentication:

1. Add a `SYNC_SECRET` environment variable to your Vercel project
2. Update the endpoint to verify the header:
   ```typescript
   const secret = process.env.SYNC_SECRET;
   const providedSecret = request.headers.get('X-Sync-Secret');
   
   if (secret && providedSecret !== secret) {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }
   ```
3. Add the secret to GitHub: `ROAM_SYNC_SECRET`
4. Update `.github/workflows/roam-scheduled-sync.yml` to use it (already implemented)

### Modifying the Schedule
To change the sync frequency, edit `.github/workflows/roam-scheduled-sync.yml`:

```yaml
on:
  schedule:
    - cron: '0 * * * *'  # Change to hourly
```

Common cron patterns:
- Every 5 minutes: `*/5 * * * *`
- Every hour: `0 * * * *`
- Every day at 2 AM UTC: `0 2 * * *`
- Every Monday at 9 AM UTC: `0 9 * * 1`

See [crontab.guru](https://crontab.guru/) for more patterns.

## Monitoring and Alerts

### GitHub Actions Dashboard
- View all workflow runs at: `https://github.com/<owner>/<repo>/actions`
- Click "Roam Scheduled Sync" to see execution history
- Each run shows logs, duration, and status

### Database Logging
The endpoint also logs to the database in the `syncLog` table:
- View recent syncs: Check the application's admin panel or database
- Track sync history: Review `lastSyncAt` and `lastSyncStatus` in `roamConfig` table

### Setting Up Notifications (Optional)
GitHub can notify you of workflow failures:
1. Repository Settings → Notifications
2. GitHub will alert you if a workflow fails consistently

## Questions & Support

For issues or questions about this setup:
1. Check the troubleshooting section above
2. Review workflow logs in GitHub Actions tab
3. Check application logs in Vercel dashboard
4. Review database logs and sync status in the application
