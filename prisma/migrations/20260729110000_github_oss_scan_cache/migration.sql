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

CREATE UNIQUE INDEX IF NOT EXISTS "GithubOssScan_owner_repo_key"
ON "GithubOssScan"("owner", "repo");

CREATE INDEX IF NOT EXISTS "GithubOssScan_scannedAt_idx"
ON "GithubOssScan"("scannedAt");
