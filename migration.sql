-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('FOLDER', 'FILE', 'MODULE', 'FEATURE', 'EPIC', 'STORY');

-- CreateEnum
CREATE TYPE "SyncDirection" AS ENUM ('IMPORT_ONLY', 'EXPORT_ONLY', 'BIDIRECTIONAL');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('NEVER', 'IN_PROGRESS', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ABORTED');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('NOT_EXECUTED', 'PASS', 'FAIL', 'BLOCKED');

-- CreateEnum
CREATE TYPE "SuiteCategory" AS ENUM ('SMOKE', 'REGRESSION', 'SPRINT', 'RELEASE', 'CUSTOM');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "roamSyncId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepositoryNode" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "type" "NodeType" NOT NULL DEFAULT 'FOLDER',
    "description" TEXT,
    "metadata" JSONB,
    "parentId" TEXT,
    "roamNodeId" TEXT,
    "roamPageId" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RepositoryNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCaseNode" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,

    CONSTRAINT "TestCaseNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoamConfig" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "graphName" TEXT NOT NULL,
    "graphUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "syncIntervalMin" INTEGER NOT NULL DEFAULT 15,
    "syncDirection" "SyncDirection" NOT NULL DEFAULT 'IMPORT_ONLY',
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" "SyncStatus" NOT NULL DEFAULT 'NEVER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoamConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "nodesAdded" INTEGER NOT NULL DEFAULT 0,
    "nodesUpdated" INTEGER NOT NULL DEFAULT 0,
    "nodesSkipped" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionCycle" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "CycleStatus" NOT NULL DEFAULT 'PLANNED',
    "createdBy" TEXT,
    "sourceSuiteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutionCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestRun" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'NOT_EXECUTED',
    "executedBy" TEXT,
    "executedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunComment" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JiraLink" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "issueKey" TEXT NOT NULL,
    "issueUrl" TEXT,
    "issueType" TEXT,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JiraLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunAttachment" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestSuite" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "SuiteCategory" NOT NULL DEFAULT 'CUSTOM',
    "selectionMethod" TEXT NOT NULL,
    "selectionConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestSuite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuiteTestCase" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SuiteTestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagTestCase" (
    "tagId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,

    CONSTRAINT "TagTestCase_pkey" PRIMARY KEY ("tagId","testCaseId")
);

-- CreateIndex
CREATE INDEX "Repository_projectId_idx" ON "Repository"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "RepositoryNode_roamNodeId_key" ON "RepositoryNode"("roamNodeId");

-- CreateIndex
CREATE INDEX "RepositoryNode_repositoryId_idx" ON "RepositoryNode"("repositoryId");

-- CreateIndex
CREATE INDEX "RepositoryNode_projectId_idx" ON "RepositoryNode"("projectId");

-- CreateIndex
CREATE INDEX "RepositoryNode_parentId_idx" ON "RepositoryNode"("parentId");

-- CreateIndex
CREATE INDEX "RepositoryNode_path_idx" ON "RepositoryNode"("path");

-- CreateIndex
CREATE INDEX "TestCase_projectId_idx" ON "TestCase"("projectId");

-- CreateIndex
CREATE INDEX "TestCaseNode_nodeId_idx" ON "TestCaseNode"("nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "TestCaseNode_testCaseId_nodeId_key" ON "TestCaseNode"("testCaseId", "nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "RoamConfig_projectId_key" ON "RoamConfig"("projectId");

-- CreateIndex
CREATE INDEX "SyncLog_projectId_idx" ON "SyncLog"("projectId");

-- CreateIndex
CREATE INDEX "ExecutionCycle_projectId_idx" ON "ExecutionCycle"("projectId");

-- CreateIndex
CREATE INDEX "ExecutionCycle_sourceSuiteId_idx" ON "ExecutionCycle"("sourceSuiteId");

-- CreateIndex
CREATE INDEX "TestRun_cycleId_idx" ON "TestRun"("cycleId");

-- CreateIndex
CREATE INDEX "TestRun_testCaseId_idx" ON "TestRun"("testCaseId");

-- CreateIndex
CREATE INDEX "RunComment_runId_idx" ON "RunComment"("runId");

-- CreateIndex
CREATE INDEX "JiraLink_runId_idx" ON "JiraLink"("runId");

-- CreateIndex
CREATE INDEX "RunAttachment_runId_idx" ON "RunAttachment"("runId");

-- CreateIndex
CREATE INDEX "TestSuite_projectId_idx" ON "TestSuite"("projectId");

-- CreateIndex
CREATE INDEX "SuiteTestCase_suiteId_idx" ON "SuiteTestCase"("suiteId");

-- CreateIndex
CREATE UNIQUE INDEX "SuiteTestCase_suiteId_testCaseId_key" ON "SuiteTestCase"("suiteId", "testCaseId");

-- CreateIndex
CREATE INDEX "Tag_projectId_idx" ON "Tag"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_projectId_name_key" ON "Tag"("projectId", "name");

-- AddForeignKey
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositoryNode" ADD CONSTRAINT "RepositoryNode_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositoryNode" ADD CONSTRAINT "RepositoryNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "RepositoryNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCaseNode" ADD CONSTRAINT "TestCaseNode_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCaseNode" ADD CONSTRAINT "TestCaseNode_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "RepositoryNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoamConfig" ADD CONSTRAINT "RoamConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionCycle" ADD CONSTRAINT "ExecutionCycle_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionCycle" ADD CONSTRAINT "ExecutionCycle_sourceSuiteId_fkey" FOREIGN KEY ("sourceSuiteId") REFERENCES "TestSuite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ExecutionCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunComment" ADD CONSTRAINT "RunComment_runId_fkey" FOREIGN KEY ("runId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JiraLink" ADD CONSTRAINT "JiraLink_runId_fkey" FOREIGN KEY ("runId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunAttachment" ADD CONSTRAINT "RunAttachment_runId_fkey" FOREIGN KEY ("runId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSuite" ADD CONSTRAINT "TestSuite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiteTestCase" ADD CONSTRAINT "SuiteTestCase_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "TestSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiteTestCase" ADD CONSTRAINT "SuiteTestCase_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagTestCase" ADD CONSTRAINT "TagTestCase_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagTestCase" ADD CONSTRAINT "TagTestCase_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

