-- Add bridge tables for Desktop Connector functionality

-- Create BridgeTokenStatus enum
CREATE TYPE "BridgeTokenStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- Create BridgeSessionStatus enum
CREATE TYPE "BridgeSessionStatus" AS ENUM ('CONNECTED', 'OFFLINE', 'DEGRADED');

-- Create BridgeToken table
CREATE TABLE "BridgeToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bridgeId" TEXT NOT NULL UNIQUE,
    "token" TEXT NOT NULL UNIQUE,
    "graphName" TEXT NOT NULL,
    "status" "BridgeTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "refreshToken" TEXT,
    CONSTRAINT "BridgeToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- Create BridgeSession table
CREATE TABLE "BridgeSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bridgeTokenId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "status" "BridgeSessionStatus" NOT NULL DEFAULT 'CONNECTED',
    "lastHealthCheckAt" TIMESTAMP(3),
    "lastHealthCheckStatus" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BridgeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
    CONSTRAINT "BridgeSession_bridgeTokenId_fkey" FOREIGN KEY ("bridgeTokenId") REFERENCES "BridgeToken" ("id") ON DELETE CASCADE
);

-- Create BridgeLog table
CREATE TABLE "BridgeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bridgeSessionId" TEXT,
    "bridgeId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requestId" TEXT,
    "durationMs" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BridgeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
    CONSTRAINT "BridgeLog_bridgeSessionId_fkey" FOREIGN KEY ("bridgeSessionId") REFERENCES "BridgeSession" ("id") ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX "BridgeToken_userId_idx" ON "BridgeToken"("userId");
CREATE INDEX "BridgeToken_bridgeId_idx" ON "BridgeToken"("bridgeId");
CREATE INDEX "BridgeToken_expiresAt_idx" ON "BridgeToken"("expiresAt");
CREATE INDEX "BridgeToken_status_idx" ON "BridgeToken"("status");

CREATE INDEX "BridgeSession_userId_idx" ON "BridgeSession"("userId");
CREATE INDEX "BridgeSession_bridgeTokenId_idx" ON "BridgeSession"("bridgeTokenId");
CREATE INDEX "BridgeSession_status_idx" ON "BridgeSession"("status");
CREATE INDEX "BridgeSession_expiresAt_idx" ON "BridgeSession"("expiresAt");

CREATE INDEX "BridgeLog_userId_idx" ON "BridgeLog"("userId");
CREATE INDEX "BridgeLog_bridgeId_idx" ON "BridgeLog"("bridgeId");
CREATE INDEX "BridgeLog_action_idx" ON "BridgeLog"("action");
CREATE INDEX "BridgeLog_status_idx" ON "BridgeLog"("status");
CREATE INDEX "BridgeLog_createdAt_idx" ON "BridgeLog"("createdAt");
