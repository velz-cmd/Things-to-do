-- Durable canonical research market record (Phase 3). "Latest known good"
-- state per canonical research work, mirroring GithubOssScan's
-- single-row-per-subject pattern.

CREATE TABLE IF NOT EXISTS "DiscoverResearchSnapshot" (
  "id" TEXT NOT NULL,
  "canonicalKey" TEXT NOT NULL,
  "payloadJson" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "firstObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastObservedAt" TIMESTAMP(3) NOT NULL,
  "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscoverResearchSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DiscoverResearchSnapshot_canonicalKey_key" ON "DiscoverResearchSnapshot"("canonicalKey");
CREATE INDEX IF NOT EXISTS "DiscoverResearchSnapshot_lastObservedAt_idx" ON "DiscoverResearchSnapshot"("lastObservedAt");
