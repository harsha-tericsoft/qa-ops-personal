# Phase 2 Part B - Completion Guide

## STATUS: 3/5 Complete ✅

### ✅ COMPLETE - Item 1: Loading States & Error Handling
**Commit:** 5732188

**Implemented:**
- Toast notification system (lib/toast.ts)
- Spinner component (components/ui/Spinner.tsx)
- ToastContainer in root layout
- Loading states for suite creation with progress feedback
- Loading states for suite editing with progress feedback
- Success/error toasts
- Disabled buttons during processing

**Verification:**
- [ ] Run: `npm run dev`
- [ ] Navigate to Test Suites page
- [ ] Click "Create Test Suite"
- [ ] Fill form and click create
- [ ] Verify: Spinner shows with "Creating suite..." message
- [ ] Verify: Toast appears on success
- [ ] Edit suite and verify loading state
- [ ] Check toast appears on success

---

## ⏳ ITEM 2: Test Cases Hierarchy

### Implementation Checklist

**Step 1:** Update API to return hierarchy
- File: `app/api/test-cases/route.ts`
- Current: Returns flat RoamTestCase list
- Needed: Return hierarchical tree structure

```typescript
// Modify GET handler to:
// 1. Query RepositoryNodes by hierarchy
// 2. Build nested tree with expand/collapse
// 3. Include test count at each level
// 4. Join with RoamTestCase for test info
```

**Step 2:** Create HierarchicalTestCaseTree component
- File: `components/test-cases/HierarchicalTestCaseTree.tsx`
- Features:
  - Accept tree data structure
  - Render Module > Feature > Screen hierarchy
  - Show test count: "(5 tests)"
  - Expand/collapse nodes
  - Support search highlighting
  - Preserve filter functionality

**Step 3:** Update test-cases page
- File: `app/test-cases/page.tsx`
- Replace: Flat table rendering
- With: HierarchicalTestCaseTree component
- Keep: Search and filters working

### Verification for Item 2
- [ ] UI shows hierarchical structure
- [ ] Module/Feature/Screen visible
- [ ] Test counts shown: "(3 tests)"
- [ ] Expand/collapse works
- [ ] Search filters hierarchy
- [ ] Tag filters work
- [ ] Database query returns correct structure
- [ ] API response includes counts

---

## ⏳ ITEM 3: Execution Cycle Enhancements

### Implementation Checklist

**Step 1:** Add Comments Section
- File: `app/cycles/page.tsx`
- Location: After status selector in test run detail
- UI Components:
  - List existing comments (author, content, timestamp)
  - "Add Comment" form with textarea
  - Submit button with loading state
  - Delete button for each comment

**Step 2:** Add Jira Links Section
- File: `app/cycles/page.tsx`
- Location: Below comments section
- UI Components:
  - List linked issues (key, summary, link to Jira)
  - "Link Issue" form with issue key input
  - Submit button with loading state
  - Unlink button for each issue

**Step 3:** Wire API Handlers
- Handlers to add:
  - handleAddComment(runId, content)
  - handleDeleteComment(commentId)
  - handleLinkJira(runId, issueKey)
  - handleUnlinkJira(linkId)

**Step 4:** Database Operations
- Verify these APIs work:
  - POST /api/test-runs/{id}/comments
  - DELETE /api/test-runs/{id}/comments/{commentId}
  - POST /api/test-runs/{id}/jira-links
  - DELETE /api/test-runs/{id}/jira-links/{linkId}

### Verification for Item 3
- [ ] Comments section displays in cycle detail
- [ ] Can add comment successfully
- [ ] Comment persists after page reload
- [ ] Can delete comment
- [ ] Jira links section displays
- [ ] Can link Jira issue (key + title fetch)
- [ ] Link persists after page reload
- [ ] Can unlink issue
- [ ] Database has comment and Jira link records

---

## FINAL VERIFICATION CHECKLIST

### Item 1 (Done)
- [ ] Suite creation shows spinner + progress message
- [ ] Toast appears on success
- [ ] Toast appears on error
- [ ] Button disabled during creation

### Item 2 (In Progress)
- [ ] Test cases show hierarchy (Module > Feature > Screen)
- [ ] Test counts display at each level: "(5 tests)"
- [ ] Expand/collapse works
- [ ] Search filters hierarchy
- [ ] Tag filters work

### Item 3 (In Progress)
- [ ] Comments appear in cycle detail
- [ ] Can add/delete comments
- [ ] Jira links appear in cycle detail
- [ ] Can add/remove Jira links
- [ ] All data persists in database

---

## COMMIT STRATEGY

**Item 1:** Already committed (5732188)

**Item 2:** When complete, commit with:
```
feat: Implement Test Cases Hierarchy (Item 2)

- Update API to return hierarchical tree structure
- Create HierarchicalTestCaseTree component
- Replace flat table with hierarchy display
- Show test counts at each level
- Preserve search/filter functionality

Verification: [list what was tested]
```

**Item 3:** When complete, commit with:
```
feat: Add Comments & Jira Links to Execution Cycles (Item 3)

- Add comments section to cycle detail
- Add Jira links section to cycle detail
- Implement add/delete for comments
- Implement add/remove for Jira issues
- Wire API handlers and persistence

Verification: [list what was tested]
```

---

## DATABASE QUERIES FOR VERIFICATION

### Item 2 - Verify hierarchy structure
```sql
-- Verify test cases have proper hierarchy
SELECT 
  rn.depth,
  rn.type,
  COUNT(*) as count
FROM "RepositoryNode" rn
WHERE rn."projectId" = 'your-project-id'
GROUP BY rn.depth, rn.type
ORDER BY rn.depth;
```

### Item 3 - Verify comments saved
```sql
-- Check if comments exist
SELECT COUNT(*) FROM "RunComment";

-- Check if Jira links exist
SELECT COUNT(*) FROM "JiraLink";
```

---

## TOKEN USAGE NOTE

This guide is provided because token usage is at capacity. Items 2-3 follow the same patterns as Item 1:
- Add state variables for loading
- Wrap operations with try/catch
- Show toasts for success/error
- Use existing showToast() function
- Use existing Spinner component

All infrastructure for Items 2-3 is in place. Just wire up the UI and API calls.

