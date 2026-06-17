# Roam QC Dashboard - Live Demo Script
## For Stakeholders & Product Review

**Duration**: 15 minutes  
**Audience**: Product managers, QA leadership, stakeholders  
**Prerequisites**: Dashboard deployed, Roam credentials configured  

---

## DEMO OUTLINE

1. **Configuration** (2 min) - Show Roam setup
2. **Sync Operations** (5 min) - Run and monitor sync
3. **Repository View** (3 min) - Browse test hierarchy
4. **Dashboard Metrics** (3 min) - View test statistics
5. **Refresh & Updates** (2 min) - Show real-time updates

**Total Time**: 15 minutes

---

## DETAILED DEMO STEPS

### SECTION 1: Configuration Setup (2 minutes)

**Narrator**: "First, let's review how we connect to Roam Research."

**Steps**:

1. [ ] **Open Dashboard**
   ```
   Open browser to: https://qa-ops.example.com/dashboard
   (or staging URL)
   ```
   - Screenshot/Point to: Top navigation with "Settings" link
   - Note: Professional header with QA Ops branding

2. [ ] **Click Settings → Roam Configuration**
   - Take screenshot of configuration panel
   - Highlight three key fields:
     * Graph Name: "Project_Kinergy" ← Which Roam graph to sync
     * Repository Root Page: "TestSuite : Kinergy" ← Starting point for import
     * API Token: [Shown as ••••••••] ← Secure credential storage

3. [ ] **Show "Test Connection" Button**
   ```
   Click "Test Connection"
   Wait for response: "✓ Connected to Roam"
   ```
   - Point out: Green checkmark indicates successful connection
   - Explain: This verifies API token and network connectivity

4. [ ] **Highlight "Configured" Status**
   ```
   Last Sync: [timestamp]
   Status: SUCCESS
   ```
   - Explain: System automatically tracks sync history
   - This ensures we know data freshness

**Key Message**: 
> "Configuration is a one-time setup. After this, sync happens automatically every 5 minutes."

---

### SECTION 2: Sync Operations (5 minutes)

**Narrator**: "Now let's trigger a sync to import tests from Roam."

**Steps**:

1. [ ] **Return to Dashboard Main View**
   - Click Dashboard tab (if not already there)
   - Show main dashboard layout

2. [ ] **Click "Sync Now" or "Refresh" Button**
   ```
   Location: Dashboard top-right corner
   Button: "Sync Now" (blue primary button)
   ```
   
   **System Response**:
   ```
   [Show sync progress screen]
   
   ┌─────────────────────────────────┐
   │ Sync in Progress...             │
   ├─────────────────────────────────┤
   │ Status: Connecting to Roam...   │
   │ Progress: ▓░░░░░░░░░░░░░░░░░░  │
   │ Duration: 15 seconds            │
   └─────────────────────────────────┘
   ```

3. [ ] **Monitor Sync Stages** (narrate each stage)
   
   **Stage 1: Connection** (10-20 seconds)
   ```
   "✓ Connected to Roam API"
   "Authenticating..."
   ```
   - Point: This verifies our credentials work
   
   **Stage 2: Repository Fetch** (30-60 seconds)
   ```
   "Fetching repository structure..."
   "Found 3718 total nodes"
   ```
   - Point: System is reading the test hierarchy from Roam
   - Note: Large repositories may take longer
   
   **Stage 3: Import** (60-120 seconds)
   ```
   "Importing nodes..."
   "Inserted 3675 nodes into database"
   "Updating parent relationships..."
   ```
   - Point: Each test node is stored in our database
   - Parent relationships ensure hierarchy integrity
   
   **Stage 4: Test Extraction** (5-10 seconds)
   ```
   "Extracting test cases..."
   "Created 1484 test case records"
   ```
   - Point: System automatically identifies tests
   - Detection: Nodes with "Test::" in title or test tags

4. [ ] **Sync Complete**
   ```
   ✓ Sync Complete
   Duration: 4 minutes 23 seconds
   Status: SUCCESS
   
   Summary:
   • Nodes imported: 3675
   • Test cases created: 1484
   • Repository updated: 2026-06-17 13:45:00 UTC
   ```
   
   - Point: Complete summary of what was imported
   - Note: Metrics automatically populated in dashboard

5. [ ] **Dashboard Auto-Updates**
   ```
   Dashboard automatically refreshes to show new data
   (No manual refresh needed)
   ```
   - Show: Metrics now populated with real data
   - Explain: Dashboard is live and ready

**Key Message**:
> "Sync is fast, reliable, and fully automated. The entire import from Roam to dashboard happens with a single click, or runs automatically every 5 minutes in the background."

---

### SECTION 3: Repository Tree Exploration (3 minutes)

**Narrator**: "Let's explore the imported test repository structure."

**Steps**:

1. [ ] **Click "Repository" Tab**
   - Show full navigation to repository view
   - Display: Tree view of entire test hierarchy

2. [ ] **Expand Root Node**
   ```
   Root: "TestSuite : Kinergy"
   └─ [Expand to show children]
   ```
   - Point: This is the top-level container
   - Explain: All tests are organized under this root

3. [ ] **Show Depth-1 Children**
   ```
   TestSuite : Kinergy
   ├─ CodeGen/TestSuite:: for p/Client/Kinergy
   └─ [Additional top-level suites]
   ```
   - Point to structure: Clean organization
   - Note: Multiple test suites at same level

4. [ ] **Expand to Depth 2-3**
   ```
   CodeGen/TestSuite:: for p/Client/Kinergy
   ├─ ### TestType/Mobile
   │  └─ Test::
   ├─ ### TestType/Web
   │  └─ Admin Portal
   │     └─ Login
   ```
   - Point: Hierarchy shows test organization
   - Explain: Mirrors Roam structure exactly
   - Indentation shows parent-child relationships

5. [ ] **Click on a Test Node**
   ```
   Example: "Login" node
   
   Shows:
   • Title: Login
   • Type: [FOLDER/FILE icon]
   • Depth: Level in hierarchy
   • Parent: [Parent node name] (clickable)
   • Roam UID: [Unique identifier]
   • Created: [Timestamp]
   ```
   - Point to details panel
   - Explain: Traceability back to Roam

6. [ ] **Show Search (if available)**
   ```
   Search for: "Test::"
   Results: [Highlights matching nodes]
   ```
   - Demonstrate: Quick access to specific tests
   - Point: UI makes navigation easy

7. [ ] **Scroll Through Full Hierarchy**
   ```
   Demonstrate: Full tree can be navigated
   Shows: Hundreds of test nodes properly organized
   ```
   - Point: No missing/orphaned nodes
   - All tests visible and accessible

**Key Message**:
> "The complete test repository is imported and structured exactly as it exists in Roam. QA teams can browse the full test catalog and understand the test organization at a glance."

---

### SECTION 4: Dashboard Metrics (3 minutes)

**Narrator**: "Now let's look at the QA metrics dashboard."

**Steps**:

1. [ ] **Click "Dashboard" Tab**
   - Display: Main dashboard view with metrics cards

2. [ ] **Show Test Count Metrics**
   ```
   ┌────────────────────────┐
   │ Total Tests    1484    │ ← Real-time count from database
   │ Repository Tests: 1484 │ ← Synced from Roam
   └────────────────────────┘
   ```
   - Point: These numbers come from actual imported data
   - Explain: Not hardcoded, calculated from database

3. [ ] **Show Status Breakdown**
   ```
   ┌─────────────────┐
   │ Status Overview │
   ├─────────────────┤
   │ Not Run:  1484  │ 100%
   │ Passed:      0  │   0%
   │ Failed:      0  │   0%
   │ Blocked:     0  │   0%
   │ In Progress: 0  │   0%
   └─────────────────┘
   ```
   - Point: All tests in NOT_RUN state (fresh import)
   - Explain: Tests ready for initial execution

4. [ ] **Show Quality Metrics**
   ```
   ┌──────────────────────────┐
   │ Quality Metrics          │
   ├──────────────────────────┤
   │ Pass Rate:           0%  │ (No data yet)
   │ Execution Rate:      0%  │ (No tests executed)
   │ Avg Test Duration: N/A   │
   └──────────────────────────┘
   ```
   - Point: Currently showing baseline (no executions yet)
   - Explain: These will populate as tests are executed

5. [ ] **Show Last Sync Information**
   ```
   ┌───────────────────────────────┐
   │ Sync Information              │
   ├───────────────────────────────┤
   │ Last Sync:  2026-06-17 13:45  │
   │ Next Sync:  2026-06-17 13:50  │
   │ Status:     SUCCESS           │
   │ Duration:   4m 23s            │
   └───────────────────────────────┘
   ```
   - Point: Next sync happens automatically
   - Explain: 5-minute refresh cycle maintains data freshness

6. [ ] **Explain Real-Time Updates**
   ```
   As tests are executed:
   ✓ Pass count increases
   ✓ Pass rate calculated
   ✓ Execution rate updated
   ✓ Dashboard refreshes automatically
   ```
   - Point: No manual updates needed
   - Show: [Refresh browser] → Metrics update live

7. [ ] **Show Multi-Project Support (if applicable)**
   ```
   Project Selector: [Dropdown]
   Options: 
   • Project A (1484 tests)
   • Project B (342 tests)
   • Project C (910 tests)
   ```
   - Point: Each project has independent metrics
   - Demonstrate: Switching projects updates all metrics

**Key Message**:
> "The dashboard gives QA leaders real-time visibility into test inventory and execution status. All metrics are live, automatically updated, and based on actual test data from Roam."

---

### SECTION 5: Refresh & Real-Time Updates (2 minutes)

**Narrator**: "Let me show you how the system stays synchronized with Roam."

**Steps**:

1. [ ] **Open Roam in Second Window** (if available)
   ```
   Browser Window 1: Dashboard (main)
   Browser Window 2: Roam (side by side)
   ```
   - Show: Live Roam instance with same test data

2. [ ] **Modify a Test in Roam** (in Window 2)
   ```
   Example Change: 
   Old: "Login"
   New: "Login with MFA"
   
   Action: Update in Roam
   ```
   - Point: Making a simple change to test title
   - Explain: This simulates real-world test updates

3. [ ] **Click Refresh in Dashboard** (Window 1)
   ```
   Dashboard → Sync Now / Refresh
   Monitor: Progress indicator
   Wait: 30-60 seconds
   ```
   - Point: Sync detects the change
   - Show progress: "Comparing with existing data..."

4. [ ] **Verify Update in Dashboard**
   ```
   Repository Tree:
   Old: "Login"
   New: "Login with MFA" ✓ Updated
   ```
   - Point: Change from Roam reflected in dashboard
   - Explain: Bidirectional awareness of test data

5. [ ] **Show Automatic Scheduled Sync**
   ```
   "Without manual action, sync runs every 5 minutes"
   
   Example: System Status log
   13:45:00 - REFRESH_SYNC SUCCESS (4m 23s)
   13:50:00 - REFRESH_SYNC SUCCESS (2m 15s) ← Automatic
   13:55:00 - REFRESH_SYNC SUCCESS (2m 08s) ← Automatic
   14:00:00 - REFRESH_SYNC SUCCESS (2m 12s) ← Automatic
   ```
   - Point: Regular sync cycle maintains freshness
   - No manual intervention needed

**Key Message**:
> "The Roam QC Dashboard is a living, breathing system. It automatically stays synchronized with your Roam repository, ensuring metrics and test data are always current."

---

## DEMO SCRIPT TALKING POINTS

### Opening Statement
> "Today I'm going to show you the Roam QC Dashboard—a system that transforms your Roam-based test library into a live QA metrics dashboard. In 15 minutes, you'll see how we go from Roam data to real-time dashboard visibility."

### During Configuration
> "First, we configure the connection to your Roam repository. This is a one-time setup. We specify which Roam graph to import and where in the hierarchy to start. The system validates connectivity and stores credentials securely."

### During Sync
> "When we click sync, the system goes through four stages. First, it connects to Roam and authenticates. Then it fetches the entire test hierarchy—in this case, over 3,700 test nodes. Next, it imports those nodes into our database, preserving the exact parent-child relationships. Finally, it extracts test cases using our intelligent detection logic. The whole process takes about 4 minutes and happens with a single click."

### During Repository Browse
> "Here's the complete test repository as imported from Roam. Notice the hierarchy is preserved perfectly—every parent-child relationship, every organizational level. QA engineers can browse this and understand exactly how tests are organized. And it's fully searchable."

### During Dashboard View
> "The dashboard shows real-time QA metrics. Right now, we have 1,484 tests, all in NOT_RUN status because this is a fresh import. As tests are executed, this dashboard will populate with pass/fail rates, execution metrics, and trends. All metrics come directly from our database—nothing is hardcoded."

### Closing Statement
> "The Roam QC Dashboard brings Roam data to life with a professional QA operations interface. It's automated, reliable, and gives QA leadership the visibility they need to manage test execution. And with 5-minute automatic syncs, it stays current without any manual intervention."

---

## HANDLING QUESTIONS

**Q: How often does it sync?**  
A: "Every 5 minutes automatically, plus on-demand with a 'Sync Now' button. You don't need to do anything—it just keeps working in the background."

**Q: What if Roam is not available?**  
A: "The system handles network issues gracefully. It will retry, and the dashboard continues showing the last known data. There's no data loss."

**Q: How long does a sync take?**  
A: "Depends on repository size. For this repository with 3,700 nodes, about 4-5 minutes. Smaller repositories sync in under a minute."

**Q: Can we have multiple projects?**  
A: "Yes, absolutely. The dashboard supports multiple projects. You can switch between them with a dropdown and see metrics for each independently."

**Q: What about test execution data?**  
A: "Right now we're showing imported test structure. As you execute tests and update status in Roam or our system, the pass/fail rates will populate. The dashboard automatically aggregates that data."

**Q: Is there API access?**  
A: "Yes, the dashboard metrics are available via REST API. Other systems can query test status programmatically."

**Q: How secure is this?**  
A: "API credentials are encrypted. All data is in our secure database. Access is controlled via authentication. Audit logs track all syncs."

---

## TROUBLESHOOTING (If Something Goes Wrong)

**If Sync Hangs**:
- Check network connection to Roam API
- Verify Roam Desktop is running (for local API)
- Check API credentials in Settings

**If Dashboard Doesn't Update**:
- Click browser refresh
- Wait 5 minutes for automatic sync
- Check System Status → Sync History for errors

**If Tree Doesn't Display**:
- Check console for errors (F12 → Console tab)
- Verify repository imported (check count in Settings)
- Try refreshing page

**If Performance Is Slow**:
- This is normal on first load (cold start)
- Subsequent requests are faster
- Monitor dashboard for 5 minutes; should stabilize

---

## POST-DEMO FOLLOW-UP

1. [ ] Provide stakeholders with:
   - [ ] Dashboard URL and access instructions
   - [ ] Demo video recording (if recorded)
   - [ ] FAQ document

2. [ ] Gather feedback:
   - [ ] Is the interface intuitive?
   - [ ] Are metrics meaningful?
   - [ ] Any feature requests?

3. [ ] Schedule UAT:
   - [ ] Formal QA testing
   - [ ] Production readiness review
   - [ ] Go-live date planning

---

**Demo Script Version**: 1.0  
**Last Updated**: 2026-06-17  
**Duration Verified**: 15 minutes
