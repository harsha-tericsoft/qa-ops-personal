# QA Ops + Roam Local API Integration Architecture

**Date**: 2026-06-15  
**Status**: Design Phase (No Implementation)  
**Verified Tooling**: @roam-research/roam-cli v0.7.4  
**Target Graph**: Project_Kinergy

---

## Executive Summary

Integrate Roam Research Local API as an external synchronization target for QA Ops test data. QA Ops database remains the source of truth. Roam serves as a collaborative workspace where teams can view and annotate test cases, acceptance criteria, and test results without modifying QA Ops directly.

**Key Principle**: Sync FROM QA Ops TO Roam, with optional read-back of annotations (future).

---

## A. Data Flow Architecture

### A.1 Synchronization Direction

```
QA Ops Database (Source of Truth)
         ↓
    Change Detection
         ↓
    Transformation
         ↓
    @roam-research/roam-cli
         ↓
    Roam Local API (127.0.0.1:3333)
         ↓
    Roam Desktop App
         ↓
    Project_Kinergy Graph
```

### A.2 Data Movement Patterns

#### Pattern 1: Initial Export
- Export all test cases, test suites, acceptance criteria from QA Ops
- Create Roam pages in hierarchical structure
- Store QA Ops UIDs in Roam page metadata
- Mark pages with `[[qa-ops-sync]]` tag for tracking

#### Pattern 2: Incremental Sync (On Change)
- Detect modified test case in QA Ops
- Calculate changes (title, description, status, criteria)
- Update corresponding Roam page
- Update metadata timestamp
- Log sync event

#### Pattern 3: New Entity Creation
- User creates test case in QA Ops
- Auto-sync triggered (on save or on schedule)
- Create corresponding Roam page
- Link to parent test suite
- Return sync status to user

#### Pattern 4: Entity Deletion
- Mark deleted in QA Ops (soft delete)
- Archive corresponding Roam page (add `[[archived]]` tag, do NOT delete)
- Log deletion event
- Never permanently delete Roam pages

### A.3 Data Structure in Roam

#### Page Hierarchy

```
Project_Kinergy
├── Test Suites
│   ├── [Suite Name]
│   │   ├── Tests
│   │   │   ├── [Test Case Name]
│   │   │   │   ├── Acceptance Criteria
│   │   │   │   ├── Test Steps
│   │   │   │   ├── Expected Results
│   │   │   │   ├── Actual Results (append-only)
│   │   │   │   └── Status
│   │   │   └── [Test Case Name 2]
│   │   └── Suite Metadata
│   └── [Suite Name 2]
├── Test Runs
│   ├── [Run ID: YYYY-MM-DD HH:MM:SS]
│   │   ├── Results Summary
│   │   ├── Passed: N, Failed: N
│   │   └── Result Details (per test)
├── QA Ops Sync Log
│   ├── Last Sync: YYYY-MM-DD HH:MM:SS
│   ├── Status: OK / FAILED
│   └── Events
└── Tags
    ├── [[qa-ops-sync]] - Synced from QA Ops
    ├── [[qa-ops-manual]] - Manually created in Roam
    ├── [[archived]] - Soft-deleted in QA Ops
    └── [[qa-ops-conflict]] - Conflict detected
```

#### Metadata Block (per synced page)

Every Roam page created by sync includes metadata block:

```markdown
# [Test Case Title]

## Metadata
- qa-ops-id: {test-case-uuid}
- qa-ops-suite-id: {suite-uuid}
- qa-ops-type: test-case | suite | run | acceptance-criteria
- qa-ops-last-sync: 2026-06-15T10:00:00Z
- qa-ops-version: {hash-of-content}
- sync-status: synced | pending-update | conflict | archived
- roam-page-uid: {roam-uid}

## Content
[Synced content from QA Ops]
```

---

## B. Database Changes

### B.1 New Tables/Collections

#### Table: `roam_sync_mapping`

Maps QA Ops entities to Roam pages.

```
Fields:
- id: UUID (primary key)
- qa_ops_entity_type: enum (test_case, test_suite, test_run, acceptance_criteria)
- qa_ops_entity_id: UUID (foreign key to test_cases / test_suites / etc.)
- roam_page_uid: string (Roam page UID)
- roam_page_title: string
- last_synced_at: timestamp
- last_synced_hash: string (SHA256 of QA Ops content)
- roam_last_modified_at: timestamp (from Roam)
- sync_status: enum (synced, pending, conflict, archived)
- conflict_notes: text (human-readable conflict description)
- created_at: timestamp
- updated_at: timestamp

Indexes:
- (qa_ops_entity_type, qa_ops_entity_id) - unique
- (roam_page_uid) - unique
- (sync_status, last_synced_at)
```

#### Table: `roam_sync_events`

Audit trail of all sync operations.

```
Fields:
- id: UUID (primary key)
- mapping_id: UUID (foreign key to roam_sync_mapping)
- event_type: enum (created, updated, deleted, conflict, error)
- direction: enum (qops_to_roam, roam_to_qops, manual)
- qops_snapshot: JSON (state before sync)
- roam_snapshot: JSON (state before sync)
- error_message: text (if event_type = error)
- user_id: UUID (who triggered it, or 'system')
- created_at: timestamp

Indexes:
- (mapping_id, created_at)
- (event_type, created_at)
- (user_id, created_at)
```

#### Table: `roam_sync_config`

Configuration for Roam integration.

```
Fields:
- id: UUID (primary key)
- roam_graph_name: string (Project_Kinergy)
- roam_token: string (encrypted, roam-graph-local-token-*)
- roam_api_port: integer (default 3333)
- sync_enabled: boolean
- auto_sync_interval_minutes: integer (0 = manual only)
- conflict_resolution: enum (manual, prefer_qops, prefer_roam)
- archive_deleted_entities: boolean (true = soft delete)
- created_at: timestamp
- updated_at: timestamp
```

### B.2 Schema Changes (Existing Tables)

#### `test_cases` table

Add columns:
```
- roam_synced: boolean (default false)
- roam_sync_mapping_id: UUID (nullable, foreign key)
- qa_ops_version: string (for conflict detection)
```

#### `test_suites` table

Add columns:
```
- roam_synced: boolean (default false)
- roam_sync_mapping_id: UUID (nullable, foreign key)
- qa_ops_version: string
```

#### `test_runs` table

Add columns:
```
- roam_synced: boolean (default false)
- roam_sync_mapping_id: UUID (nullable, foreign key)
- roam_run_page_uid: string (nullable)
```

### B.3 Migration Strategy

1. **Phase 1**: Create new tables (`roam_sync_mapping`, `roam_sync_events`, `roam_sync_config`)
2. **Phase 2**: Add columns to existing tables (with defaults, non-breaking)
3. **Phase 3**: Enable sync feature flag
4. **Phase 4**: Run initial export (background job)
5. **Phase 5**: Monitor sync events, rollback if needed

**No existing data is modified or lost.**

---

## C. New Services

### C.1 RoamSyncService

High-level orchestration of sync operations.

**Responsibilities:**
- Detect changes in QA Ops (poll or event-driven)
- Orchestrate entity export to Roam
- Manage retry logic
- Handle errors and conflicts
- Maintain audit trail

**Methods:**
- `exportTestCase(testCaseId)`: Export single test case
- `exportTestSuite(suiteId)`: Export suite + all test cases
- `exportTestRun(runId)`: Export test run results
- `syncAll()`: Full sync of all entities
- `getLastSyncStatus()`: Get status of last sync
- `getConflicts()`: List detected conflicts
- `resolveConflict(mappingId, resolution)`: Resolve a conflict

### C.2 RoamCliService

Low-level wrapper around @roam-research/roam-cli.

**Responsibilities:**
- Execute CLI commands
- Parse CLI output
- Map errors to domain exceptions
- Abstract CLI details from domain logic

**Methods:**
- `listGraphs()`: Get available graphs
- `createPage(title, markdown)`: Create Roam page
- `updatePage(uid, title, markdown)`: Update page
- `deletePage(uid)`: Delete page (via archiving)
- `getPage(title)`: Retrieve page
- `search(query)`: Search for pages
- `appendToPage(uid, markdown)`: Append content

**Execution Model:**
```
HTTP Request
    ↓
RoamCliService method
    ↓
Shell subprocess: roam [command] [args]
    ↓
@roam-research/roam-cli process
    ↓
Local API HTTP call
    ↓
Parse JSON response
    ↓
Return typed result or throw exception
```

### C.3 ConflictDetectionService

Identify sync conflicts.

**Responsibilities:**
- Compare QA Ops version with Roam page version
- Detect if Roam page was manually edited
- Flag conflicts for manual resolution
- Track conflict history

**Methods:**
- `hasConflict(mappingId)`: Check if conflict exists
- `getConflictDetails(mappingId)`: Get diff
- `detectManualEdits(mappingId)`: Check if Roam page changed after last sync

**Conflict Types:**
1. **QA Ops Changed, Roam Unchanged**: Auto-update Roam
2. **QA Ops Unchanged, Roam Changed**: Flag as manual edit (conflict)
3. **Both Changed**: Conflict - require manual resolution
4. **QA Ops Deleted**: Archive in Roam, do NOT delete

### C.4 SyncSchedulerService

Background job for periodic sync.

**Responsibilities:**
- Run sync on schedule
- Respect `auto_sync_interval_minutes` config
- Handle job failures gracefully
- Provide status endpoint

**Triggers:**
- Time-based: Every N minutes
- Event-based: On test case creation/update (optional)
- Manual: Via API endpoint

---

## D. New API Routes

### D.1 Sync Management Routes

#### `POST /api/roam/config`

Set up Roam integration.

```
Request:
{
  "roamGraphName": "Project_Kinergy",
  "roamToken": "roam-graph-local-token-...",
  "roamApiPort": 3333,
  "syncEnabled": true,
  "autoSyncIntervalMinutes": 60,
  "conflictResolution": "manual"
}

Response:
{
  "success": true,
  "configId": "uuid",
  "graphConnected": true,
  "message": "Connected to Project_Kinergy"
}
```

#### `GET /api/roam/config`

Get current Roam configuration.

```
Response:
{
  "configId": "uuid",
  "roamGraphName": "Project_Kinergy",
  "syncEnabled": true,
  "autoSyncIntervalMinutes": 60,
  "conflictResolution": "manual",
  "lastSyncAt": "2026-06-15T10:00:00Z",
  "syncStatus": "ok" | "pending" | "error",
  "graphConnected": true
}
```

#### `POST /api/roam/sync`

Trigger immediate sync.

```
Request:
{
  "scope": "all" | "test-case" | "test-suite" | "test-run",
  "entityId": "uuid" (required if scope != all)
}

Response:
{
  "syncId": "uuid",
  "status": "queued" | "in-progress" | "complete",
  "entitiesProcessed": 42,
  "conflicts": 3,
  "errors": 0,
  "createdPages": 40,
  "updatedPages": 2,
  "timestamp": "2026-06-15T10:00:00Z"
}
```

#### `GET /api/roam/sync/:syncId`

Poll sync progress.

```
Response:
{
  "syncId": "uuid",
  "status": "in-progress" | "complete" | "failed",
  "progress": {
    "processed": 42,
    "total": 100,
    "percent": 42
  },
  "results": {
    "created": 40,
    "updated": 2,
    "errors": 0,
    "conflicts": 0
  }
}
```

### D.2 Mapping & Audit Routes

#### `GET /api/roam/mappings`

List all sync mappings.

```
Response:
[
  {
    "mappingId": "uuid",
    "qaOpsEntityType": "test-case",
    "qaOpsEntityId": "uuid",
    "roamPageUid": "abc123",
    "roamPageTitle": "Test Case: Login with Valid Credentials",
    "lastSyncedAt": "2026-06-15T10:00:00Z",
    "syncStatus": "synced" | "pending" | "conflict",
    "roamPageUrl": "roam://path/to/page"
  }
]
```

#### `GET /api/roam/conflicts`

List detected conflicts.

```
Response:
[
  {
    "mappingId": "uuid",
    "qaOpsEntityType": "test-case",
    "qaOpsEntityId": "uuid",
    "roamPageUid": "abc123",
    "conflictType": "both-modified" | "manual-edit",
    "lastDetected": "2026-06-15T10:00:00Z",
    "qaOpsVersion": "hash1",
    "roamVersion": "hash2"
  }
]
```

#### `POST /api/roam/conflicts/:mappingId/resolve`

Resolve a conflict.

```
Request:
{
  "resolution": "prefer-qops" | "prefer-roam" | "manual-merge"
}

Response:
{
  "mappingId": "uuid",
  "resolution": "prefer-qops",
  "syncStatus": "synced",
  "timestamp": "2026-06-15T10:00:00Z"
}
```

#### `GET /api/roam/events`

View sync audit trail.

```
Query Params:
- ?mappingId=uuid (filter)
- ?eventType=created|updated|error (filter)
- ?limit=50
- ?offset=0

Response:
[
  {
    "eventId": "uuid",
    "timestamp": "2026-06-15T10:00:00Z",
    "eventType": "updated",
    "mappingId": "uuid",
    "direction": "qops-to-roam",
    "summary": "Test case 'Login' updated: 2 criteria changed",
    "user": "system",
    "errorMessage": null
  }
]
```

### D.3 Entity Sync Routes

#### `POST /api/test-cases/:id/sync-to-roam`

Manually sync a single test case.

```
Response:
{
  "testCaseId": "uuid",
  "mappingId": "uuid",
  "roamPageUid": "abc123",
  "syncStatus": "synced" | "conflict",
  "timestamp": "2026-06-15T10:00:00Z"
}
```

#### `GET /api/test-cases/:id/roam-status`

Get Roam sync status for a test case.

```
Response:
{
  "testCaseId": "uuid",
  "roamSynced": true,
  "roamPageUid": "abc123",
  "roamPageTitle": "Test Case: ...",
  "lastSyncedAt": "2026-06-15T10:00:00Z",
  "syncStatus": "synced" | "pending-update" | "conflict",
  "roamPageUrl": "roam://path/to/page",
  "conflictNotes": null
}
```

#### `POST /api/test-runs/:id/sync-to-roam`

Sync test run results to Roam.

```
Response:
{
  "testRunId": "uuid",
  "mappingId": "uuid",
  "roamPageUid": "xyz789",
  "resultsSynced": true,
  "timestamp": "2026-06-15T10:00:00Z"
}
```

---

## E. New UI Screens / Components

### E.1 Roam Integration Settings

**Location**: Admin Panel > Settings > Integrations > Roam

**Components**:
- Graph connection status (connected / disconnected)
- Token configuration (masked input)
- Port configuration (default 3333)
- Auto-sync toggle + interval slider (1-1440 minutes)
- Conflict resolution strategy dropdown
- "Test Connection" button
- Sync history table (last 10 syncs)

**Actions**:
- Save configuration
- Test connection to Roam
- View last sync details
- Manual full sync trigger

### E.2 Sync Dashboard

**Location**: Dashboard or new tab "Roam Sync"

**Components**:
- Sync status summary
  - Total entities synced
  - Pending updates
  - Active conflicts
  - Last sync timestamp
- Sync progress bar (during active sync)
- Recent sync events table
  - Event type
  - Entity
  - Timestamp
  - Status
- Quick actions
  - Sync All (full)
  - View Conflicts
  - View Audit Log

### E.3 Test Case Detail Screen - Roam Panel

**Location**: Right sidebar of test case detail

**Components**:
- Roam sync status badge (synced / pending / conflict)
- "Open in Roam" link (if synced)
- Last synced timestamp
- Conflict indicator (if applicable)
- Manual sync button
- Sync history dropdown (last 5 events)

**Actions**:
- View on Roam (open page in new tab)
- Manually sync this test case
- View conflict details
- View full sync history

### E.4 Conflict Resolution Dialog

**Trigger**: User views conflict from dashboard or test case

**Components**:
- Conflict type (both modified / manual edit)
- QA Ops version (with diff highlighting)
- Roam version (with diff highlighting)
- Resolution options
  - Keep QA Ops version (overwrite Roam)
  - Keep Roam version (keep Roam, mark conflict resolved)
  - Manual review (require user to decide)
- "Resolve" button
- "Skip" button

### E.5 Sync Audit Log

**Location**: Settings > Integrations > Roam > Audit Log

**Components**:
- Table with columns:
  - Timestamp
  - Entity Type + ID
  - Event Type (created / updated / deleted / error)
  - Direction (QA Ops → Roam / Roam → QA Ops / Manual)
  - Status (success / failed / conflicted)
  - User
- Filters:
  - Date range
  - Event type
  - Entity type
  - Status
- Detail view (click row to see full event JSON)

---

## F. Sync Workflow

### F.1 Initial Setup Workflow

```
User Action: Enable Roam Integration
    ↓
UI: Show Settings Screen
    ↓
User: Enter graph name, token, port
    ↓
API: POST /api/roam/config
    ↓
RoamCliService: Execute `roam list-graphs`
    ↓
Verify: Graph name matches
    ↓
Success: Save config to DB
    ↓
Background Job: Run initial export (non-blocking)
    ↓
UI: Show "Initial sync in progress" notification
    ↓
Background: exportAll()
    ├── Get all test suites
    ├── For each suite:
    │   ├── Create Roam page for suite
    │   ├── Get all test cases in suite
    │   └── For each test case:
    │       ├── Create Roam page
    │       ├── Add acceptance criteria
    │       └── Create mapping
    ├── Log each created page
    └── Update config: synced = true, lastSyncAt = now
    ↓
UI: "Sync complete" notification
```

### F.2 Incremental Sync Workflow (On-Demand)

```
User Action: Click "Sync" for test case
    ↓
API: POST /api/test-cases/:id/sync-to-roam
    ↓
Service: Check if mapping exists
    ├── If no: Create mapping
    └── If yes: Check for conflicts
    ↓
Conflict Check: Compare hashes
    ├── If no conflict: proceed to update
    └── If conflict: flag and return conflict status
    ↓
RoamCliService: Execute `roam update-page`
    ↓
Update: Set new content + metadata
    ↓
Database: Update roam_sync_mapping
    ├── last_synced_at = now
    ├── last_synced_hash = new hash
    └── sync_status = synced
    ↓
Audit: Create roam_sync_events entry
    ↓
Response: Return {success: true, syncStatus: "synced"}
```

### F.3 Automatic Sync Workflow (Scheduled)

```
SyncSchedulerService: Time-based trigger (every N minutes)
    ↓
Check Config: Is auto_sync_enabled?
    ├── No: Exit
    └── Yes: Continue
    ↓
Query: Get all test cases modified since last sync
    ↓
For each modified test case:
    ├── Get current state
    ├── Get mapping (if exists)
    ├── Check for conflicts
    ├── If no conflict: Update Roam page
    ├── If conflict: Flag and skip (human resolution needed)
    └── Log event
    ↓
Summary: Log sync completion
    ├── Entities checked: N
    ├── Updated: M
    ├── Conflicts: K
    ├── Errors: L
    ↓
Store: Update roam_sync_config.lastSyncAt
```

### F.4 Test Run Results Sync

```
User Action: Test run completed
    ↓
Event: test-run-completed
    ↓
RoamSyncService: exportTestRun(runId)
    ↓
If mapping exists:
    ├── Update existing results page
    └── Append new results
Else:
    ├── Create new page
    └── Create mapping
    ↓
Page Structure:
    Test Run: 2026-06-15 10:00:00
    ├── Summary
    │   ├── Total: 50
    │   ├── Passed: 48
    │   ├── Failed: 2
    │   └── Duration: 5m 23s
    ├── Failed Tests
    │   ├── Test Case: Login
    │   │   └── Error: [stack trace]
    │   └── Test Case: Logout
    │       └── Error: [stack trace]
    └── Metadata
        └── qa-ops-run-id: uuid
```

---

## G. Conflict Handling Strategy

### G.1 Conflict Types

#### Type 1: QA Ops Changed, Roam Unchanged

**Detection**:
```
roam_sync_mapping.last_synced_hash != hash(current_qops_state)
AND
roam_page_version == roam_last_known_version
```

**Action**: Auto-update Roam (no user intervention)

#### Type 2: QA Ops Unchanged, Roam Changed

**Detection**:
```
roam_sync_mapping.last_synced_hash == hash(current_qops_state)
AND
roam_page_version != roam_last_known_version
```

**Action**: Flag as "manual edit", require user decision:
- Option A: Keep Roam changes (backport to QA Ops?)
- Option B: Overwrite Roam with QA Ops state
- Option C: Acknowledge and don't sync again (manual edit preserved)

#### Type 3: Both Changed

**Detection**:
```
roam_sync_mapping.last_synced_hash != hash(current_qops_state)
AND
roam_page_version != roam_last_known_version
```

**Action**: Escalate to manual resolution
- Show QA Ops version
- Show Roam version
- Show diff
- User selects which to keep
- Log resolution

#### Type 4: Deleted in QA Ops

**Detection**:
```
test_case.deleted_at IS NOT NULL
AND
roam_sync_mapping exists
```

**Action**: Archive in Roam (never delete)
- Add `[[archived]]` tag to page
- Add "Archived from QA Ops" note
- Keep page readable (for history)
- Keep mapping record
- Allow undelete in future

### G.2 Conflict Resolution Strategies

**Strategy 1: Manual (Default)**
- User must explicitly resolve conflicts
- Conflicts block auto-sync
- UI highlights conflicts
- Requires human judgment

**Strategy 2: Prefer QA Ops**
- Auto-overwrite Roam with QA Ops
- Log each overwrite
- Use case: QA Ops is source of truth (strict)
- Warning: May lose manual Roam edits

**Strategy 3: Prefer Roam**
- Keep Roam version, don't update
- Log that Roam is ahead
- Use case: Collaborative Roam editing
- Warning: QA Ops changes won't propagate

### G.3 Conflict Detection Implementation

```
Function: detectConflict(mappingId)
  current_qops_hash = SHA256(qops_entity_current_state)
  last_synced_hash = roam_sync_mapping.last_synced_hash
  roam_page = getPageFromRoam(roam_sync_mapping.roam_page_uid)
  current_roam_hash = SHA256(roam_page.markdown)
  roam_last_known_hash = roam_sync_mapping.roam_page_version

  if current_qops_hash == last_synced_hash AND 
     current_roam_hash == roam_last_known_hash:
    return NO_CONFLICT  // Both unchanged

  if current_qops_hash != last_synced_hash AND 
     current_roam_hash == roam_last_known_hash:
    return QOPS_CHANGED  // Auto-update

  if current_qops_hash == last_synced_hash AND 
     current_roam_hash != roam_last_known_hash:
    return ROAM_CHANGED  // Manual edit detected

  if current_qops_hash != last_synced_hash AND 
     current_roam_hash != roam_last_known_hash:
    return BOTH_CHANGED  // Conflict, require resolution
```

---

## H. Error Handling

### H.1 Error Categories

#### Category 1: Connection Errors

**Possible Errors**:
- Roam Desktop not running
- Wrong port configured
- Token revoked
- Network unreachable

**Handling**:
```
try:
  RoamCliService.execute(command)
catch ConnectionError:
  Log error to roam_sync_events
  Update config.lastSyncStatus = "connection_error"
  Return error to UI with diagnostic info:
    - "Is Roam Desktop running?"
    - "Check port: 3333"
    - "Is token valid? (expires?)"
  Mark sync as FAILED
  Retry with exponential backoff (1m, 5m, 15m)
```

#### Category 2: Permission Errors

**Possible Errors**:
- Token has insufficient access level
- Graph name wrong
- User account permissions changed

**Handling**:
```
catch PermissionError:
  Log to roam_sync_events
  Return error: "Access denied. Check token access level (read-only / read-append / full)"
  Suggest: Re-run `roam setup-new-graph`
  Mark sync as FAILED
  Do NOT retry automatically
  Require manual intervention
```

#### Category 3: Validation Errors

**Possible Errors**:
- Page title invalid
- Content too large
- Markdown syntax error

**Handling**:
```
catch ValidationError:
  Log details to roam_sync_events
  Return structured error with field names
  Example: {
    error: "markdown_syntax_error",
    field: "description",
    details: "Invalid heading nesting"
  }
  Mark sync_status = "validation_error"
  Suggest: Review test case in QA Ops
  Do NOT retry
```

#### Category 4: Data Integrity Errors

**Possible Errors**:
- Mapping missing parent entity
- Orphaned mapping
- Circular references

**Handling**:
```
catch IntegrityError:
  Log to roam_sync_events with context
  Attempt automatic recovery:
    - Recreate mapping
    - Update references
    - Check consistency
  If recovery succeeds: Retry sync
  If recovery fails: 
    - Mark as "integrity_error"
    - Alert admin
    - Do NOT retry
```

### H.2 Retry Strategy

```
Configuration:
  max_retries = 3
  backoff_strategy = exponential
  base_delay = 60 seconds  // 1 minute
  
Retry Delays:
  Attempt 1: Immediate
  Attempt 2: 1 minute later
  Attempt 3: 5 minutes later
  Attempt 4: 15 minutes later
  Failure: Alert admin

Retry Only For:
  - Connection errors (transient)
  - Rate limiting
  - Network timeouts
  
Never Retry:
  - Permission errors
  - Validation errors
  - Integrity errors
```

### H.3 Error Logging & Monitoring

**Log Entry Structure**:
```json
{
  "timestamp": "2026-06-15T10:00:00Z",
  "eventType": "error",
  "errorCode": "ROAM_CONNECTION_ERROR",
  "errorMessage": "Failed to connect to Roam Desktop",
  "errorDetails": {
    "rootCause": "ECONNREFUSED at 127.0.0.1:3333",
    "attemptNumber": 2,
    "nextRetryAt": "2026-06-15T10:05:00Z"
  },
  "mappingId": "uuid",
  "qaOpsEntityId": "uuid",
  "syncCommand": "roam update-page --uid abc123 ...",
  "duration_ms": 5000,
  "retryable": true
}
```

**Monitoring**:
- Alert admin if error rate > 5% in 1 hour
- Alert admin if any single sync fails > 3 times
- Dashboard shows error count and types
- Email summary of failures (daily)

---

## I. Future Extensibility

### I.1 AI-Generated Test Cases

**Future Feature**: Generate test cases from user description using Claude

**Integration Points**:
```
User Input: "Test login flow with valid and invalid credentials"
  ↓
AI Service: generateTestCases(description) → {name, steps, criteria}
  ↓
QA Ops: Create test cases (batch)
  ↓
RoamSyncService: exportTestCases(batchId)
  ↓
Roam: Pages created with [[ai-generated]] tag
```

**Database Changes**:
- Add `generated_by` column (ai | human)
- Add `generation_id` (link to generation batch)
- Add `confidence_score` (0-100)

### I.2 Acceptance Criteria Generation

**Future Feature**: Auto-generate acceptance criteria from test steps

**Flow**:
```
Test Case created in QA Ops
  ↓
Event: on_test_case_created
  ↓
AI Service: generateAcceptanceCriteria(test_steps) → [criteria]
  ↓
Suggest to user: "Accept AI-generated criteria?"
  ├── Accept: Save + sync to Roam
  └── Edit: User modifies then saves
```

**Roam Integration**:
- Mark criteria as `[[ai-suggested]]` for visibility
- Preserve Roam version if manually edited

### I.3 Repository Analysis

**Future Feature**: Analyze code repo to suggest test cases

**Integration**:
```
Admin: Configure repository path
  ↓
RepoAnalysisService: scan(repo_path) → {files, functions, complexity}
  ↓
AI Service: suggestTestCases(repo_analysis)
  ↓
QA Ops: Display suggestions
  ↓
User: Create from suggestions
  ↓
RoamSyncService: Sync new test cases
```

**Roam Tags**:
- `[[suggested-from-repo]]`
- `[[analyzed-file: path/to/file.js]]`

### I.4 Playwright Test Generation

**Future Feature**: Generate Playwright E2E tests from test cases

**Flow**:
```
Test Case in QA Ops (manual, AI-generated, or repo-suggested)
  ↓
PlaywrightGeneratorService: generateTest(test_case)
  ↓
Output: playwright.spec.js
  ↓
Store: Link test case to generated test file
  ↓
Roam: Link to generated test (reference only)
```

**Roam Integration**:
- Add block: `GitHub Link: [path/to/test.spec.js]`
- Add block: `[[generated-by: playwright-generator]]`

### I.5 Jira Integration

**Future Feature**: Sync QA Ops test runs to Jira stories/tasks

**Architecture**:
```
Test Run completed in QA Ops
  ↓
Event: on_test_run_completed
  ↓
JiraService: createComment(jira_issue_id, test_results)
  ↓
Also: RoamSyncService: exportTestRun(run_id)
  ↓
Both systems updated: Jira + Roam
```

**Database Changes**:
- Add `jira_issue_id` to test cases (optional)
- Add `jira_sync_status` to test runs
- Track Jira comment URLs

**Roam Integration**:
- Add block: `Jira: [link to issue]`
- Add block: `[[synced-to-jira]]`

### I.6 Bi-directional Sync (Future, Phase 2)

**Not in Phase 1. Design for future.**

```
Current: QA Ops → Roam (one-way)
Future: QA Ops ↔ Roam (two-way, with conflict handling)

Considerations:
- Who wins in conflicts? (conflict resolution strategy)
- Roam annotations/comments → QA Ops? (backport)
- Roam tagging system → QA Ops categories?
- Change detection from Roam? (listener pattern)
- Audit trail of Roam → QA Ops changes?
```

**Design Approach**:
- Separate `RoamToQOpsService` for reading back
- Extended conflict detection
- More granular version hashing
- Possible: Roam webhooks (if Roam supports)

---

## J. Repository Intelligence Architecture

### J.1 Overview

Repository Intelligence enables QA Ops to analyze code repositories and use the analysis to generate intelligent test cases. This architecture provides AI with deep understanding of application structure, APIs, validation logic, and dependencies.

**Key Principle**: Analyze once, store results, reuse for multiple test case generations.

### J.2 Repository Registration

#### J.2.1 Database Schema

**New Table: `repositories`**

```
Fields:
- id: UUID (primary key)
- project_id: UUID (foreign key to projects)
- repository_type: enum (frontend | backend | monorepo | microservice)
- repository_name: string (e.g., "web-app", "api-service")
- repository_url: string (GitHub, GitLab, or local path)
- repository_branch: string (default: main)
- analysis_status: enum (not_analyzed | analyzing | analyzed | error)
- last_analyzed_at: timestamp (nullable)
- analysis_error_message: text (nullable)
- metadata: JSON (tech stack, framework, language)
- created_at: timestamp
- updated_at: timestamp

Indexes:
- (project_id, repository_type)
- (analysis_status, last_analyzed_at)
```

**New Table: `repository_analyses`**

```
Fields:
- id: UUID (primary key)
- repository_id: UUID (foreign key)
- analysis_version: integer (for tracking schema versions)
- analysis_timestamp: timestamp
- analysis_duration_ms: integer
- files_scanned: integer
- errors_found: integer
- module_map: JSON (see J.2.2)
- api_map: JSON (see J.2.3)
- validation_map: JSON (see J.2.4)
- dependency_graph: JSON (see J.2.5)
- created_at: timestamp

Indexes:
- (repository_id, analysis_timestamp DESC) - latest analysis
- (repository_id) - for retrieving current analysis
```

**New Table: `repository_files_index`**

```
Fields:
- id: UUID
- repository_id: UUID
- file_path: string
- file_type: enum (component | service | controller | utility | test | config)
- file_size_bytes: integer
- language: string (typescript | javascript | python | java | etc)
- is_test_file: boolean
- last_indexed_at: timestamp

Indexes:
- (repository_id, file_type)
- (repository_id, language)
```

#### J.2.2 User Registration Workflow

```
Admin/Project Manager Action: Register Repository
    ↓
UI: Show Repository Registration Form
    ├── Repository Name
    ├── Repository URL (GitHub link or local path)
    ├── Repository Type (FE / BE / Monorepo)
    ├── Branch (default: main)
    ├── Tech Stack (optional: auto-detect from package.json, pom.xml, etc)
    └── Access Token (if private repo)
    ↓
API: POST /api/projects/:projectId/repositories
    ↓
Validation:
    ├── Repository exists and is accessible
    ├── Branch exists
    ├── Has read permissions
    └── Tech stack detected
    ↓
Database: Insert into repositories table
    ├── status = "not_analyzed"
    ├── metadata = {detected_stack}
    ↓
Response: Show confirmation
    ├── Repository registered successfully
    ├── "Analysis not yet run. Click 'Analyze Now' to begin."
    └── Queued analysis button
```

### J.3 Repository Analysis

#### J.3.1 Analysis Components

**Component 1: Module Map**

Discovers and catalogs all modules in the codebase.

```json
{
  "modules": [
    {
      "name": "AuthModule",
      "path": "src/modules/auth",
      "type": "feature-module",
      "exports": ["LoginComponent", "AuthService", "AuthGuard"],
      "dependencies": ["CommonModule", "HttpClientModule"],
      "description": "Authentication and authorization",
      "complexity_score": 7.5,
      "test_coverage": 85
    },
    {
      "name": "ProductModule", 
      "path": "src/modules/products",
      "type": "feature-module",
      "exports": ["ProductListComponent", "ProductDetailComponent", "ProductService"],
      "dependencies": ["AuthModule", "CommonModule"],
      "description": "Product catalog and search",
      "complexity_score": 6.2,
      "test_coverage": 72
    }
  ],
  "total_modules": 12,
  "estimated_complexity": 6.8
}
```

**Component 2: API Map**

Catalogs all API endpoints, parameters, and responses.

```json
{
  "endpoints": [
    {
      "method": "POST",
      "path": "/api/v1/auth/login",
      "controller": "AuthController",
      "handler": "login",
      "parameters": {
        "body": {
          "email": "string (required)",
          "password": "string (required)"
        }
      },
      "responses": {
        "200": {
          "token": "string",
          "user_id": "uuid",
          "expires_at": "timestamp"
        },
        "401": "Invalid credentials",
        "400": "Validation error"
      },
      "auth_required": true,
      "rate_limit": "100/hour",
      "documentation_url": "docs/auth.md"
    },
    {
      "method": "GET",
      "path": "/api/v1/products/:id",
      "controller": "ProductController",
      "handler": "getById",
      "parameters": {
        "path": {
          "id": "uuid (required)"
        },
        "query": {
          "include": "string[] (relations to include)"
        }
      },
      "responses": {
        "200": { "product": "ProductDTO" },
        "404": "Product not found"
      },
      "auth_required": false
    }
  ],
  "total_endpoints": 34,
  "authenticated_endpoints": 24
}
```

**Component 3: Validation Map**

Discovers validation rules, constraints, and business logic.

```json
{
  "validations": [
    {
      "entity": "User",
      "field": "email",
      "rules": [
        { "type": "required" },
        { "type": "pattern", "value": "^[^@]+@[^@]+\\.[^@]+$" },
        { "type": "max_length", "value": 255 }
      ],
      "error_messages": {
        "required": "Email is required",
        "pattern": "Invalid email format",
        "max_length": "Email too long"
      }
    },
    {
      "entity": "Product",
      "field": "price",
      "rules": [
        { "type": "required" },
        { "type": "numeric" },
        { "type": "min", "value": 0.01 },
        { "type": "decimal_places", "value": 2 }
      ]
    },
    {
      "entity": "Order",
      "field": "items",
      "rules": [
        { "type": "required" },
        { "type": "array_min_length", "value": 1 },
        { "type": "array_max_length", "value": 100 }
      ]
    }
  ],
  "total_validations": 67,
  "coverage_by_entity": {
    "User": 12,
    "Product": 8,
    "Order": 10
  }
}
```

**Component 4: Dependency Graph**

Maps relationships between modules, services, and components.

```json
{
  "nodes": [
    {
      "id": "AuthService",
      "type": "service",
      "location": "src/services/auth.service.ts",
      "dependencies": ["HttpClient", "TokenService"]
    },
    {
      "id": "ProductService",
      "type": "service",
      "location": "src/services/product.service.ts",
      "dependencies": ["HttpClient", "AuthService"]
    },
    {
      "id": "LoginComponent",
      "type": "component",
      "location": "src/components/login/login.component.ts",
      "dependencies": ["AuthService", "Router"]
    }
  ],
  "edges": [
    { "from": "LoginComponent", "to": "AuthService", "type": "injection" },
    { "from": "AuthService", "to": "TokenService", "type": "dependency" },
    { "from": "ProductService", "to": "AuthService", "type": "dependency" }
  ],
  "circular_dependencies": [],
  "deepest_dependency_chain": 4
}
```

#### J.3.2 Analysis Workflow

```
User Action: Click "Analyze Repository"
    ↓
UI: Show "Analysis starting..." with progress indicator
    ↓
API: POST /api/repositories/:repoId/analyze
    ↓
Background Job: RepositoryAnalysisService.analyze(repoId)
    ├── Update status = "analyzing"
    ├── Fetch repository code (git clone or API)
    ├── Scan files and structure
    ├── Run Module Analysis
    │   ├── Parse import statements
    │   ├── Build dependency tree
    │   └── Calculate complexity metrics
    ├── Run API Analysis
    │   ├── Parse controller/route definitions
    │   ├── Extract endpoint metadata
    │   └── Map request/response types
    ├── Run Validation Analysis
    │   ├── Find validator decorators (@IsEmail, etc)
    │   ├── Extract validation rules
    │   └── Map error messages
    ├── Run Dependency Graph Analysis
    │   ├── Build node list
    │   ├── Build edge list
    │   ├── Detect circular dependencies
    │   └── Calculate depth metrics
    ├── Store results in repository_analyses table
    ├── Create file index in repository_files_index table
    ├── Update status = "analyzed"
    └── Log duration and statistics
    ↓
Database: Store complete analysis
    ├── module_map: JSON
    ├── api_map: JSON
    ├── validation_map: JSON
    ├── dependency_graph: JSON
    ├── last_analyzed_at: now
    ├── analysis_status: "analyzed"
    ↓
UI: Auto-refresh shows "Analysis Complete"
    ├── Modules discovered: 12
    ├── Endpoints found: 34
    ├── Validations mapped: 67
    ├── Analysis took: 2m 15s
    └── "Generate test cases from this analysis?" button
```

#### J.3.3 On-Demand Refresh

```
User Action: Click "Refresh Analysis"
    ↓
Confirmation Dialog:
    ├── "This will re-analyze the repository"
    ├── "Last analysis: 2 days ago"
    ├── "Confirm? [Cancel] [Refresh]"
    ↓
API: POST /api/repositories/:repoId/analyze?force=true
    ↓
Same workflow as J.3.2
    ↓
Previous analysis kept in database
    ├── repository_analyses table has version history
    ├── Can compare analyses over time
    └── Can rollback if needed
```

### J.4 Test Case Generation from Repository Analysis

#### J.4.1 Generation Modes

**Mode 1: From Requirements Only**

```
User Input: Test Requirements/User Story
    ↓
AI Service: generateTestCases(requirements)
    ├── Parse requirements
    ├── Identify test scenarios
    ├── Generate test steps
    ├── Generate acceptance criteria
    └── Output: Test Cases (generic, code-agnostic)
```

**Mode 2: From Repository Analysis Only**

```
User Action: Select "Generate from Repository"
    ↓
UI: Show repository structure
    ├── [x] LoginModule - 3 test cases
    ├── [x] ProductModule - 5 test cases
    ├── [ ] CartModule - 4 test cases
    └── "Generate selected modules"
    ↓
AI Service: generateTestCases(modules_selected)
    ├── Analyze selected modules
    ├── Generate tests for:
    │   ├── Public API endpoints
    │   ├── Validation rules
    │   ├── Error scenarios
    │   └── Happy path flows
    ├── Map to code paths
    └── Output: Code-aware Test Cases
```

**Mode 3: Combined (Requirements + Repository Analysis)**

```
User Input: Requirement text
    ↓
User Selects: Repository modules
    ↓
AI Service: generateTestCases(requirements, modules)
    ├── Parse requirements
    ├── Map requirements to modules
    ├── Map requirements to API endpoints
    ├── Map requirements to validation rules
    ├── Generate comprehensive test cases:
    │   ├── Functional tests (from requirements)
    │   ├── API contract tests (from API map)
    │   ├── Validation tests (from validation map)
    │   ├── Integration tests (from dependency graph)
    │   └── Edge case tests
    └── Output: Rich, context-aware Test Cases
```

#### J.4.2 Test Case Generation Workflow

```
User Action: Click "Generate Test Cases"
    ↓
UI: Show Generation Options
    ├── Radio: "From Requirements Only"
    ├── Radio: "From Repository Analysis"
    ├── Radio: "Combined (Recommended)"
    ├── If Combined selected:
    │   ├── Text area: Paste requirements
    │   ├── Checkbox list: Select modules
    │   └── "Generate" button
    ↓
API: POST /api/projects/:projectId/test-cases/generate
    {
      "mode": "combined",
      "requirements": "User should be able to login with email and password...",
      "repositoryId": "uuid",
      "selectedModules": ["AuthModule", "ProductModule"],
      "testType": "manual" (vs "automated")
    }
    ↓
Background Job: TestCaseGenerationService.generate()
    ├── Retrieve repository analysis
    ├── Get selected modules from module_map
    ├── Get API endpoints for those modules from api_map
    ├── Get validation rules from validation_map
    ├── Get dependencies from dependency_graph
    ├── Call AI Service:
    │   AIGenerationService.generateTestCases({
    │     requirements,
    │     modules,
    │     endpoints,
    │     validations,
    │     dependencies
    │   })
    ├── AI returns:
    │   {
    │     test_cases: [
    │       {
    │         title: "Login with valid email and password",
    │         description: "...",
    │         preconditions: ["User account exists"],
    │         steps: [
    │           {step_number, action, expected_result}
    │         ],
    │         acceptance_criteria: [...],
    │         related_api_endpoint: "/api/v1/auth/login",
    │         related_module: "AuthModule",
    │         confidence_score: 0.95,
    │         data_requirements: ["valid_email", "valid_password"]
    │       },
    │       ...
    │     ]
    │   }
    ├── Create test cases in QA Ops database
    ├── Tag with:
    │   - [[generated-from-requirements]]
    │   - [[generated-from-repository]]
    │   - [[confidence-score: 95]]
    │   - [[related-endpoints: /api/v1/auth/login]]
    │   - [[related-modules: AuthModule]]
    ├── Return summary to UI
    └── Auto-sync to Roam
    ↓
Response:
    {
      "test_cases_created": 12,
      "generation_confidence_avg": 0.91,
      "modules_covered": 2,
      "endpoints_covered": 5,
      "timestamp": "2026-06-15T10:00:00Z",
      "test_cases": [
        {
          "id": "uuid",
          "title": "Login with valid email and password",
          "roam_page_uid": "abc123",
          "confidence_score": 0.95
        }
      ]
    }
    ↓
UI: Show "Test cases generated successfully"
    ├── 12 test cases created
    ├── Average confidence: 91%
    ├── Modules covered: 2 (AuthModule, ProductModule)
    ├── API endpoints covered: 5
    └── "View generated test cases" link
```

### J.5 Database Changes for Repository Intelligence

**New Columns on `test_cases` table**:
```
- generated_from_repository: boolean (default false)
- repository_id: UUID (nullable, foreign key)
- related_api_endpoint: string (nullable)
- related_modules: string[] (nullable, JSON array)
- generation_confidence_score: decimal (0-1, nullable)
- generation_source: enum (manual | from_requirements | from_repository | combined)
```

**New Columns on `test_suites` table**:
```
- repository_id: UUID (nullable, foreign key)
- derived_from_modules: string[] (nullable, JSON array)
```

### J.6 New Services

#### J.6.1 RepositoryAnalysisService

Orchestrates repository analysis.

**Methods**:
- `analyzeRepository(repositoryId)`: Trigger analysis
- `getLatestAnalysis(repositoryId)`: Retrieve stored analysis
- `compareAnalyses(analysisId1, analysisId2)`: Show what changed
- `getAnalysisStatus(repositoryId)`: Check progress

#### J.6.2 AIGenerationService

Generates test cases using AI (Claude or similar).

**Methods**:
- `generateFromRequirements(requirements)`: Generate tests from text
- `generateFromRepositoryAnalysis(modules, endpoints, validations)`: Generate from code
- `generateCombined(requirements, analysis)`: Merge both
- `estimateConfidence(testCase)`: Score quality

#### J.6.3 RepositoryIndexService

Indexes files and maintains search capability.

**Methods**:
- `indexRepository(repositoryId)`: Build file index
- `searchFiles(repositoryId, query)`: Find relevant files
- `getFilesByType(repositoryId, type)`: Get components, services, etc.

### J.7 New API Routes

#### `POST /api/projects/:projectId/repositories`

Register a repository.

```
Request:
{
  "repositoryName": "web-app",
  "repositoryUrl": "https://github.com/company/web-app",
  "repositoryType": "frontend",
  "branch": "main",
  "accessToken": "ghp_..." (optional, for private repos)
}

Response:
{
  "repositoryId": "uuid",
  "status": "registered",
  "message": "Repository registered. Analysis not yet run.",
  "nextAction": "POST /api/repositories/uuid/analyze"
}
```

#### `GET /api/projects/:projectId/repositories`

List all registered repositories.

```
Response:
[
  {
    "repositoryId": "uuid",
    "repositoryName": "web-app",
    "repositoryType": "frontend",
    "analysisStatus": "analyzed" | "analyzing" | "error",
    "lastAnalyzedAt": "2026-06-15T10:00:00Z",
    "modulesDiscovered": 12,
    "endpointsFound": 34,
    "validationsMapped": 67
  }
]
```

#### `POST /api/repositories/:repoId/analyze`

Trigger repository analysis.

```
Query: ?force=true (to re-analyze)

Response:
{
  "analysisId": "uuid",
  "status": "queued",
  "message": "Analysis started. Estimated time: 5 minutes.",
  "progressUrl": "GET /api/repositories/uuid/analysis/progress"
}
```

#### `GET /api/repositories/:repoId/analysis`

Get latest analysis results.

```
Response:
{
  "analysisId": "uuid",
  "repositoryId": "uuid",
  "analyzedAt": "2026-06-15T10:00:00Z",
  "moduleMap": { modules: [...] },
  "apiMap": { endpoints: [...] },
  "validationMap": { validations: [...] },
  "dependencyGraph": { nodes: [...], edges: [...] },
  "summary": {
    "modulesDiscovered": 12,
    "endpointsFound": 34,
    "validationsMapped": 67,
    "estimatedComplexity": 6.8
  }
}
```

#### `GET /api/repositories/:repoId/analysis/progress`

Poll analysis progress (for long-running analyses).

```
Response:
{
  "status": "analyzing" | "complete" | "error",
  "progress": {
    "currentStep": "Building module map",
    "percent": 45
  },
  "estimatedSecondsRemaining": 180,
  "errors": []
}
```

#### `POST /api/projects/:projectId/test-cases/generate`

Generate test cases from requirements and/or repository analysis.

```
Request:
{
  "mode": "combined" | "requirements-only" | "repository-only",
  "requirements": "User story text...",
  "repositoryId": "uuid" (required if mode includes repository),
  "selectedModules": ["AuthModule", "ProductModule"],
  "testType": "manual" | "automated"
}

Response:
{
  "testCasesCreated": 12,
  "generationConfidenceAvg": 0.91,
  "modulesCovered": ["AuthModule", "ProductModule"],
  "endpointsCovered": 5,
  "testCases": [
    {
      "id": "uuid",
      "title": "Login with valid credentials",
      "confidenceScore": 0.95,
      "relatedEndpoint": "/api/v1/auth/login",
      "relatedModules": ["AuthModule"]
    }
  ]
}
```

#### `GET /api/repositories/:repoId/analysis/compare`

Compare two analyses (for detecting changes over time).

```
Query: ?from=analysisId1&to=analysisId2

Response:
{
  "newModules": ["NewModule"],
  "deletedModules": [],
  "modifiedModules": ["ProductModule"],
  "newEndpoints": [{ method: "GET", path: "/api/v2/products/search" }],
  "deletedEndpoints": [],
  "modifiedValidations": 3,
  "summary": {
    "totalChanges": 8,
    "breakingChanges": 1
  }
}
```

### J.8 UI Screens for Repository Intelligence

#### J.8.1 Repository Management Screen

**Location**: Admin Panel > Repositories

**Components**:
- List of registered repositories
  - Name, Type, Last Analyzed, Status
  - "Analyze Now" button per repo
  - "View Analysis" link
  - "Delete" button (archive)
- "Register New Repository" button → Form dialog
- Analysis history table
  - Analysis date
  - Modules found
  - Endpoints found
  - Duration
  - Result size

#### J.8.2 Analysis Details Screen

**Location**: Admin > Repository > [Name] > Analysis

**Components**:
- Summary statistics
  - Modules: 12
  - Endpoints: 34
  - Validations: 67
  - Dependencies: Avg depth 3.2
- Module Explorer (tree view)
  - Expandable module list with metrics
  - Click to see dependencies, exports, complexity
- API Endpoint Browser
  - Filterable list of endpoints
  - Click to see method, path, auth, params, responses
- Validation Rule Browser
  - Entity-organized validation rules
  - Error messages
- Dependency Visualizer
  - Graph visualization (if library available)
  - Show circular dependencies (warning)
- "Generate Test Cases from This Analysis" button

#### J.8.3 Test Case Generation Screen

**Location**: Test Cases > Generate > "From Repository"

**Components**:
- Generation mode selector
  - Radio: "From Requirements Only"
  - Radio: "From Repository Analysis"
  - Radio: "Combined (Recommended)"
- If "Requirements Only":
  - Text area: Paste requirements
  - "Generate" button
- If "Repository Only":
  - Repository dropdown
  - Module selector (checkboxes with counts)
    - AuthModule (3 tests)
    - ProductModule (5 tests)
    - CartModule (4 tests)
  - Test type toggle (Manual / Automated)
  - "Generate" button
- If "Combined":
  - Requirements text area
  - Repository dropdown
  - Module selector
  - Test type toggle
  - "Generate" button
- Generation progress (during)
  - "Generating 12 test cases..."
  - Progress bar
- Results view (after)
  - Summary: "12 test cases created"
  - Average confidence: 91%
  - Modules covered: 2
  - Endpoints covered: 5
  - List of created test cases (preview)
  - "View all" link

### J.9 Conflict Handling in Generated Tests

#### Scenario 1: Manual Test Case vs Generated Test Case

```
If user has manual test case for "Login":
    ├── Check if generated test case "Login" already exists
    ├── If exists:
    │   ├── Compare content (requirement, steps, criteria)
    │   ├── If 90%+ similar: Skip generation (already covered)
    │   ├── If <90% similar: Create as separate test case
    │   │   └── Add tag [[generated-variant]]
    │   └── Log decision
    └── If doesn't exist: Create normally
```

#### Scenario 2: API Endpoint Removed

```
If repository analysis shows endpoint removed:
    ├── Find related test cases (via related_api_endpoint)
    ├── Flag those test cases with [[deprecated-endpoint]]
    ├── Notify user: "3 test cases reference removed endpoint"
    ├── Suggest: Archive test cases or update them
    └── Do NOT auto-delete test cases
```

### J.10 Error Handling for Repository Analysis

#### Error 1: Repository Not Accessible

```
Trigger: analyzeRepository(repoId)
Error: HTTP 403, SSH key not configured, etc.
Handling:
  ├── Log to repository_analyses with error_message
  ├── Update repositories.analysis_status = "error"
  ├── Return user-friendly message:
  │   "Cannot access repository. Check URL and authentication."
  ├── Suggest: Verify GitHub token, SSH key, or URL
  └── Mark as "error" (not "analyzed")
```

#### Error 2: Unsupported Technology Stack

```
Trigger: analyzeRepository(repoId) for unknown language
Error: Repository is in Rust, but no Rust parser available
Handling:
  ├── Log error
  ├── Return: "Repository technology not yet supported"
  ├── Store detected tech stack for future use
  └── Suggest: File feature request for Rust support
```

#### Error 3: Analysis Timeout

```
Trigger: analyzeRepository(repoId) for massive monorepo
Error: Analysis exceeded 30 minute timeout
Handling:
  ├── Partial analysis: Save what was completed
  ├── Mark status = "partial"
  ├── Log what failed (e.g., "Dependency analysis timed out")
  ├── Return: "Analysis partially complete"
  ├── Suggest: Analyze sub-modules separately
  ├── Store partial results for use
  └── Allow user to continue with partial analysis
```

### J.11 Future Extensions: Test Generation

#### Phase 2a: Playwright Generation

```
Input: Generated test case (from repository analysis)
Output: Playwright test code

Example:
Test Case:
  - Title: "Login with valid credentials"
  - Steps:
    1. Navigate to login page
    2. Enter email: valid@example.com
    3. Enter password: SecurePass123
    4. Click submit
  - Expected: User logged in, redirected to dashboard

Generated Playwright Code:
  test('Login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'valid@example.com');
    await page.fill('input[type="password"]', 'SecurePass123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });
```

**Implementation**:
- PlaywrightGeneratorService
- Maps test steps to Playwright API calls
- Handles selectors (from repository analysis if available)
- Generates data-driven tests
- Links generated test file back to test case

#### Phase 2b: API Automation Generation

```
Input: API endpoint from api_map + related test case
Output: API test code (REST client, Postman collection, or REST Assured)

Example from api_map:
  POST /api/v1/auth/login
  Body: { email, password }
  Response: { token, user_id, expires_at }

Generated API Test:
  test('POST /api/v1/auth/login - Valid credentials', () => {
    const response = request()
      .post('/api/v1/auth/login')
      .send({ email: 'valid@example.com', password: 'SecurePass123' })
      .expect(200);
    
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('user_id');
  });
```

**Implementation**:
- APITestGeneratorService
- Maps endpoint definitions to test code
- Supports multiple frameworks (Jest, Mocha, REST Assured, etc)
- Generates happy path + error case tests
- Uses validation_map for error scenarios

#### Phase 2c: Performance Test Generation

```
Input: API endpoint + load profile requirements
Output: Performance test code (k6, JMeter, or similar)

Generated Test:
  import http from 'k6/http';
  import { check } from 'k6';
  
  export const options = {
    vus: 10,
    duration: '30s',
  };
  
  export default function () {
    const response = http.post('/api/v1/auth/login', {
      email: 'valid@example.com',
      password: 'SecurePass123'
    });
    
    check(response, {
      'status 200': (r) => r.status === 200,
      'response time < 200ms': (r) => r.timings.duration < 200,
    });
  }
```

**Implementation**:
- PerformanceTestGeneratorService
- Analyzes endpoint complexity from dependency_graph
- Generates load profiles
- Supports k6, JMeter, Gatling, etc.
- Links back to test case for traceability

### J.12 Storage Strategy for Analysis Results

**Rationale**: Store complete analysis results, not recompute on each generation request.

```
Query: User wants to generate test cases 5 times from same repository

Without storage:
  ├── Each generation request re-analyzes repository
  ├── 5 × 30 minutes = 150 minutes wasted
  └── Slow user experience

With storage:
  ├── Analyze once: 30 minutes
  ├── Each generation: Uses stored results instantly
  ├── 5 × <1 second = Fast UX
  └── If repository changes, user clicks "Refresh Analysis"
```

**Storage Model**:
```
repositories table (current config)
    ↓
repository_analyses table (historical analyses)
    ├── Version 1: 2026-06-15 10:00:00
    ├── Version 2: 2026-06-17 14:30:00 (after refresh)
    └── Version 3: 2026-06-20 09:15:00 (after another refresh)

Always use latest by default.
Allow comparing across versions (to detect breaking changes).
```

### J.13 Security Considerations

#### J.13.1 Repository Access

```
Security Model:
  ├── Repository tokens encrypted in database
  ├── Tokens never logged
  ├── Analysis runs in isolated background job
  ├── User context checked (only project members can analyze)
  └── Audit trail: who triggered analysis, when
```

#### J.13.2 Generated Test Case Attribution

```
Every generated test case includes:
  ├── [[generated-from-repository]]
  ├── [[confidence-score: 95]]
  ├── generation_source: "repository"
  ├── repository_id: uuid
  └── human_review_required: boolean (for low confidence)

Low confidence (<70%) tests require manual review before execution.
```

---

## Summary: Updated Implementation Phases

### Phase 1: Basic Sync (Current Document Sections A-I)
- ✅ QA Ops → Roam one-way sync
- ✅ Conflict detection and manual resolution
- ✅ Test case, suite, run export
- ✅ Audit trail

### Phase 1.5: Repository Intelligence (New Section J)
- ✅ Repository registration (FE, BE, Monorepo)
- ✅ Automated code analysis
- ✅ Module, API, validation, dependency mapping
- ✅ Test case generation (from requirements, analysis, or combined)
- ✅ Storage of analysis results

### Phase 2: Enhanced Sync
- Bi-directional sync
- Auto-sync scheduling
- Roam annotation backport

### Phase 2.5: Generated Test Automation
- Playwright generation
- API test automation generation
- Performance test generation

### Phase 3: AI-Driven Features
- AI-generated acceptance criteria
- Smart test suggestions based on code changes
- Anomaly detection in test results

### Phase 4: Multi-System Sync
- Jira integration
- GitHub integration
- Slack notifications

---

## Conclusion (Updated)

This design now includes:
1. **Roam Sync** (Sections A-I): Collaborative test documentation
2. **Repository Intelligence** (Section J): Code-driven test generation
3. **Future Extensions**: Playwright, API automation, performance tests

Together, these enable QA Ops to:
- Document tests in Roam (collaborative)
- Generate tests from requirements
- Generate tests from code analysis
- Generate tests from combination of both
- Generate automation (Playwright, API tests, performance tests)
- Maintain full audit trail across all operations

All while keeping QA Ops database as source of truth.

---

**Document Status**: Design Phase Complete  
**Ready for**: Implementation Planning  
**Last Updated**: 2026-06-15



### Phase 1: Basic Sync (This Design)
- ✅ QA Ops → Roam one-way sync
- ✅ Conflict detection (detection, not resolution)
- ✅ Manual conflict resolution UI
- ✅ Test case, suite, run export
- ✅ Soft delete (archive)
- ✅ Audit trail

### Phase 2: Enhancement (Future)
- Bi-directional sync
- Auto-sync scheduling
- Roam comment backport
- User annotation capture

### Phase 3: AI Integration (Future)
- AI-generated test cases
- Acceptance criteria generation
- Repository analysis
- Playwright generation

### Phase 4: Multi-System Sync (Future)
- Jira integration
- GitHub integration
- Slack notifications

---

## Non-Functional Requirements

### NFR-1: Data Integrity
- All mappings must be created before Roam page exists
- No orphaned mappings
- Referential integrity maintained
- Audit trail immutable

### NFR-2: Performance
- Sync for single test case: < 3 seconds
- Sync for 100 test cases: < 30 seconds
- No blocking of UI during sync
- Background jobs queue requests

### NFR-3: Reliability
- Retry mechanism for transient failures
- Graceful degradation (sync errors don't break QA Ops)
- Monitoring and alerting
- Admin recovery procedures

### NFR-4: Security
- Token encrypted in database
- Token never logged
- Sync operations authenticated (user context)
- Audit trail signed (future: immutable ledger)

### NFR-5: Maintainability
- Clear separation of concerns (RoamCliService, RoamSyncService, etc.)
- Dependency injection for testing
- Integration tests with real Roam (optional: mock)
- Documentation of sync workflow

---

## Conclusion

This design enables QA Ops to synchronize test data to Roam Research as an external collaboration platform, while maintaining QA Ops as the single source of truth. The architecture supports future extensions (AI, multi-system sync) without breaking existing functionality.

**Key Guarantees**:
1. ✅ QA Ops database is source of truth
2. ✅ No data loss in existing QA Ops modules
3. ✅ Roam pages never auto-deleted (archived instead)
4. ✅ Conflicts detected and escalated to users
5. ✅ Full audit trail of all sync operations
6. ✅ Extensible for future integrations

---

**Document Status**: Design Phase Complete  
**Ready for**: Implementation Planning  
**Next Step**: Break down implementation into stories
