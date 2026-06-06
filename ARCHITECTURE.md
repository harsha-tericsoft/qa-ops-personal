# QA Ops Platform - Architecture Design

## System Overview

A comprehensive QA Operations platform built with Next.js 16, TypeScript, Tailwind CSS, ShadCN, Prisma, and Supabase. Designed to manage QA workflows including projects, test cases, defects, sprints, execution cycles, and release readiness tracking with Roam integration.

---

## Core Entities & Data Model

### 1. **Organization & Access Control**

```
User (Lead/QA role)
├── role: LEAD | QA_ENGINEER | QA_MANAGER
├── email: string
└── projects: many-to-many (with role context)
```

### 2. **Projects & Structure**

```
Project
├── id, name, description
├── owner: User (Lead)
├── visibility: PRIVATE | PUBLIC
├── createdAt, updatedAt
└── children:
    ├── Repository (Git/Code reference)
    ├── Sprint
    ├── ExecutionCycle
    ├── TestCase
    └── Defect
```

### 3. **Repository Tree**

```
Repository
├── id, name, projectId
├── repoUrl: string (Git URL)
├── branches: string[]
├── syncedAt: timestamp
└── files: hierarchical structure (for test file mapping)
```

### 4. **Test Management**

```
TestCase
├── id, title, description
├── projectId, repositoryId (optional)
├── status: ACTIVE | ARCHIVED | DEPRECATED
├── type: UNIT | INTEGRATION | E2E | MANUAL
├── priority: HIGH | MEDIUM | LOW
├── tags: many-to-many Tag
├── version: int (tracks test changes)
├── steps: TestStep[]
│   └── TestStep { order, action, expectedResult }
├── linkedBugs: Defect[]
├── createdBy: User
├── lastModified: User, timestamp
```

### 5. **Versions & Sprint Management**

```
Version
├── id, projectId, number (e.g., 1.0, 1.1)
├── releaseDate: timestamp
├── status: PLANNED | IN_PROGRESS | RELEASED
└── sprints: Sprint[]

Sprint
├── id, projectId, versionId
├── name, description
├── startDate, endDate
├── status: PLANNED | ACTIVE | COMPLETED
├── testCases: TestCase[] (assigned)
├── executionCycle: ExecutionCycle
└── releaseReadiness: ReleaseReadiness
```

### 6. **Execution & Defect Tracking**

```
ExecutionCycle
├── id, projectId, sprintId
├── name, startDate, endDate
├── status: PLANNED | IN_PROGRESS | COMPLETED
├── testRuns: TestRun[]
└── totalTests, passedTests, failedTests, skippedTests

TestRun
├── id, executionCycleId, testCaseId
├── executor: User
├── status: PASSED | FAILED | SKIPPED | BLOCKED
├── result: string (notes/evidence)
├── defects: Defect[]
├── executedAt: timestamp
└── duration: int (ms)

Defect
├── id, projectId, sprintId
├── title, description
├── severity: CRITICAL | HIGH | MEDIUM | LOW
├── status: OPEN | IN_PROGRESS | RESOLVED | CLOSED | WONT_FIX
├── assignee: User
├── foundBy: User
├── linkedTests: TestCase[]
├── linkedExecutions: TestRun[]
├── rootCause: string
├── resolution: string
├── createdAt, resolvedAt
```

### 7. **Tags & Metadata**

```
Tag
├── id, projectId, name, color
├── category: string (optional - e.g., "Browser", "Platform")
└── testCases: many-to-many TestCase
```

### 8. **Dashboard & Release Readiness**

```
ReleaseReadiness
├── id, versionId, sprintId
├── testCoverage: float (%)
├── passRate: float (%)
├── criticalDefectsCount: int
├── blockerDefectsCount: int
├── readinessScore: float (0-100)
├── status: ON_TRACK | AT_RISK | BLOCKED
├── notes: string
└── lastUpdated: timestamp

DashboardMetric
├── projectId, date
├── totalTests, activeTests
├── passRate, failRate, skipRate
├── openDefects, resolvedDefects
├── executionCycles, completedCycles
└── avgTestDuration: int (ms)
```

### 9. **Roam Integration**

```
RoamSync
├── id, projectId, workspaceId (Roam)
├── syncStatus: PENDING | ACTIVE | PAUSED | ERROR
├── lastSyncAt, nextSyncAt
├── syncDirection: BIDIRECTIONAL | ONE_WAY_IMPORT | ONE_WAY_EXPORT
├── mappedNodes: { roamNodeId: qaEntityId }
└── logEntries: SyncLog[]

SyncLog
├── id, roamSyncId
├── action: IMPORT | EXPORT | CONFLICT_RESOLVED
├── entity: string (type)
├── status: SUCCESS | FAILED
├── details: JSON
└── timestamp
```

---

## Architecture Layers

### **1. Database Layer (Prisma + Supabase PostgreSQL)**

**Responsibilities:**
- Define schema for all entities
- Manage migrations
- Handle database connections with PgBouncer pooling
- Implement row-level security (RLS) for multi-tenant isolation

**File Structure:**
```
prisma/
├── schema.prisma (all models)
├── migrations/ (version control)
└── seed.ts (optional: dev data)
```

**Key Patterns:**
- Soft deletes for auditing (use `deletedAt: DateTime?`)
- Timestamps on all entities (`createdAt`, `updatedAt`)
- Explicit foreign keys with `@relation` for clarity
- Indexes on frequently queried columns (projectId, userId, status)

---

### **2. API Layer (Route Handlers + Server Actions)**

**Route Handlers** (`app/api/*/route.ts`):
- RESTful endpoints for external integrations (Roam, webhooks)
- Standard CRUD operations
- Streaming responses for large datasets
- Error handling with proper HTTP status codes

**Server Actions** (`app/actions/*.ts`):
- Form mutations (create/update/delete from UI)
- Transactional operations
- Real-time updates via Server-Sent Events (SSE)

**File Structure:**
```
app/
├── api/
│   ├── auth/
│   ├── projects/
│   ├── test-cases/
│   ├── executions/
│   ├── defects/
│   ├── roam/ (webhooks & sync)
│   └── health/
└── actions/
    ├── projects.ts
    ├── test-cases.ts
    ├── executions.ts
    ├── defects.ts
    └── roam.ts
```

---

### **3. Service Layer (Business Logic)**

**Responsibilities:**
- Orchestrate database queries
- Business rule enforcement
- Complex calculations (release readiness score)
- Roam sync logic

**File Structure:**
```
lib/
├── services/
│   ├── project.service.ts
│   ├── test.service.ts
│   ├── execution.service.ts
│   ├── defect.service.ts
│   ├── release.service.ts
│   └── roam.service.ts
├── utils/
│   ├── validators.ts
│   ├── formatters.ts
│   ├── calculations.ts
│   └── auth.ts
└── types.ts (shared TS types)
```

---

### **4. UI Layer (React Components + Pages)**

**Page Structure** (App Router):
```
app/
├── (dashboard)/
│   ├── layout.tsx (main app layout)
│   ├── page.tsx (dashboard home)
│   ├── projects/
│   │   ├── page.tsx (projects list)
│   │   ├── [id]/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx (project overview)
│   │   │   ├── test-cases/
│   │   │   ├── executions/
│   │   │   ├── defects/
│   │   │   ├── sprints/
│   │   │   ├── versions/
│   │   │   └── repository/
│   │   └── new/
│   ├── settings/
│   └── roam-sync/
└── auth/
    ├── login/
    └── callback/
```

**Component Structure** (ShadCN + Tailwind):
```
components/
├── ui/ (ShadCN: button, input, table, dialog, etc.)
├── layout/
│   ├── Sidebar.tsx
│   ├── TopNav.tsx
│   └── Breadcrumb.tsx
├── forms/
│   ├── ProjectForm.tsx
│   ├── TestCaseForm.tsx
│   ├── ExecutionForm.tsx
│   └── DefectForm.tsx
├── tables/
│   ├── TestCasesTable.tsx
│   ├── ExecutionTable.tsx
│   ├── DefectsTable.tsx
│   └── SprintsTable.tsx
├── dialogs/
│   ├── CreateProjectDialog.tsx
│   ├── ConfirmDeleteDialog.tsx
│   └── LinkDefectDialog.tsx
├── charts/
│   ├── PassRateChart.tsx
│   ├── DefectStatusChart.tsx
│   └── TestCoverageChart.tsx
└── status/ (status badges, indicators)
```

---

### **5. Integration Layer (Roam Sync)**

**Roam Integration Strategy:**
- **Live Sync**: Webhook-based bidirectional updates
- **Import/Export**: Bulk operations with conflict resolution
- **Node Mapping**: Maintain mapping between Roam nodes and QA entities

**File Structure:**
```
lib/roam/
├── client.ts (Roam API wrapper)
├── sync.ts (sync orchestration)
├── mapper.ts (entity ↔ node mapping)
├── conflict-resolver.ts
└── transformers.ts (Roam format ↔ QA format)
```

**Sync Flow:**
1. User initiates sync or webhook fires on Roam update
2. Fetch changes from Roam API
3. Map Roam nodes to QA entities
4. Detect conflicts (last-modified wins, with user review option)
5. Apply changes to database
6. Push back to Roam if bidirectional

---

## Key Features & Implementation

### **1. Release Readiness Dashboard**
- **Metrics**: Test coverage %, pass rate, open critical defects, blocker count
- **Score Formula**: `(passRate × 0.4) + (coverage × 0.3) - (criticalDefects × 0.2) - (blockers × 0.1)`
- **Status**: ON_TRACK (>80), AT_RISK (60-80), BLOCKED (<60)
- **Real-time Updates**: SSE stream from execution cycles

### **2. Test Case Versioning**
- Track changes to test cases (steps, expected results)
- Link test versions to sprints/executions
- Allow rollback to previous versions
- Show diff between versions

### **3. Execution Cycle Management**
- Assign test cases to QA engineers
- Track execution status (passed, failed, skipped, blocked)
- Capture defects during execution
- Calculate metrics (pass rate, duration, coverage)

### **4. Defect Lifecycle**
- Create from failed test runs or manually
- Link to test cases, sprints, versions
- Status workflow: OPEN → IN_PROGRESS → RESOLVED → CLOSED
- Root cause analysis & resolution tracking
- Re-test capability

### **5. Roam Integration**
- **Export**: Test cases, defects, execution results → Roam
- **Import**: Test cases, defects from Roam → QA system
- **Live Sync**: Real-time bidirectional updates
- **Conflict Resolution**: User-driven when both systems have changes

---

## Security & Access Control

**Authentication:**
- OAuth (Google/GitHub) or Clerk for user management
- Session-based or JWT tokens
- Stored in HTTP-only cookies

**Authorization:**
- Role-based access control (LEAD, QA_ENGINEER, QA_MANAGER)
- Project-level permissions (member, admin)
- Row-level security (RLS) in Supabase for data isolation

**Data Protection:**
- Environment variables for sensitive keys (Supabase URL, Roam token)
- Never expose secrets to client
- Validate all user inputs
- HTTPS only in production

---

## Technology Decisions

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 16 | Full-stack, SSR, App Router, great DX |
| Database | Supabase PostgreSQL | Managed, RLS support, real-time capabilities |
| ORM | Prisma 7 | Type-safe, migrations, great dev experience |
| Frontend | React 19, Tailwind v4, ShadCN | Component library, utility-first CSS, accessibility |
| State | Server Components + Server Actions | Reduces client JS, automatic caching |
| Forms | React Hook Form + Zod | Client/server validation, type-safe |
| Charts | Recharts or Visx | React-based, customizable |
| Icons | Lucide React | Consistent, SVG-based |
| Testing | Playwright + Vitest (later) | E2E + unit tests |

---

## Implementation Phases

### **Phase 1: Foundation** (1-2 weeks)
- [ ] Prisma schema design & migrations
- [ ] Auth setup (Clerk or similar)
- [ ] Basic CRUD API endpoints
- [ ] Project management pages

### **Phase 2: Core QA Features** (2-3 weeks)
- [ ] Test case management
- [ ] Sprint & version management
- [ ] Execution cycle & test runs
- [ ] Defect tracking

### **Phase 3: Dashboard & Analytics** (1-2 weeks)
- [ ] Release readiness dashboard
- [ ] Metrics & charts
- [ ] Real-time updates
- [ ] Export/reporting

### **Phase 4: Roam Integration** (2-3 weeks)
- [ ] Roam API client
- [ ] Import/export functionality
- [ ] Live sync with webhooks
- [ ] Conflict resolution

### **Phase 5: Polish & Optimization** (1 week)
- [ ] Performance tuning
- [ ] UI refinement
- [ ] Testing
- [ ] Documentation

---

## File Structure (Complete)

```
qa-ops/
├── app/
│   ├── (dashboard)/              # Protected routes
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Dashboard home
│   │   ├── projects/
│   │   ├── sprints/
│   │   ├── test-cases/
│   │   ├── executions/
│   │   ├── defects/
│   │   ├── versions/
│   │   ├── roam-sync/
│   │   └── settings/
│   ├── api/                      # Route handlers
│   │   ├── projects/
│   │   ├── test-cases/
│   │   ├── executions/
│   │   ├── defects/
│   │   ├── roam/
│   │   └── health/
│   ├── auth/                     # Auth pages
│   │   ├── login/
│   │   └── callback/
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Public home
│   ├── globals.css
│   └── favicon.ico
├── components/
│   ├── ui/                       # ShadCN components
│   ├── layout/
│   ├── forms/
│   ├── tables/
│   ├── dialogs/
│   ├── charts/
│   └── status/
├── lib/
│   ├── services/                 # Business logic
│   ├── roam/                     # Roam integration
│   ├── utils/
│   ├── types.ts
│   └── auth.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── public/
├── styles/
├── types/
├── middleware.ts / proxy.ts      # Auth middleware
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── package.json
├── .env.local
└── ARCHITECTURE.md               # This file
```

---

## Next Steps

1. **Start with Prisma schema**: Define all models based on the data model above
2. **Create migrations**: Set up database structure
3. **Build auth**: Implement user login/registration
4. **API endpoints**: Create CRUD routes for core entities
5. **Pages & components**: Build UI layer incrementally
6. **Roam integration**: Add sync capabilities
7. **Testing & deployment**: Polish and launch

---

## Notes

- Use `'use cache'` directive in Server Components for heavy queries
- Implement optimistic updates in forms for better UX
- Use Suspense boundaries for streaming results
- Consider SSE for real-time metrics updates
- Add database indexes on `projectId`, `userId`, `status`, `createdAt`
- Plan RLS policies for Supabase from the start
