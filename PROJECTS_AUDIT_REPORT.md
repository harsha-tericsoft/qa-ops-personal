# 🔍 AUDIT REPORT: Projects, Repository & Roam Integration

**Audit Date**: June 9, 2026  
**Scope**: Projects Module, Repository Module, Roam Integration  
**Status**: GAPS IDENTIFIED

---

## 📋 EXECUTIVE SUMMARY

| Requirement | Status | Notes |
|-------------|--------|-------|
| **Projects Lead-Only** | ❌ FAIL | Visible to all users |
| **Project Detail Page** | ❌ FAIL | Returns 404 when viewing project |
| **Roam in Project Details** | ❌ FAIL | Separate standalone page instead |
| **Project Delete Options** | ❌ FAIL | No delete functionality |
| **Repository Summary** | ⚠️ PARTIAL | Metrics exist but in separate page |
| **Project-Specific Repository** | ✅ PASS | Filters by projectId correctly |
| **Role-Based Access** | ⚠️ PARTIAL | Repository filters, but Projects not hidden |
| **Repository Read-Only** | ✅ PASS | No create/edit/delete |
| **Tag Filtering** | ✅ PASS | Implemented |
| **Search Functionality** | ✅ PASS | Implemented |

---

## 🔴 CRITICAL ISSUES

### **Issue 1: Projects Module Visible to QA Engineers**
**Current State**: ❌ FAIL  
**Severity**: 🔴 CRITICAL

Projects module should be Lead-only, but currently visible to all users.

**Current Code** (`components/layout/AppSidebar.tsx`):
```typescript
// Projects shown to everyone
const navItems: NavItem[] = [
  { label: 'Projects', href: '/projects', ... },  // ← No role check
  ...
]
```

**What Should Happen**:
- LEAD: Sees "Projects" in sidebar
- QA ENGINEER: Does NOT see "Projects" in sidebar

**Files Affected**:
- `components/layout/AppSidebar.tsx` - Shows to all users

**Fix Required**: Add role-based visibility check

---

### **Issue 2: Project View Returns 404**
**Current State**: ❌ FAIL  
**Severity**: 🔴 CRITICAL

When clicking "View" on a project, it tries to navigate to `/projects/{id}/dashboard` which doesn't exist.

**Current Code** (`components/ProjectList.tsx:76-81`):
```typescript
<Link
  href={`/projects/${project.id}/dashboard`}
  className="text-blue-600 hover:underline"
>
  View
</Link>
```

**Problem**: No route `/projects/[id]/dashboard` exists → **Returns 404**

**What Should Happen**:
- Route `/projects/[id]` should exist
- Shows Project Details page with:
  - Project name and description
  - Repository status
  - Repository test count
  - Tags count
  - Last sync date
  - Roam integration controls

**Files Needed**:
- `app/projects/[id]/page.tsx` - NEW (Project Details page)

---

### **Issue 3: Roam Integration is Separate Page**
**Current State**: ❌ FAIL  
**Severity**: 🔴 CRITICAL

Roam Integration is a standalone page at `/roam`, but it should be **inside** the Project Details page.

**Current Architecture**:
```
/roam (separate page) ← WRONG
  └─ Import File form
  └─ Live Sync form
```

**Required Architecture**:
```
/projects/[id] (Project Details)
  ├─ Project info
  ├─ Repository status
  └─ Roam Integration section  ← SHOULD BE HERE
     ├─ Import File form
     └─ Live Sync form
```

**Current Code**:
- `app/roam/page.tsx` - Standalone page
- `components/forms/RoamImportFileForm.tsx` - Separate component
- `components/forms/RoamLiveSyncForm.tsx` - Separate component

**Problem**: User has to navigate away from project to configure Roam

**Fix Required**:
- Move Roam forms into Project Details page
- Remove standalone `/roam` page from navigation
- Update forms to work within project context

---

### **Issue 4: No Project Delete Functionality**
**Current State**: ❌ FAIL  
**Severity**: 🔴 CRITICAL

Projects cannot be deleted. No UI or API for project deletion.

**What Should Exist**:
1. Delete button on Project Details page
2. Two delete options:
   - Option 1: Delete Project Only (keep repository data)
   - Option 2: Delete Project And All Data
3. Confirmation dialog
4. API endpoint to handle deletion

**Files Missing**:
- Delete UI in Project Details page
- Delete API endpoint
- Confirmation dialog

---

## 🟠 PARTIAL ISSUES

### **Issue 5: Repository Summary Metrics Location**
**Current State**: ⚠️ PARTIAL  
**Severity**: 🟠 HIGH

Repository metrics exist but are displayed on separate `/repository` page. According to requirements, they should appear in **Project Details** page.

**Current Code** (`components/repository/RepositoryMetrics.tsx`):
```
/repository page
  └─ Metrics cards (Total Tests, Tags, Last Sync)
```

**Required**:
```
/projects/[id] page (Project Details)
  └─ Metrics cards (Total Tests, Tags, Last Sync)
```

**Impact**: User has to navigate to Repository page to see these metrics. They should be on the Project Details page.

**Files Affected**:
- Project Details page (needs RepositoryMetrics component)
- Repository page (can still have metrics for overview)

---

### **Issue 6: Navigation Still Includes Separate Roam Page**
**Current State**: ⚠️ PARTIAL  
**Severity**: 🟠 HIGH

Sidebar still shows "Roam Integration" as separate menu item, but it should only be accessible from Project Details.

**Current Code** (`components/layout/AppSidebar.tsx:52-56`):
```typescript
{
  label: 'Roam Integration',
  href: '/roam',
  icon: '🔗',
  description: 'Import from Roam Research',
}
```

**Should Be**: Removed from sidebar (accessible only from Project Details)

---

## ✅ ITEMS THAT WORK

### **Repository is Project-Specific** ✅
Repository correctly filters by `projectId`:
- Metrics API filters by project
- Tree API filters by project
- All queries include projectId parameter

**Files**:
- `app/api/repository/tree/route.ts` - Correct
- `app/api/repository/metrics/route.ts` - Correct
- `app/repository/page.tsx` - Correct

---

### **Repository is Read-Only** ✅
No create/edit/delete functionality exists for test cases:
- Remove all manual test creation
- Cannot edit imported tests
- Cannot delete tests

**Files**:
- `app/test-cases/page.tsx` - No create form
- `app/repository/page.tsx` - No create buttons

---

### **Tag Filtering Works** ✅
Tags can be filtered in Repository:
- Multi-select capability
- AND logic for multiple tags
- Visual feedback

**Files**:
- `components/repository/RepositoryFilters.tsx` - Correct

---

### **Search Functionality Works** ✅
Tests can be searched by name and description:
- Real-time filtering
- Works with tag filters

**Files**:
- `components/repository/RepositoryFilters.tsx` - Correct

---

## 📊 REQUIREMENTS VALIDATION

| Requirement | Current | Should Be | Status |
|-------------|---------|-----------|--------|
| Projects Lead-only | Visible to all | LEAD only | ❌ FAIL |
| Project view | 404 | Detail page | ❌ FAIL |
| Project edit | None | Form on detail page | ❌ FAIL |
| Project delete | None | Two options + confirmation | ❌ FAIL |
| Roam in project | Separate page | Inside detail page | ❌ FAIL |
| Import file | Standalone form | In project detail | ❌ FAIL |
| Live sync | Standalone form | In project detail | ❌ FAIL |
| Repository metrics | Separate page | In project detail | ⚠️ PARTIAL |
| Repository view | Working | Working | ✅ PASS |
| Repository read-only | Working | Working | ✅ PASS |
| Tag filtering | Working | Working | ✅ PASS |
| Search | Working | Working | ✅ PASS |
| Role-based access | Partial | Complete | ⚠️ PARTIAL |

---

## 📁 FILES TO MODIFY

### **Create (NEW)**
```
□ app/projects/[id]/page.tsx
  └─ Project Details page with:
     - Project info (name, description)
     - Repository metrics
     - Roam integration controls
     - Edit form
     - Delete button
     - Confirmation dialog

□ app/projects/[id]/edit/page.tsx
  └─ Edit project form

□ app/api/projects/[id]/route.ts
  └─ GET project details
  └─ PUT update project
  └─ DELETE delete project

□ components/projects/ProjectDetails.tsx
  └─ Project detail display component

□ components/projects/ProjectDeleteDialog.tsx
  └─ Delete confirmation with two options
```

### **Modify (EXISTING)**
```
✎ components/layout/AppSidebar.tsx
  └─ Hide "Projects" from QA_ENGINEER
  └─ Remove "Roam Integration" from nav (move to project detail)

✎ components/ProjectList.tsx
  └─ Update href to `/projects/{id}` (was `/projects/{id}/dashboard`)

✎ app/projects/page.tsx
  └─ Add role check (LEAD only)

✎ app/roam/page.tsx
  └─ Can be removed or kept for backward compatibility
  └─ But remove from sidebar navigation

✎ components/repository/RepositoryMetrics.tsx
  └─ Can be reused in project detail page
  └─ No changes needed

✎ app/api/projects/route.ts
  └─ Add role check to hide from QA_ENGINEER (if needed)
```

### **No Changes Needed**
```
✓ Repository module (already project-specific)
✓ Tag filtering (working correctly)
✓ Search functionality (working correctly)
✓ API endpoints (correct structure)
```

---

## 🔄 WORKFLOW CHANGES

### **BEFORE (Current - Broken)**
```
User logs in (LEAD)
  ↓
Sees Projects in sidebar
  ↓
Clicks Projects
  ↓
See list of projects
  ↓
Click View on a project
  ↓
404 ERROR ❌
```

### **AFTER (Required)**
```
LEAD User logs in
  ↓
Sees Projects in sidebar
  ↓
Clicks Projects
  ↓
See list of projects
  ↓
Click View on a project
  ↓
Project Details page shows:
  - Project name & description
  - Repository status
  - Test count, tag count, last sync
  - Roam integration controls
  - Edit & Delete buttons

QA Engineer logs in
  ↓
Does NOT see Projects in sidebar ✅
  ↓
Can access Repository, Test Cases, etc.
  ↓
Cannot manage projects
```

---

## 💾 DATABASE READINESS

**Good News**: Database schema fully supports all requirements

```
Project (1)
  ├─ RoamConfig (0..1) ← One per project
  ├─ Repository (0..many)
  │  └─ RepositoryNode (many)
  ├─ Tag (many)
  ├─ TestSuite (many)
  ├─ ExecutionCycle (many)
  └─ SyncLog (many)
```

**No schema changes needed** - Already designed for multi-project support

---

## 🚀 IMPLEMENTATION PRIORITY

### **Priority 1: CRITICAL (Block everything)**
1. Create `/projects/[id]` route with Project Details page
2. Add Roam Integration to Project Details page
3. Hide Projects from QA Engineers
4. Remove standalone `/roam` page from navigation

### **Priority 2: HIGH**
5. Add Edit Project form
6. Add Delete Project functionality (two options)
7. Move Roam forms to Project Details
8. Update ProjectList href

### **Priority 3: MEDIUM**
9. Add Roam metrics display to Project Details
10. Add proper empty states
11. Add success/error messages
12. Update documentation

---

## 📝 VALIDATION CHECKLIST

After implementation, verify:

- [ ] User with LEAD role:
  - [ ] Sees "Projects" in sidebar
  - [ ] Can click "View" on project
  - [ ] Sees Project Details page (no 404)
  - [ ] Can see project name and description
  - [ ] Can see repository status and metrics
  - [ ] Can see Roam Integration section on same page
  - [ ] Can import file
  - [ ] Can configure live sync
  - [ ] Can edit project
  - [ ] Can delete project

- [ ] User with QA_ENGINEER role:
  - [ ] Does NOT see "Projects" in sidebar
  - [ ] Cannot access `/projects` page
  - [ ] Cannot access `/projects/{id}` page
  - [ ] Cannot see Roam Integration option
  - [ ] Can still access Repository

- [ ] Project Details page:
  - [ ] Shows project name and description
  - [ ] Shows repository status
  - [ ] Shows test count, tag count, last sync
  - [ ] No 404 errors
  - [ ] Edit button works
  - [ ] Delete button works
  - [ ] Roam Integration controls present

- [ ] Navigation:
  - [ ] "Projects" hidden from QA_ENGINEER
  - [ ] "Roam Integration" removed from sidebar
  - [ ] All other links work

---

## 📊 SUMMARY

| Category | Count | Status |
|----------|-------|--------|
| Critical Issues | 4 | ❌ Need fix |
| Partial Issues | 2 | ⚠️ Need adjustment |
| Working Features | 4 | ✅ No change |
| Files to Create | 5 | 📝 New |
| Files to Modify | 6 | ✎ Update |
| Database Changes | 0 | ✓ None needed |

---

**AUDIT COMPLETE - Ready for implementation planning**
