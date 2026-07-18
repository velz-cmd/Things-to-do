CREATE TABLE IF NOT EXISTS "DiscoverRepositorySnapshot" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoverRepositorySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DiscoverRepositorySnapshot_fullName_fingerprint_key"
ON "DiscoverRepositorySnapshot"("fullName", "fingerprint");

CREATE INDEX IF NOT EXISTS "DiscoverRepositorySnapshot_fullName_observedAt_idx"
ON "DiscoverRepositorySnapshot"("fullName", "observedAt");

CREATE INDEX IF NOT EXISTS "DiscoverRepositorySnapshot_observedAt_idx"
ON "DiscoverRepositorySnapshot"("observedAt");
