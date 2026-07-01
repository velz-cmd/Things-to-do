-- Run in Supabase SQL Editor OR via terminal: DATABASE_URL="..." npx prisma db push
-- Do NOT paste shell commands (npx prisma db push) into the SQL editor.

CREATE TABLE IF NOT EXISTS "GithubOssScan" (
  "id" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "repo" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "payloadJson" TEXT NOT NULL,
  "stars" INTEGER NOT NULL DEFAULT 0,
  "fundingGapUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "priority" TEXT NOT NULL DEFAULT 'medium',
  "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GithubOssScan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GithubOssScan_owner_repo_key" ON "GithubOssScan"("owner", "repo");
CREATE INDEX IF NOT EXISTS "GithubOssScan_scannedAt_idx" ON "GithubOssScan"("scannedAt");

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
  CONSTRAINT "UserEarningsSnapshot_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "UserEarningsSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UserEarningsSnapshot_computedAt_idx" ON "UserEarningsSnapshot"("computedAt");

CREATE TABLE IF NOT EXISTS "CommunityVitalsSnapshot" (
  "slug" TEXT NOT NULL,
  "payloadJson" TEXT NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityVitalsSnapshot_pkey" PRIMARY KEY ("slug")
);

CREATE INDEX IF NOT EXISTS "CommunityVitalsSnapshot_computedAt_idx" ON "CommunityVitalsSnapshot"("computedAt");
