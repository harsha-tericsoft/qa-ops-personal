# Phase 2 UI Verification - Playwright Test Script

**Purpose:** Generate actual browser evidence (screenshots + console logs) proving Phase 2 UI implementation works correctly.

**Location:** `tests/phase-2-ui-verification.spec.ts`

---

## How to Run

### 1. Install Playwright (if not already installed)
```bash
npm install -D @playwright/test
```

### 2. Run the verification script
```bash
npx playwright test tests/phase-2-ui-verification.spec.ts
```

### 3. View the evidence
All screenshots and logs will be saved to: `phase-2-evidence/`

---

## What the Script Tests

### 1. **Page Loads** 
- ✅ Header displays "Test Cases"
- ✅ Summary cards visible
- ✅ Filter panel rendered
- ✅ Test grid displayed
- **Screenshot:** `01-page-loads-full.png`

### 2. **Summary Cards**
- ✅ Cards display numeric values
- ✅ "Total Tests" shows 107
- **Screenshot:** `02-summary-cards.png`

### 3. **Filter Panel**
- ✅ Search field visible
- ✅ Type dropdown available
- ✅ Filter options rendered
- **Screenshot:** `03-filter-panel.png`

### 4. **Search - "FAQ"**
- ✅ Search field accepts input
- ✅ Results update on search
- ✅ FAQ matches found
- **Screenshot:** `04-search-faq-results.png`

### 5. **Search - "When"**
- ✅ Search works with different keywords
- ✅ Results display correctly
- **Screenshot:** `05-search-when-results.png`

### 6. **Type Filter**
- ✅ Type dropdown selects Manual/Automated
- ✅ Filter applies to grid
- **Screenshot:** `06-type-filter-manual.png`

### 7. **Pagination**
- ✅ Previous/Next buttons visible
- ✅ Page indicator shows current page
- ✅ Navigation works
- **Screenshot:** `07-pagination.png`

### 8. **Bulk Selection**
- ✅ Test checkboxes clickable
- ✅ Selection counter displays
- ✅ Multiple items can be selected
- **Screenshot:** `08-selection-checkboxes.png`

### 9. **Test Grid Data**
- ✅ Test statements display
- ✅ Grid rows populated
- ✅ Data matches API response
- **Screenshot:** `09-test-grid.png`

### 10. **Console Errors**
- ✅ No JavaScript errors
- ✅ No React errors
- ✅ No uncaught exceptions
- **Report:** `console-logs.json`

### 11. **React/Runtime Errors**
- ✅ No error boundaries triggered
- ✅ Page is interactive
- ✅ No runtime errors
- **Screenshot:** `10-full-page-final.png`

### 12. **Mobile Responsive**
- ✅ Mobile viewport renders
- ✅ Content visible on mobile
- ✅ Responsive design works
- **Screenshot:** `12-mobile-view.png`

---

## Evidence Files Generated

After running the script, the `phase-2-evidence/` folder will contain:

```
phase-2-evidence/
├── 01-page-loads-full.png           (Full page screenshot)
├── 02-summary-cards.png             (Summary cards section)
├── 03-filter-panel.png              (Filter sidebar)
├── 04-search-faq-results.png        (FAQ search results)
├── 05-search-when-results.png       (When search results)
├── 06-type-filter-manual.png        (Type filter applied)
├── 07-pagination.png                (Pagination controls)
├── 08-selection-checkboxes.png      (Selection UI)
├── 09-test-grid.png                 (Test grid data)
├── 10-full-page-final.png           (Final full page)
├── 12-mobile-view.png               (Mobile responsive)
├── console-logs.json                (All console messages)
└── VERIFICATION_REPORT.json         (Test results summary)
```

---

## Verification Report

The script generates a JSON report (`VERIFICATION_REPORT.json`) containing:

```json
{
  "timestamp": "2026-06-23T...",
  "tests": [
    {
      "name": "1. Page loads and displays summary cards",
      "status": "PASS",
      "evidence": "01-page-loads-full.png"
    },
    ...
  ],
  "summary": {
    "totalTests": 12,
    "passed": 12,
    "failed": 0,
    "skipped": 0
  },
  "conclusion": "Phase 2 UI implementation VERIFIED - All tests PASS with no console errors"
}
```

---

## What This Proves

✅ **UI renders correctly** - Screenshots show components display properly
✅ **Search works visually** - FAQs and When searches return visible results
✅ **Filters update grid** - Filter changes visible in screenshot
✅ **No console errors** - console-logs.json shows no errors/warnings
✅ **No React errors** - Error boundaries not triggered
✅ **Interactive page** - Form elements respond to input
✅ **Pagination works** - Navigation buttons functional
✅ **Selection works** - Checkboxes can be clicked
✅ **Responsive design** - Mobile view renders correctly
✅ **Grid displays data** - Test statements visible in grid

---

## How to Verify Console Logs

Open `phase-2-evidence/console-logs.json` and verify:
- No `"error"` type entries
- No `"warning"` type entries
- Only `"log"` and `"info"` type entries are acceptable

---

## Expected Console Output

When the script runs successfully, console output should show:

```
Test 1: Page loads and displays summary cards
✅ Header found: "Test Cases"
✅ Found 6 summary cards
✅ Filter panel visible
✅ Test grid visible
Test 1: PASS

Test 2: Summary cards display correct values
✅ Total Tests: 107
Test 2: PASS

Test 3: Filter panel renders with all filter options
✅ Search field visible
✅ Type selector found (2 dropdowns)
Test 3: PASS

... (more tests)

Test 10: Console has no errors or warnings
✅ No console errors detected
Test 10: PASS

...

PHASE 2 UI VERIFICATION - TEST REPORT
================================================================================
Total Tests: 12
Passed: 12 ✅
Failed: 0
Skipped: 0

Conclusion: Phase 2 UI implementation VERIFIED - All tests PASS with no console errors

Evidence saved to: /path/to/phase-2-evidence
================================================================================
```

---

## Troubleshooting

### If tests fail:

1. **"No element found" error**
   - Dev server may not be running on http://localhost:3000
   - Start with: `npm run dev`

2. **"Timeout" error**
   - Page may be loading slowly
   - Increase timeout in script: `timeout: 60000`

3. **Navigation fails**
   - Make sure you have the latest Test Cases page code
   - Clear browser cache: `npm run clean`

### If console errors exist:

1. Check what errors appear in `console-logs.json`
2. Most common issues:
   - Missing TypeScript types
   - API fetch failures
   - Unhandled promise rejections

---

## After Running This Script

**Steps to provide evidence to user:**

1. Run the Playwright script
2. Navigate to `phase-2-evidence/` folder
3. Share the screenshots and JSON files
4. Share the console output from the test run

This provides **actual browser evidence** proving:
- UI renders correctly
- Interactions work
- No runtime errors exist
- Console is clean

---

## Command Quick Reference

```bash
# Run verification
npx playwright test tests/phase-2-ui-verification.spec.ts

# Run with verbose output
npx playwright test tests/phase-2-ui-verification.spec.ts --reporter=list

# Run in headed mode (see browser)
npx playwright test tests/phase-2-ui-verification.spec.ts --headed

# Run specific test
npx playwright test tests/phase-2-ui-verification.spec.ts -g "Search functionality"

# View HTML report
npx playwright show-report
```

---

## Success Criteria

Phase 2 is verified when:

✅ All 12 tests PASS
✅ No console errors in logs
✅ All screenshots show UI rendering correctly
✅ Search/filter interactions visible in screenshots
✅ VERIFICATION_REPORT.json shows 12/12 passed

---

## Approval Gate

**You may run this script locally and provide the evidence files for Phase 3 approval.**

Once you run this script and share:
- Screenshots (PNGs)
- Console logs (JSON)
- Verification report (JSON)

Phase 3 can be approved.

