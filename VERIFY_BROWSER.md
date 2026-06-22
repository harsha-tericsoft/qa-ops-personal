# Browser Verification Checklist - Execution Versioning MVP

**Environment**: http://localhost:3000 (or deployed URL)  
**Path**: /cycles

---

## WORKFLOW: Create and Manage Execution Version

### Step 1: Create Version
```
[ ] Navigate to /cycles
[ ] Click on an existing execution cycle
[ ] Scroll to "Build Version" section
[ ] Enter build version: "2.5.0-test"
[ ] Enter release notes: "Testing MVP"
[ ] Click "Create Version" button
[ ] Toast notification appears: "Version created successfully"
[ ] New version appears in Version History panel
```

**Evidence Captured:**
- Build Version input field visible
- Release Notes textarea visible
- Create Version button clickable
- Success toast shown
- Version History panel updated

---

### Step 2: Save Draft
```
[ ] Add test results (mark some as PASS, FAIL, BLOCKED)
[ ] Add a comment to a test
[ ] Add a Jira link to a test
[ ] Click "Save Draft" button
[ ] Toast notification appears: "Draft saved successfully"
[ ] Status in Version History shows "IN_PROGRESS" (yellow)
[ ] All data remains in form (not cleared)
[ ] Can continue editing after save
```

**Evidence Captured:**
- Test results saved
- Comments saved
- Jira links saved
- Status changed to IN_PROGRESS
- Data persisted in UI
- Edit controls remain enabled

---

### Step 3: Refresh Page
```
[ ] After saving draft, press F5 or Ctrl+R to refresh page
[ ] Wait for page to reload completely
[ ] Navigate back to the same cycle
[ ] Select the same version from Version History
```

**Evidence Captured:**
- Page reloads without errors
- Cycle data reloads
- Version data reloads

---

### Step 4: Verify Persistence
```
[ ] All test results still visible (PASS, FAIL, BLOCKED marks)
[ ] All comments still visible
[ ] All Jira links still visible
[ ] Version History shows correct status
[ ] Build Version still populated
[ ] Release Notes still populated
```

**Evidence Captured:**
- Test statuses persisted
- Comments persisted
- Jira links persisted
- Version state persisted after refresh
- Data integrity confirmed

---

### Step 5: Complete Execution
```
[ ] With data still saved, click "Complete Execution" button
[ ] Toast notification appears: "Execution completed"
[ ] Status in Version History changes to "COMPLETED" (green)
[ ] Version History shows completedAt timestamp
```

**Evidence Captured:**
- Status changed to COMPLETED
- CompletedAt timestamp populated
- Toast notification shown
- Version History updated

---

### Step 6: Verify Read-Only Enforcement
```
[ ] Try to change a test status dropdown
    [ ] Dropdown is DISABLED (greyed out)
    [ ] Cannot select new status
[ ] Try to add a comment
    [ ] Comment input field is HIDDEN or DISABLED
    [ ] "Add" button is DISABLED
[ ] Try to add a Jira link
    [ ] Jira input field is HIDDEN or DISABLED
    [ ] "Add" button is DISABLED
[ ] Try to delete a comment
    [ ] Delete button is HIDDEN or DISABLED
[ ] Try to delete a Jira link
    [ ] Remove button is HIDDEN or DISABLED
[ ] Try to click "Save Draft" button
    [ ] Button is DISABLED
[ ] Try to click "Complete Execution" button
    [ ] Button is DISABLED
```

**Evidence Captured:**
- All edit controls disabled
- All delete controls hidden
- All action buttons disabled
- UI is in read-only mode

---

### Step 7: Create Version 2
```
[ ] Go to Build Version input section
[ ] Enter new build version: "2.5.1-test"
[ ] Click "Create Version" button
[ ] Toast shows: "Version created successfully"
[ ] New version appears in Version History as:
    - Version Number: 2
    - Build Version: 2.5.1-test
    - Status: DRAFT (grey)
    - Created Date: Current timestamp
    - Completed Date: Empty
```

**Evidence Captured:**
- New version created successfully
- Version number auto-incremented to 2
- Status is DRAFT
- Version History shows both v1 and v2
- v2 is editable, v1 is read-only

---

### Step 8: Verify Version History Display
```
[ ] Version History panel shows table with columns:
    [ ] Version (number)
    [ ] Build Version (string)
    [ ] Status (DRAFT, IN_PROGRESS, COMPLETED)
    [ ] Created (datetime)
    [ ] Completed (datetime or empty)
    [ ] Action (Select button)
[ ] Version 1 shows:
    [ ] Build Version: 2.5.0-test (or original)
    [ ] Status: COMPLETED (green)
    [ ] Created: Timestamp
    [ ] Completed: Timestamp
    [ ] Select button: "Selected" or "Select"
[ ] Version 2 shows:
    [ ] Build Version: 2.5.1-test
    [ ] Status: DRAFT (grey)
    [ ] Created: Current timestamp
    [ ] Completed: Empty
    [ ] Select button: "Select"
[ ] Click "Select" on Version 1
    [ ] Version History shows Version 1 selected
    [ ] Version 1 data loads (read-only)
[ ] Click "Select" on Version 2
    [ ] Version History shows Version 2 selected
    [ ] Version 2 data loads (editable, DRAFT status)
```

**Evidence Captured:**
- Version History table properly formatted
- All columns visible and populated
- Status color coding correct
- Timestamps displayed
- Select buttons functional
- Version switching works
- Correct state (read-only vs editable) per version

---

## WORKFLOW: Duplicate Prevention

### Step 9: Try Duplicate Build Version
```
[ ] In Build Version field, enter: "2.5.0-test" (same as Version 1)
[ ] Click "Create Version" button
[ ] Error message appears: "Build version already exists for this cycle."
[ ] Toast notification shown
[ ] No new version created
[ ] Version History unchanged
```

**Evidence Captured:**
- Duplicate validation working
- Error message clearly displayed
- Version not created
- No state changes on error

---

## WORKFLOW: Regression - Existing Functionality

### Step 10: Dashboard Still Works
```
[ ] Navigate to /dashboard (if available)
[ ] Metrics cards show:
    [ ] Test Suites Count
    [ ] Tags Count
    [ ] Active Cycles Count
[ ] Values displayed (not zeros or errors)
[ ] No console errors
```

**Evidence Captured:**
- Dashboard loads
- Metrics calculated
- No errors

---

### Step 11: Test Suites Still Load
```
[ ] Navigate to /test-suites
[ ] Test suites list loads
[ ] Can create new test suite
[ ] Can edit existing test suite
```

**Evidence Captured:**
- Test Suites page functional
- No regression in existing features

---

### Step 12: Repository Still Loads
```
[ ] Navigate to /repository
[ ] Repository tree loads
[ ] Can filter by node type
[ ] Can search repositories
```

**Evidence Captured:**
- Repository page functional
- No regression in existing features

---

## FINAL CHECKLIST

- [ ] All 12 steps completed
- [ ] All evidence captured
- [ ] No console errors
- [ ] No TypeScript errors in DevTools
- [ ] Network requests all successful (200, 201 responses)
- [ ] Toast notifications working
- [ ] Read-only enforcement working
- [ ] Version History table displaying correctly
- [ ] Duplicate validation working
- [ ] Backward compatibility verified

---

## Screenshots to Capture

1. **Build Version Form**
   - Build Version input field
   - Release Notes textarea
   - Create Version button

2. **Save Draft State**
   - Status showing IN_PROGRESS
   - Save Draft button available
   - Edit controls enabled

3. **After Refresh**
   - All data persisted
   - Version History shows IN_PROGRESS

4. **Read-Only State**
   - Status showing COMPLETED (green)
   - All edit controls disabled
   - Complete Execution button disabled

5. **Version History Panel**
   - Both v1 and v2 visible
   - Status color coding
   - Dates displayed

6. **Duplicate Error**
   - Error message displayed
   - Toast notification shown

---

**Test Date**: ___________  
**Tester**: ___________  
**Result**: ✓ PASS / ✗ FAIL

