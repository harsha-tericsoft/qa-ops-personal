-- CreateEnum
CREATE TYPE "RepositoryType" AS ENUM ('FRONTEND', 'BACKEND', 'MONOREPO', 'MICROSERVICE', 'AUTOMATION');

-- CreateEnum
CREATE TYPE "RepositoryPurpose" AS ENUM ('PRIMARY', 'SECONDARY', 'LEGACY');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('not_tested', 'connected', 'error', 'token_expired');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('not_analyzed', 'analyzing', 'analyzed', 'error');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "codeRepositoriesEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CodeRepository" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "repositoryName" TEXT NOT NULL,
    "repositoryUrl" TEXT NOT NULL,
    "repositoryType" "RepositoryType" NOT NULL,
    "repositoryPurpose" "RepositoryPurpose" NOT NULL DEFAULT 'PRIMARY',
    "branch" TEXT NOT NULL DEFAULT 'main',
    "connectionStatus" "ConnectionStatus" NOT NULL DEFAULT 'not_tested',
    "lastConnectionTestAt" TIMESTAMP(3),
    "lastConnectionTestError" TEXT,
    "detectedTechStack" JSONB,
    "detectedAt" TIMESTAMP(3),
    "analysisStatus" "AnalysisStatus" NOT NULL DEFAULT 'not_analyzed',
    "analysisVersion" INTEGER NOT NULL DEFAULT 0,
    "lastAnalyzedAt" TIMESTAMP(3),
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeRepository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeRepositoryCredential" (
    "id" TEXT NOT NULL,
    "codeRepositoryId" TEXT NOT NULL,
    "credentialType" TEXT NOT NULL DEFAULT 'github_pat',
    "encryptedValue" TEXT NOT NULL,
    "encryptionAlgorithm" TEXT NOT NULL DEFAULT 'AES-256-GCM',
    "encryptionKeyId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "CodeRepositoryCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeRepositoryConnectionTest" (
    "id" TEXT NOT NULL,
    "codeRepositoryId" TEXT NOT NULL,
    "testType" TEXT NOT NULL,
    "testStatus" TEXT NOT NULL,
    "testMessage" TEXT,
    "testError" TEXT,
    "responseTimeMs" INTEGER,
    "testedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeRepositoryConnectionTest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CodeRepository_projectId_idx" ON "CodeRepository"("projectId");

-- CreateIndex
CREATE INDEX "CodeRepository_createdAt_idx" ON "CodeRepository"("createdAt" DESC);

-- CreateIndex (Partial unique index - allows re-registration after soft delete)
CREATE UNIQUE INDEX "CodeRepository_projectId_repositoryUrl_active_idx" ON "CodeRepository"("projectId", "repositoryUrl") WHERE "isActive" = true;

-- CreateIndex
CREATE UNIQUE INDEX "CodeRepositoryCredential_codeRepositoryId_credentialType_key" ON "CodeRepositoryCredential"("codeRepositoryId", "credentialType");

-- CreateIndex
CREATE INDEX "CodeRepositoryCredential_codeRepositoryId_idx" ON "CodeRepositoryCredential"("codeRepositoryId");

-- CreateIndex
CREATE INDEX "CodeRepositoryCredential_expiresAt_idx" ON "CodeRepositoryCredential"("expiresAt");

-- CreateIndex
CREATE INDEX "CodeRepositoryConnectionTest_codeRepositoryId_createdAt_idx" ON "CodeRepositoryConnectionTest"("codeRepositoryId" DESC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CodeRepositoryConnectionTest_testStatus_idx" ON "CodeRepositoryConnectionTest"("testStatus");

-- AddForeignKey
ALTER TABLE "CodeRepository" ADD CONSTRAINT "CodeRepository_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeRepositoryCredential" ADD CONSTRAINT "CodeRepositoryCredential_codeRepositoryId_fkey" FOREIGN KEY ("codeRepositoryId") REFERENCES "CodeRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeRepositoryConnectionTest" ADD CONSTRAINT "CodeRepositoryConnectionTest_codeRepositoryId_fkey" FOREIGN KEY ("codeRepositoryId") REFERENCES "CodeRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
