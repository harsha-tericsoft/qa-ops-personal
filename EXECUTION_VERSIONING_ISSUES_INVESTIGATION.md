# Execution Versioning MVP - Issues Investigation Report

## Executive Summary

The ExecutionVersion system has critical UI and data flow issues that prevent proper version lifecycle management. Users cannot transition between draft states, test runs are not linked to versions, and no version switching UI exists.

---

## Issues Identified

### ISSUE 1: No Save Draft / Complete Execution Buttons

**Symptom**: Version stays in DRAFT forever with no UI buttons to transition status.

**Root Cause**: UI Logic Error in `app/cycles/page.tsx` line 429

```tsx
// INCORRECT LOGIC
{!selectedVersion || selectedVersion.status === 'DRAFT' ? (
  // Show Create Version section
) : (
  // Show Save Draft / Complete buttons
)}
```

**Problem**: The condition means:
- "If NO version selected" → Show Create Version ✓ Correct
- "OR selected version is DRAFT" → Show Create Version ✗ WRONG!

When a DRAFT version IS selected, it still shows Create Version section instead of showing Save/Complete buttons.

**Impact**: 
- Users cannot see Save Draft button when DRAFT version is selected
- Users cannot see Complete Execution button
- Version remains stuck in DRAFT forever
- New version creation is blocked by validation

---

### ISSUE 2: New Version Creation Blocked

**Error Message**: 
```
"Complete or delete the current draft before creating a new version."
```

**Root Cause**: Validation in `POST /api/execution-cycles/[id]/versions` (line 62-77)

```typescript
const activeVersion = await prisma.executionVersion.findFirst({
  where: {
    cycleId: id,
    status: {
      in: ['DRAFT', 'IN_PROGRESS'],  // Prevents BOTH DRAFT and IN_PROGRESS
    },
  },
})

if (activeVersion) {
  return NextResponse.json({
    error: 'Complete or delete the current draft before creating a new version.'
  }, { status: 409 })
}
```

**The Issue**: The error message says "delete" but users have no UI way to delete. And the validation prevents both DRAFT and IN_PROGRESS, but the requirement is to prevent multiple DRAFTS only.

**Correct Behavior Should Be**:
- Prevent creating new version if status is DRAFT (incomplete)
- Allow creating new version if status is IN_PROGRESS (user wants to create new without completing)
- Allow creating new version if status is COMPLETED (natural progression)

---

### ISSUE 3: Test Cases Display as "Unknown"

**Symptom**: All test case titles show "Unknown" in version detail view

**Root Cause**: Multiple issues:

1. **API Response Issue**: 
   - Test version endpoint returns empty `testRuns` array
   - Tested: GET `/api/execution-cycles/2f96c98f-774a-46e3-9c4a-88faea8a196f/versions/cmqpbkdrw00057kpov7ut49gr`
   - Response: `testRuns: []` (empty)

2. **No TestRun Creation on Version Creation**:
   - `POST /api/execution-cycles/[id]/versions` (line 88-96) creates only the ExecutionVersion
   - Does NOT create any TestRun records linking to the version
   - TestRuns exist in cycle but no testRuns exist for the specific version

3. **Fallback to Cycle TestRuns**:
   - Code line 402: `const testRuns = selectedVersion?.testRuns || selectedCycle?.testRuns || []`
   - Falls back to cycle testRuns when version has empty array
   - But cycle testRuns likely have no testCase data loaded

---

### ISSUE 4: Version History is Read-Only

**Missing UI Elements**:
- No "Select" button to switch between versions
- No "Resume Draft" button for DRAFT/IN_PROGRESS versions
- No "View" button for COMPLETED versions
- No version dropdown filter
- No way to change selected version

**Current Version History Table** (line 513-546):
```tsx
<button
  onClick={() => setSelectedVersionId(v.id)}
  disabled={selectedVersionId === v.id}
  className="text-blue-600 hover:text-blue-800 disabled:text-gray-400 text-sm font-medium"
>
  {selectedVersionId === v.id ? 'Selected' : 'Select'}
</button>
```

**Issue**: Button IS there but:
1. onClick handler only sets selectedVersionId
2. Does NOT fetch version details with testRuns
3. UI doesn't update to show Save/Complete buttons
4. testRuns not loaded for new selection

---

### ISSUE 5: No Version Switching

**Missing Functionality**:
- Cannot view Version 1
- Cannot view Version 2
- Cannot compare versions
- Cannot view different test results per version
- Metrics always show aggregate, not version-specific

**Required**: When user selects a different version:
1. Fetch version details with full testRuns
2. Load testCase data for each testRun
3. Update button visibility (Save/Complete vs Read-Only)
4. Update metrics based on selected version
5. Update test display with testCase titles

---

## API Response Analysis

### TEST 1: GET /api/execution-cycles (listCycles)

**Status**: 200 OK

**Sample TestRun in Response**:
```json
{
  "id": "cmqpcarp000187k78ec507s6p",
  "status": "NOT_EXECUTED",
  "testCaseId": "cmqpb4khv000h7k8w2oi0r2es",
  "versionId": "cmqpcar3400137k78jmezyc7j",
  "testCase": {
    "id": "cmqpb4khv000h7k8w2oi0r2es",
    "title": "Test:: When I leave the Issue field empty and try to save then the save must be prevented and the field must be marked mandatory. #Manual#Automated",
    "description": "Extracted from: vqFjZKUTk",
    "projectId": "cmqov3pqo00017kcg39q45x9x"
  }
}
```

**Finding**: ✓ testCase.title IS present in listCycles response

---

### TEST 2: GET /api/execution-cycles/{id}/versions/{versionId}

**Status**: 200 OK

**Response**:
```json
{
  "id": "cmqpbkdrw00057kpov7ut49gr",
  "cycleId": "4fea7e9a-7b83-4185-87cf-b0a8bcfb8efb",
  "versionNumber": 2,
  "buildVersion": "v2.0.0",
  "status": "DRAFT",
  "releaseNotes": "New version after completing previous",
  "createdAt": "2026-06-22T14:37:11.996Z",
  "completedAt": null,
  "testRuns": []
}
```

**Finding**: ✗ testRuns array is EMPTY despite API including testRuns

---

### TEST 3: API Code Review

**File**: `app/api/execution-cycles/[id]/versions/[versionId]/route.ts`

**GET Endpoint** (line 12-23):
```typescript
const version = await prisma.executionVersion.findUniqueOrThrow({
  where: { id: versionId },
  include: {
    testRuns: {
      include: {
        testCase: true,
        comments: { orderBy: { createdAt: 'asc' } },
        jiraLinks: true,
      },
    },
  },
})
```

**Analysis**: ✓ Include clause is correct
- Includes testRuns
- Includes testCase for each testRun
- Correctly structured

**But**: Version response has `testRuns: []` → This means the version record has NO testRun records in database

---

## Root Cause Summary

| Issue | Root Cause | Location |
|-------|-----------|----------|
| No Save/Complete buttons | Wrong UI conditional | cycles/page.tsx:429 |
| New version blocked | Prevents both DRAFT and IN_PROGRESS | api/versions/route.ts:62-77 |
| Test cases "Unknown" | No testRuns created when version created | api/versions/route.ts:88-96 |
| Version read-only | Missing fetchVersionDetails handler | cycles/page.tsx |
| No version switching | No version selection state management | cycles/page.tsx |

---

## Implementation Plan

### PHASE 1: Fix UI Conditional (1 hour)

**File**: `app/cycles/page.tsx`

**Current** (line 429):
```tsx
{!selectedVersion || selectedVersion.status === 'DRAFT' ? (
```

**Change To**:
```tsx
{!selectedVersion ? (
  // Show Create Version section
) : selectedVersion.status === 'DRAFT' || selectedVersion.status === 'IN_PROGRESS' ? (
  // Show Save Draft / Complete Execution buttons
) : (
  // Show Read-Only view for COMPLETED
)}
```

**Expected Result**: 
- Create Version shown only when no version selected
- Save Draft / Complete buttons shown for DRAFT and IN_PROGRESS
- Read-only view for COMPLETED

---

### PHASE 2: Fix TestRun Creation (1 hour)

**File**: `app/api/execution-cycles/[id]/versions/route.ts`

**Current** (line 88-96):
```typescript
const version = await prisma.executionVersion.create({
  data: {
    cycleId: id,
    versionNumber: nextVersionNumber,
    buildVersion: buildVersion.trim(),
    releaseNotes,
    status: 'DRAFT',
  },
})
```

**Change To**: After creating version, copy testRuns from cycle:
```typescript
const version = await prisma.executionVersion.create({
  data: {
    cycleId: id,
    versionNumber: nextVersionNumber,
    buildVersion: buildVersion.trim(),
    releaseNotes,
    status: 'DRAFT',
  },
})

// Copy all testRuns from cycle to this version
const cycleTestRuns = await prisma.testRun.findMany({
  where: { cycleId: id },
})

await Promise.all(
  cycleTestRuns.map(run =>
    prisma.testRun.update({
      where: { id: run.id },
      data: { versionId: version.id },
    })
  )
)
```

**Alternative**: Create new TestRun records cloning from cycle testRuns

**Expected Result**:
- New version has all cycle testRuns linked
- testRuns visible in version detail API response
- Test cases display with titles

---

### PHASE 3: Fix Version Selection Handler (1.5 hours)

**File**: `app/cycles/page.tsx`

**Add New Handler**:
```typescript
const fetchVersionDetails = async (versionId: string) => {
  try {
    const response = await fetch(
      `/api/execution-cycles/${selectedCycleId}/versions/${versionId}`
    )
    if (response.ok) {
      const version = await response.json()
      setSelectedVersionId(version.id)
      // Refresh UI with new version data
    }
  } catch (error) {
    console.error('Error fetching version:', error)
  }
}
```

**Update Select Button** (line 535-541):
```tsx
<button
  onClick={() => fetchVersionDetails(v.id)}
  disabled={selectedVersionId === v.id}
  className="text-blue-600 hover:text-blue-800 disabled:text-gray-400 text-sm font-medium"
>
  {selectedVersionId === v.id ? 'Selected' : 'Select'}
</button>
```

**Expected Result**:
- Clicking Select loads version details
- testRuns updated with correct data
- UI reflects selected version state

---

### PHASE 4: Fix Status Update Logic (1 hour)

**File**: `app/api/execution-cycles/[id]/versions/route.ts`

**Current** (line 66-67):
```typescript
status: {
  in: ['DRAFT', 'IN_PROGRESS'],  // Prevents both
}
```

**Change To**:
```typescript
status: {
  in: ['DRAFT'],  // Only prevent multiple drafts
}
```

**Update Error Message**:
```typescript
if (activeVersion) {
  return NextResponse.json(
    {
      error: 'A DRAFT version already exists. ' +
             'Complete or save this version before creating a new one.'
    },
    { status: 409 }
  )
}
```

**Expected Result**:
- Can create new version after IN_PROGRESS
- Only one DRAFT version allowed
- Better error messaging

---

### PHASE 5: Add Version Dropdown (1 hour)

**File**: `app/cycles/page.tsx`

**Add After Cycle Title** (around line 426):
```tsx
{versions.length > 0 && (
  <div className="mb-6">
    <label className="text-sm font-medium text-gray-700">Current Version</label>
    <select
      value={selectedVersionId || ''}
      onChange={(e) => fetchVersionDetails(e.target.value)}
      className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg"
    >
      <option value="">-- Select a version --</option>
      {versions.map(v => (
        <option key={v.id} value={v.id}>
          {v.buildVersion} ({v.status})
        </option>
      ))}
    </select>
  </div>
)}
```

**Expected Result**:
- Easy version switching
- Shows all versions with status
- Updates metrics when changed

---

## Testing Checklist

### Before Deployment

- [ ] Version selection shows Save/Complete buttons for DRAFT
- [ ] Version selection shows Save/Complete buttons for IN_PROGRESS
- [ ] Version selection shows read-only view for COMPLETED
- [ ] Clicking Save Draft transitions to IN_PROGRESS
- [ ] Clicking Complete Execution transitions to COMPLETED
- [ ] completedAt timestamp is recorded
- [ ] New version can be created after COMPLETED
- [ ] Blocking message appears when DRAFT exists (before fix)
- [ ] Test case titles show actual titles, not "Unknown"
- [ ] testRuns array is populated when version is fetched
- [ ] Metrics update when version changes
- [ ] Version dropdown works
- [ ] Select button in history table works
- [ ] Buttons are disabled for COMPLETED versions

---

## Expected Behavior After Fix

### Scenario 1: DRAFT Version Selected
```
[Current Version: v1.0.0 (DRAFT)]

Build Version: v1.0.0
Status: DRAFT

[Save Draft Button] [Complete Execution Button]

Test Cases:
- Test:: Login functionality
- Test:: User registration
- Test:: Password reset
```

### Scenario 2: IN_PROGRESS Version Selected
```
[Current Version: v1.0.0 (IN_PROGRESS)]

Build Version: v1.0.0
Status: IN_PROGRESS

[Save Draft Button] [Complete Execution Button]

Test Cases:
- Test:: Login functionality
- Test:: User registration
```

### Scenario 3: COMPLETED Version Selected
```
[Current Version: v1.0.0 (COMPLETED)]

Build Version: v1.0.0
Status: COMPLETED

[Read-Only View - No Buttons]

Test Cases (Read-Only):
- Test:: Login functionality [PASS]
- Test:: User registration [FAIL]
```

### Scenario 4: New Version After Completion
```
COMPLETED: v1.0.0 ✓

[Current Version: v2.0.0 (DRAFT)]

Build Version: [Empty]
[Create Version Button]

OR

Build Version: v2.0.0
Status: DRAFT
[Save Draft] [Complete Execution]
```

---

## Summary

**Critical Issues Found**: 5
**Severity**: High - MVP non-functional for version lifecycle
**Time to Fix**: ~5 hours
**Blockers**: 
- UI conditional logic
- Missing testRun creation
- Missing version selection handler

**Next Steps**:
1. Approve this investigation report
2. Begin implementing PHASE 1-5 fixes
3. Test each phase before proceeding
4. Verify all 13 test checklist items pass

