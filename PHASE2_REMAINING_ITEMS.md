# Phase 2 Implementation - Remaining Items (3-5)

## Status: 2/5 Complete ✅
- ✅ Item 1: Repository Search & Filters (DONE)
- ✅ Item 2: Dashboard Metrics (DONE)
- ⏳ Item 3: Loading States & Error Handling (TODO)
- ⏳ Item 4: Test Cases Module Redesign (TODO)
- ⏳ Item 5: Execution Cycle Enhancements (TODO)

---

## ITEM 3: Loading States & Error Handling

### Why This Matters
- Users see frozen UI without feedback during long operations
- Suite/cycle creation appears to hang
- No error notification if operations fail

### Implementation Guide

#### 3.1 Test Suite Creation Loading State
**File:** `app/test-suites/page.tsx`

**Changes Needed:**
```typescript
// Add state at top of component
const [isCreating, setIsCreating] = useState(false)
const [creatingStep, setCreatingStep] = useState('')

// Update handleCreateSuite function
const handleCreateSuite = async () => {
  setIsCreating(true)
  setCreatingStep('Creating suite...')
  
  try {
    setCreatingStep('Creating suite...')
    const suiteRes = await fetch(...)
    const newSuite = suiteRes.json()
    
    if (selectedNodeIds.length > 0) {
      const roamTestCases = availableTests.filter(...)
      for (let i = 0; i < roamTestCases.length; i++) {
        setCreatingStep(`Adding test cases (${i + 1}/${roamTestCases.length})`)
        // Create test case...
      }
    }
    
    setIsCreating(false)
    // Show success toast
    showToast('Suite created successfully', 'success')
  } catch (error) {
    setIsCreating(false)
    // Show error toast
    showToast(error.message, 'error')
  }
}

// Update button
<button 
  disabled={!newSuiteName.trim() || isCreating}
  className="...disabled:opacity-50"
>
  {isCreating ? `${creatingStep} ⏳` : 'Create Suite'}
</button>
```

#### 3.2 Execution Cycle Creation Loading State
**File:** `app/cycles/page.tsx`

Same pattern as 3.1 - add isCreating state and creatingStep

#### 3.3 Add Toast Notifications
**Create:** `lib/toast.ts`
```typescript
export function showToast(message: string, type: 'success' | 'error' | 'info') {
  // Implementation using browser toast library or custom
  // This is a simple toast manager
}
```

**Update:** Both test-suites and cycles pages to import and use

### Verification Checklist
- [ ] Suite creation shows "Creating suite..." message
- [ ] Shows progress like "Adding test cases (3/5)..."
- [ ] Button disabled during creation
- [ ] Success toast appears when done
- [ ] Error toast appears if creation fails
- [ ] Same for cycle creation

---

## ITEM 4: Test Cases Module Redesign

### Why This Matters
- 729 test cases shown as flat list - unnavigable
- Users can't find tests by feature or module
- No way to see test count per group

### Implementation Guide

#### 4.1 Update API to Return Hierarchy
**File:** `app/api/test-cases/route.ts`

**Changes Needed:**
```typescript
// Instead of returning flat RoamTestCase list:
const testCases = await prisma.roamTestCase.findMany(...)

// Return hierarchical structure:
// Join RoamTestCase with RepositoryNode to get parent chain
// Group by hierarchy level (depth 0, 1, 2, etc.)
// Return as nested tree structure

// Pseudocode:
const hierarchy = await prisma.repositoryNode.findMany({
  where: { repositoryId, depth: 0 }, // Start from root
  include: {
    children: {
      include: {
        children: {
          include: {
            children: {
              include: {
                testCase: true // Link to RoamTestCase
              }
            }
          }
        }
      }
    }
  }
})

// Transform to include test count at each level
```

#### 4.2 Create Hierarchical Display Component
**Create:** `components/test-cases/HierarchicalTestCaseTree.tsx`

**Component Should:**
- Accept tree data structure
- Render with expand/collapse
- Show test count next to each group: "(3 tests)"
- Display test cases at leaf level
- Support search highlighting

#### 4.3 Update Test Cases Page
**File:** `app/test-cases/page.tsx`

```typescript
// Replace flat table with:
<HierarchicalTestCaseTree 
  hierarchy={hierarchyData}
  search={search}
  selectedTags={selectedTags}
/>
```

### Verification Checklist
- [ ] Hierarchy displays: Module > Feature > Screen > Test Case
- [ ] Test counts show at each level: "(5 tests)"
- [ ] Expand/collapse works
- [ ] Search works in hierarchy
- [ ] Filters work in hierarchy
- [ ] No flat presentation

---

## ITEM 5: Execution Cycle Enhancements

### Why This Matters
- Comments API exists but users can't see/add comments
- Jira links API exists but users can't link issues
- Test execution results lack context

### Implementation Guide

#### 5.1 Add Comments Section to Cycle Detail
**File:** `app/cycles/page.tsx` (around line 197-233)

**Add After Status Selector:**
```typescript
// Add comments section
<div className="mt-6 border-t pt-6">
  <h3 className="font-semibold mb-4">Comments</h3>
  
  {/* List existing comments */}
  <div className="space-y-3 mb-4">
    {run.comments?.map(comment => (
      <div key={comment.id} className="bg-gray-50 p-3 rounded">
        <p className="text-sm text-gray-600">{comment.author}</p>
        <p className="text-sm">{comment.content}</p>
      </div>
    ))}
  </div>
  
  {/* Add comment form */}
  <form onSubmit={(e) => handleAddComment(e, run.id)}>
    <textarea 
      placeholder="Add comment..."
      className="w-full border rounded p-2 text-sm"
    />
    <button className="mt-2 bg-blue-600 text-white px-3 py-1 rounded text-sm">
      Add Comment
    </button>
  </form>
</div>
```

#### 5.2 Add Jira Links Section to Cycle Detail
**File:** `app/cycles/page.tsx` (same location)

**Add Similar Section:**
```typescript
// Add Jira links section
<div className="mt-6 border-t pt-6">
  <h3 className="font-semibold mb-4">Linked Issues</h3>
  
  {/* List linked issues */}
  <div className="space-y-2 mb-4">
    {run.jiraLinks?.map(link => (
      <div key={link.id} className="flex justify-between items-center">
        <a href={link.issueUrl} target="_blank" className="text-blue-600">
          {link.issueKey}: {link.summary}
        </a>
        <button onClick={() => handleUnlinkJira(link.id)}>
          Unlink
        </button>
      </div>
    ))}
  </div>
  
  {/* Link new issue */}
  <form onSubmit={(e) => handleLinkJira(e, run.id)}>
    <input 
      placeholder="Jira Issue Key (e.g., PROJ-123)"
      className="border rounded p-2 text-sm"
    />
    <button className="ml-2 bg-blue-600 text-white px-3 py-1 rounded text-sm">
      Link Issue
    </button>
  </form>
</div>
```

#### 5.3 Add API Handlers
**Update:** `app/cycles/page.tsx` with handlers:

```typescript
const handleAddComment = async (e: React.FormEvent, runId: string) => {
  e.preventDefault()
  const formData = new FormData(e.currentTarget)
  const content = formData.get('content')
  
  const res = await fetch(`/api/test-runs/${runId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  })
  
  if (res.ok) {
    // Refresh cycle data
    await fetchCycles()
  }
}

const handleLinkJira = async (e: React.FormEvent, runId: string) => {
  e.preventDefault()
  const formData = new FormData(e.currentTarget)
  const issueKey = formData.get('issueKey')
  
  const res = await fetch(`/api/test-runs/${runId}/jira-links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issueKey })
  })
  
  if (res.ok) {
    await fetchCycles()
  }
}
```

### Verification Checklist
- [ ] Comments section displays under test run
- [ ] Can add comment successfully
- [ ] Comments persist and reload
- [ ] Jira links section displays
- [ ] Can link Jira issue successfully
- [ ] Links display with issue key and summary
- [ ] Can unlink issues

---

## Verification Summary

After completing all items, verify:

```bash
# 1. Search/Filters work
curl "http://localhost:3000/api/repository/tree?projectId=xxx&search=Login"
# Should return filtered nodes

# 2. Dashboard metrics are correct
curl "http://localhost:3000/api/dashboard/summary?projectId=xxx"
# Should have testSuites: 4 (not 0), tagCount, activeCycles

# 3. Loading states show during operations
# Manually test creating suite/cycle - should show progress

# 4. Test cases show hierarchy
# Check /test-cases page - should be tree not flat

# 5. Comments/Jira fields work
# Check /cycles page - should have comment/jira sections
```

---

## Timeline Estimate
- Item 3: 1-2 hours
- Item 4: 3-4 hours (most complex)
- Item 5: 1-2 hours

Total: 5-8 hours for completion

## Dependencies
None - each item is independent and can be done in any order
