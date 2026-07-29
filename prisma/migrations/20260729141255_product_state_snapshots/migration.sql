-- Restore the aggregate tables already represented in the Prisma schema and
-- add one server-owned readiness snapshot used across product tabs.
CREATE TABLE IF NOT EXISTS "UserEarningsSnapshot" (
    "userId" TEXT NOT NULL,
    "youEarnedUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "claimableUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "authorizedUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "settledUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "authorizationCount" INTEGER NOT NULL DEFAULT 0,
    "identitiesJson" TEXT NOT NULL DEFAULT '[]',
    "stalestClaimableAt" TIMESTAMP(3),
    "notifyUrgency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "githubLinked" BOOLEAN NOT NULL DEFAULT false,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserEarningsSnapshot_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE IF NOT EXISTS "CommunityVitalsSnapshot" (
    "slug" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityVitalsSnapshot_pkey" PRIMARY KEY ("slug")
);

CREATE TABLE "WorkspaceReadinessSnapshot" (
    "userId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSuccessfulAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastFailureCode" TEXT,
    "lastFailureAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceReadinessSnapshot_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX IF NOT EXISTS "UserEarningsSnapshot_computedAt_idx"
ON "UserEarningsSnapshot"("computedAt");

CREATE INDEX IF NOT EXISTS "CommunityVitalsSnapshot_computedAt_idx"
ON "CommunityVitalsSnapshot"("computedAt");

CREATE INDEX "WorkspaceReadinessSnapshot_computedAt_idx"
ON "WorkspaceReadinessSnapshot"("computedAt");

CREATE INDEX "WorkspaceReadinessSnapshot_lastFailureAt_idx"
ON "WorkspaceReadinessSnapshot"("lastFailureAt");

ALTER TABLE "UserEarningsSnapshot"
ADD CONSTRAINT "UserEarningsSnapshot_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceReadinessSnapshot"
ADD CONSTRAINT "WorkspaceReadinessSnapshot_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserEarningsSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommunityVitalsSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceReadinessSnapshot" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "UserEarningsSnapshot" FROM anon, authenticated;
REVOKE ALL ON TABLE "CommunityVitalsSnapshot" FROM anon, authenticated;
REVOKE ALL ON TABLE "WorkspaceReadinessSnapshot" FROM anon, authenticated;
